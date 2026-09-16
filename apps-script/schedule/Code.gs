/**
 * 큰길이벤트기획 — 행사 일정 대장 서버 (Google Apps Script)
 *
 * schedule.html 이 호출하는 백엔드. 팀 전원이 같은 행사 목록·일정표·품목표를 보고 고친다.
 *   GET  ?action=list                 → 행사 전체 + 서명완료 계약(계약 대장) 목록
 *   GET  ?action=contract&id=문서ID    → 서명된 계약 원문(품목 포함) — 일정에 가져오기용
 *   POST {action:'save', event}       → 행사 저장(신규·수정, ID 기준 덮어쓰기)
 *   POST {action:'delete', id}        → 행사 삭제
 *   POST {action:'ping'}              → 상태 확인
 *
 * 데이터는 내 드라이브 `큰길이벤트기획 계약서/행사 일정 대장` 스프레드시트(시트 '행사')에 쌓인다.
 * 전자계약 서버(apps-script/contract)와 같은 계정으로 배포하면 `계약 대장`을 그대로 읽어
 * 서명완료된 행사를 자동으로 '확정'으로 표시한다.
 * 설치 방법은 README.md 참고.
 */

// ── 설정 ────────────────────────────────────────────────
const ROOT_FOLDER_NAME     = '큰길이벤트기획 계약서';   // 전자계약 서버와 같은 폴더를 쓴다
const SCHEDULE_SHEET_NAME  = '행사 일정 대장';           // 스프레드시트 파일 이름
const CONTRACT_SHEET_NAME  = '계약 대장';               // 전자계약 서버가 만드는 대장 (없으면 건너뜀)
const CONTRACT_LIMIT       = 200;                       // 최근 계약 몇 건까지 읽을지

const HEAD = ['ID','행사명','행사일','시간','장소','상태','담당','계약번호','수정시각','수정자','JSON'];

// ── 진입점 ──────────────────────────────────────────────
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'list')     return json_(list_());
    if (p.action === 'contract') return json_(contract_(p.id));
    return json_({ ok: true, service: 'keungil-schedule', version: 1, time: new Date().toISOString() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); }
  catch (err) { return json_({ ok: false, error: '잘못된 요청 형식' }); }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    switch (body.action) {
      case 'ping':   return json_({ ok: true, version: 1 });
      case 'list':   return json_(list_());
      case 'save':   return json_(save_(body.event, body.by));
      case 'delete': return json_(remove_(body.id));
      default:       return json_({ ok: false, error: '알 수 없는 action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// ── 행사 목록 ────────────────────────────────────────────
function list_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  const events = [];
  if (last >= 2) {
    const rows = sh.getRange(2, 1, last - 1, HEAD.length).getValues();
    rows.forEach(r => {
      if (!r[0]) return;
      try { const ev = JSON.parse(r[HEAD.length - 1] || '{}'); if (ev && ev.id) events.push(ev); } catch (_) {}
    });
  }
  return { ok: true, events, contracts: signedContracts_(), time: new Date().toISOString() };
}

function save_(ev, by) {
  if (!ev || !ev.id) throw new Error('행사 ID가 없습니다');
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(ev.id)) throw new Error('행사 ID 형식이 잘못됐습니다');
  ev.updatedAt = new Date().toISOString();
  if (by) ev.updatedBy = String(by).slice(0, 40);
  const sh = sheet_();
  const row = findRow_(sh, ev.id);
  const values = [
    ev.id, str_(ev.title), str_(ev.date), str_(ev.time), str_(ev.place), str_(ev.status),
    str_(ev.owner), str_(ev.contractNo), ev.updatedAt, str_(ev.updatedBy), JSON.stringify(ev),
  ];
  if (row) sh.getRange(row, 1, 1, HEAD.length).setValues([values]);
  else sh.appendRow(values);
  return { ok: true, id: ev.id, updatedAt: ev.updatedAt };
}

function remove_(id) {
  if (!id) throw new Error('행사 ID가 없습니다');
  const sh = sheet_();
  const row = findRow_(sh, String(id));
  if (row) sh.deleteRow(row);
  return { ok: true, id, removed: !!row };
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

// ── 서명완료 계약 읽기 (전자계약 서버의 계약 대장) ────────────
function signedContracts_() {
  const file = findSheetFile_(CONTRACT_SHEET_NAME);
  if (!file) return [];
  let sh;
  try { sh = SpreadsheetApp.open(file).getSheets()[0]; } catch (_) { return []; }
  const last = sh.getLastRow();
  if (last < 2) return [];
  const from = Math.max(2, last - CONTRACT_LIMIT + 1);
  const rows = sh.getRange(from, 1, last - from + 1, 17).getValues();
  // 대장 열: 기록시각,문서ID,상태,계약번호,행사명,행사일,장소,갑 단체,갑 담당자,연락처,이메일,계약금액,서명자,서명시각,PDF,문서확인코드,비고
  const seen = {};
  const out = [];
  rows.forEach(r => {
    if (String(r[2]) !== '서명완료') return;
    const docId = String(r[1] || '');
    if (!docId || seen[docId]) return;
    seen[docId] = true;
    out.push({
      docId, no: str_(r[3]), title: str_(r[4]), date: str_(r[5]), place: str_(r[6]),
      org: str_(r[7]), name: str_(r[8]), tel: str_(r[9]),
      total: Number(r[11]) || 0, signer: str_(r[12]),
      signedAt: r[13] instanceof Date ? r[13].toISOString() : str_(r[13]),
      pdfUrl: str_(r[14]),
    });
  });
  return out;
}

function contract_(id) {
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(String(id || ''))) return { ok: false, error: '문서ID 형식이 잘못됐습니다' };
  const data = subFolderIfExists_(rootFolder_(), '_data');
  if (!data) return { ok: false, error: '계약 데이터 폴더가 없습니다' };
  const it = data.getFilesByName(id + '.json');
  if (!it.hasNext()) return { ok: false, error: '계약서를 찾을 수 없습니다' };
  let rec;
  try { rec = JSON.parse(it.next().getBlob().getDataAsString()); } catch (_) { return { ok: false, error: '계약서를 읽을 수 없습니다' }; }
  const c = rec.contract || {};
  return {
    ok: true, id: rec.id, status: rec.status, signedAt: rec.signedAt || '', pdfUrl: rec.pdfUrl || '',
    no: str_(c.no), ev: c.ev || {}, cl: { org: str_(c.cl && c.cl.org), name: str_(c.cl && c.cl.name), tel: str_(c.cl && c.cl.tel) },
    items: (c.items || []).map(it => ({ name: str_(it.name), spec: str_(it.spec), qty: str_(it.qty), unit: str_(it.unit), days: str_(it.days) })),
  };
}

// ── 드라이브 · 시트 유틸 ──────────────────────────────────
function rootFolder_() { return subFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME); }
function subFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function subFolderIfExists_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : null;
}
function findSheetFile_(name) {
  const it = rootFolder_().getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) { const f = it.next(); if (f.getName() === name) return f; }
  return null;
}
function sheet_() {
  let file = findSheetFile_(SCHEDULE_SHEET_NAME);
  let ss;
  if (file) ss = SpreadsheetApp.open(file);
  else {
    ss = SpreadsheetApp.create(SCHEDULE_SHEET_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(rootFolder_());
    const sh = ss.getActiveSheet(); sh.setName('행사');
    sh.appendRow(HEAD);
    sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEAD.length).setFontWeight('bold').setBackground('#F5F3EE');
    sh.setColumnWidth(HEAD.length, 60);
  }
  let sh = ss.getSheetByName('행사');
  if (!sh) { sh = ss.getSheets()[0]; sh.setName('행사'); if (sh.getLastRow() === 0) sh.appendRow(HEAD); }
  return sh;
}

function str_(v) { return v == null ? '' : String(v); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
