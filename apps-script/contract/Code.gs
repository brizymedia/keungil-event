/**
 * 큰길이벤트기획 — 전자계약 서버 (Google Apps Script)
 *
 * contract.html 이 호출하는 백엔드.
 *   POST {action:'store', contract, hash}      → 계약서 저장, 짧은 ID 발급
 *   GET  ?id=ID                                → 계약서 조회 (고객 화면이 불러옴)
 *   POST {action:'sign', id, contract, sig, signer, ts, hash, html, to, subject}
 *                                              → 서명 접수, PDF 생성, 드라이브 저장, 양측 메일, 대장 기록
 *   POST {action:'ping'}                       → 상태 확인
 *
 * 설치 방법은 README.md 참고.
 */

// ── 설정 ────────────────────────────────────────────────
const ROOT_FOLDER_NAME = '큰길이벤트기획 계약서';   // 내 드라이브에 자동 생성
const SHEET_NAME       = '계약 대장';               // 루트 폴더 안에 자동 생성되는 스프레드시트 이름
const COMPANY_NAME     = '큰길이벤트기획';
const COMPANY_EMAIL    = 'gilauto325@gmail.com';    // 서명본 사본을 항상 받을 주소 (계약서의 co.email 과 별개로 무조건 수신)
const ALLOW_RESIGN     = false;                     // true 면 이미 서명된 계약에 다시 서명 허용

// ── 진입점 ──────────────────────────────────────────────
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.id) return json_(getContract_(p.id));
  return json_({ ok: true, service: 'keungil-contract', version: 1, time: new Date().toISOString() });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); }
  catch (err) { return json_({ ok: false, error: '잘못된 요청 형식' }); }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    switch (body.action) {
      case 'ping':  return json_({ ok: true, version: 1 });
      case 'store': return json_(storeContract_(body));
      case 'sign':  return json_(signContract_(body));
      default:      return json_({ ok: false, error: '알 수 없는 action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// ── 저장 / 조회 ─────────────────────────────────────────
function storeContract_(body) {
  const contract = body.contract;
  if (!contract || !contract.ev || !contract.cl) throw new Error('계약 내용이 비어 있습니다');
  const id = newId_();
  const rec = { id, status: 'pending', createdAt: new Date().toISOString(), hash: body.hash || '', contract };
  dataFolder_().createFile(id + '.json', JSON.stringify(rec), 'application/json');
  appendLog_({ id, status: '발송', contract, hash: rec.hash });
  return { ok: true, id };
}

function getContract_(id) {
  const rec = readRecord_(id);
  if (!rec) return { ok: false, error: '계약서를 찾을 수 없습니다' };
  const out = { ok: true, id: rec.id, status: rec.status, contract: rec.contract, hash: rec.hash };
  if (rec.status === 'signed') {
    out.signedAt = rec.signedAt; out.signer = rec.signer; out.pdfUrl = rec.pdfUrl; out.sig = rec.sig || '';
  }
  return out;
}

// ── 서명 ────────────────────────────────────────────────
function signContract_(body) {
  const contract = body.contract;
  if (!contract) throw new Error('계약 내용이 없습니다');
  if (!body.sig || String(body.sig).indexOf('data:image/png;base64,') !== 0) throw new Error('서명 이미지가 없습니다');
  if (!body.signer || !body.signer.name) throw new Error('서명자 이름이 없습니다');

  let id = String(body.id || '').trim();
  let rec = id ? readRecord_(id) : null;
  if (rec && rec.status === 'signed' && !ALLOW_RESIGN) {
    return { ok: true, id: rec.id, pdfUrl: rec.pdfUrl, already: true };
  }
  if (!rec) { id = newId_(); rec = { id, status: 'pending', createdAt: new Date().toISOString(), contract }; }

  // 문서 확인 코드 재계산 (클라이언트가 보낸 hash 와 비교 → 기록)
  const serverHash = sha256_(JSON.stringify(stripApi_(contract)));
  const hashMatch  = !body.hash || body.hash === serverHash;

  const ts     = body.ts || new Date().toISOString();
  const title  = safe_(contract.ev && contract.ev.title) || '행사';
  const org    = safe_(contract.cl && contract.cl.org)   || '고객';
  const no     = safe_(contract.no) || id;
  const total  = calcTotal_(contract);

  // PDF 생성 (클라이언트가 렌더한 HTML 그대로 → PDF)
  const html   = String(body.html || '');
  const pdfName = ('계약서_' + no + '_' + org + '_' + title).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) + '.pdf';
  const year   = new Date().getFullYear();
  const folder = subFolder_(rootFolder_(), String(year));
  let pdfFile, pdfUrl = '';
  if (html) {
    const blob = Utilities.newBlob(html, 'text/html', pdfName.replace(/\.pdf$/, '.html')).getAs('application/pdf');
    blob.setName(pdfName);
    pdfFile = folder.createFile(blob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdfUrl = pdfFile.getUrl();
  }
  // 서명 이미지 원본도 보관
  const sigBytes = Utilities.base64Decode(String(body.sig).split(',')[1]);
  folder.createFile(Utilities.newBlob(sigBytes, 'image/png', ('서명_' + no + '_' + safe_(body.signer.name) + '.png')));

  // 레코드 갱신
  rec.status   = 'signed';
  rec.signedAt = ts;
  rec.signer   = { name: body.signer.name, tel: body.signer.tel || '', email: body.signer.email || '' };
  rec.hash     = serverHash;
  rec.clientHash = body.hash || '';
  rec.hashMatch  = hashMatch;
  rec.ua       = body.ua || '';
  rec.tz       = body.tz || '';
  rec.pdfUrl   = pdfUrl;
  rec.pdfId    = pdfFile ? pdfFile.getId() : '';
  rec.sig      = body.sig;         // 재열람 시 서명 표시용
  rec.contract = contract;
  writeRecord_(rec);

  // 메일 발송
  const to = body.to || {};
  const recipients = uniq_([COMPANY_EMAIL, to.company, to.customer, rec.signer.email].filter(isEmail_));
  const subject = body.subject || ('[' + COMPANY_NAME + '] 전자계약 체결 완료 — ' + title);
  const text = [
    '전자계약이 체결되었습니다.', '',
    '계약번호 : ' + no,
    '행사명   : ' + title,
    '계약자   : ' + org + ' / ' + rec.signer.name + (rec.signer.tel ? ' (' + rec.signer.tel + ')' : ''),
    '계약금액 : ' + total.toLocaleString('ko-KR') + '원 (부가세 포함)',
    '서명시각 : ' + kst_(ts) + ' (KST)',
    '문서확인 : ' + serverHash.slice(0, 32) + '…' + (hashMatch ? '' : '  ※ 클라이언트 해시 불일치'),
    '',
    pdfUrl ? '계약서 PDF : ' + pdfUrl : '(PDF 생성 안 됨)',
    '',
    '첨부된 PDF 를 보관해 주세요. 본 메일은 ' + COMPANY_NAME + ' 전자계약 시스템에서 자동 발송되었습니다.',
    COMPANY_NAME + ' · ' + safe_(contract.co && contract.co.tel) + ' · ' + safe_(contract.co && contract.co.email),
  ].join('\n');
  try {
    MailApp.sendEmail({ to: recipients.join(','), subject, body: text, name: COMPANY_NAME,
      attachments: pdfFile ? [pdfFile.getBlob()] : [] });
  } catch (err) {
    // 메일 실패해도 계약 자체는 성립 — 로그에 남김
    rec.mailError = String(err && err.message || err); writeRecord_(rec);
  }

  appendLog_({ id, status: '서명완료', contract, hash: serverHash, signer: rec.signer, signedAt: ts, pdfUrl, hashMatch });
  return { ok: true, id, pdfUrl, hash: serverHash, hashMatch, mailedTo: recipients };
}

// ── 대장(스프레드시트) ────────────────────────────────────
function appendLog_(o) {
  const ss = logSheet_();
  const c = o.contract || {}; const t = calcTotal_(c);
  ss.appendRow([
    new Date(), o.id, o.status,
    safe_(c.no), safe_(c.ev && c.ev.title), safe_(c.ev && c.ev.date), safe_(c.ev && c.ev.place),
    safe_(c.cl && c.cl.org), safe_(c.cl && c.cl.name), safe_(c.cl && c.cl.tel), safe_(c.cl && c.cl.email),
    t, o.signer ? safe_(o.signer.name) : '', o.signedAt || '', o.pdfUrl || '', o.hash || '', o.hashMatch === false ? '불일치' : '',
  ]);
}
function logSheet_() {
  const root = rootFolder_();
  const it = root.getFilesByType(MimeType.GOOGLE_SHEETS);
  let file = null;
  while (it.hasNext()) { const f = it.next(); if (f.getName() === SHEET_NAME) { file = f; break; } }
  let ss;
  if (file) ss = SpreadsheetApp.open(file);
  else {
    ss = SpreadsheetApp.create(SHEET_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(root);
    const sh = ss.getActiveSheet(); sh.setName('대장');
    sh.appendRow(['기록시각','문서ID','상태','계약번호','행사명','행사일','장소','갑 단체','갑 담당자','연락처','이메일','계약금액','서명자','서명시각','PDF','문서확인코드','비고']);
    sh.setFrozenRows(1); sh.getRange(1,1,1,17).setFontWeight('bold').setBackground('#F5F3EE');
  }
  return ss.getSheets()[0];
}

// ── 드라이브 유틸 ─────────────────────────────────────────
function rootFolder_() { return subFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME); }
function dataFolder_() { return subFolder_(rootFolder_(), '_data'); }
function subFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function readRecord_(id) {
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) return null;
  const it = dataFolder_().getFilesByName(id + '.json');
  if (!it.hasNext()) return null;
  try { return JSON.parse(it.next().getBlob().getDataAsString()); } catch (e) { return null; }
}
function writeRecord_(rec) {
  const it = dataFolder_().getFilesByName(rec.id + '.json');
  if (it.hasNext()) it.next().setContent(JSON.stringify(rec));
  else dataFolder_().createFile(rec.id + '.json', JSON.stringify(rec), 'application/json');
}

// ── 기타 유틸 ─────────────────────────────────────────────
function newId_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}
function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function stripApi_(c) { const o = JSON.parse(JSON.stringify(c)); delete o.api; return o; }
function calcTotal_(c) {
  const num = v => +String(v == null ? '' : v).replace(/[^0-9.-]/g, '') || 0;
  let supply = 0;
  (c.items || []).forEach(it => { if (it.price == null || it.price === '') return; supply += num(it.qty) * num(it.days || 1) * num(it.price); });
  const disc = Math.min(supply, num(c.m && c.m.disc));
  const base = supply - disc;
  return base + Math.round(base * 0.1);
}
function safe_(v) { return v == null ? '' : String(v); }
function kst_(iso) { try { return Utilities.formatDate(new Date(iso), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'); } catch (e) { return String(iso); } }
function isEmail_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '')); }
function uniq_(a) { return a.filter((v, i) => a.indexOf(v) === i); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
