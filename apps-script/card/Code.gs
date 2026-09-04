/**
 * 큰길이벤트기획 — 전자명함 서버 (Google Apps Script)
 *
 * card/index.html 에서 「명함 발행하기」를 누르면 여기로 옵니다.
 * 받은 것을 깃허브 main 브랜치에 파일로 써 넣습니다. 그러면 깃허브 페이지가
 * 1~2분 안에 올려주고, 짧은 주소로 열립니다.
 *
 *   card/{주소}/index.html   완성된 명함 (og 태그가 박혀 있어 카톡 미리보기가 뜬다)
 *   card/img/{주소}.jpg      인물 사진 (작은 동그라미)
 *   card/bg/{주소}.jpg       배경 사진 (크게 깔린다)
 *   card/og/{주소}.jpg       카톡·문자 미리보기용 1200×630
 *
 * ── 설치 ────────────────────────────────────────────────
 * 1. script.google.com → 새 프로젝트 → 이 파일 내용을 붙여넣기
 * 2. 프로젝트 설정 → 스크립트 속성에 세 가지를 넣습니다
 *      UPLOAD_PW      명함을 발행할 때 넣을 비밀번호 (아무 문자열)
 *      GITHUB_TOKEN   깃허브 토큰 (Contents 쓰기 권한)
 *      GITHUB_REPO    brizymedia/keungil-event
 *    ※ 갤러리 스크립트에 넣어둔 값과 같은 것을 쓰면 됩니다.
 * 3. 배포 → 새 배포 → 웹 앱
 *      실행 사용자: 나
 *      액세스 권한: 모든 사용자
 * 4. 나온 주소를 card/index.html 의 서버 칸에 한 번 넣으면 기억합니다.
 *
 * 토큰은 절대 이 파일에 적지 마세요. 스크립트 속성에만 둡니다.
 */

const 브랜치 = 'main';          // 깃허브 페이지가 보고 있는 브랜치
const 주소틀 = /^[a-z0-9][a-z0-9-]{1,38}$/;   // 명함 주소로 쓸 수 있는 글자

/* ══════════════════════════════════════════════════════════════
   진입점
══════════════════════════════════════════════════════════════ */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.check) return 응답(쓸수있나(p.check));
  return 응답({ ok: true, service: 'keungil-card', version: 1 });
}

function doPost(e) {
  try {
    const 요청 = JSON.parse(e.postData.contents);

    if (요청.pw !== 설정('UPLOAD_PW')) {
      return 응답({ ok: false, error: '비밀번호가 다릅니다' });
    }

    if (요청.action === 'card')   return 응답(잠그고(function () { return 명함발행(요청); }));
    if (요청.action === 'delete') return 응답(잠그고(function () { return 명함삭제(요청); }));

    return 응답({ ok: false, error: '알 수 없는 요청입니다: ' + 요청.action });

  } catch (err) {
    // 실패를 조용히 삼키지 않는다 — 화면에 그대로 보여준다
    return 응답({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ══════════════════════════════════════════════════════════════
   명함 발행
══════════════════════════════════════════════════════════════ */
function 명함발행(요청) {
  const 주소 = String(요청.slug || '').toLowerCase();
  if (!주소틀.test(주소)) {
    return { ok: false, error: '명함 주소는 영문 소문자·숫자·하이픈으로 2~39자여야 합니다' };
  }
  if (막힌주소(주소)) {
    return { ok: false, error: '「' + 주소 + '」 는 쓸 수 없는 주소입니다. 다른 것으로 해주세요' };
  }
  if (!요청.html || String(요청.html).length < 200) {
    return { ok: false, error: '명함 내용이 비어 있습니다' };
  }
  if (String(요청.html).length > 400000) {
    return { ok: false, error: '명함이 너무 큽니다' };
  }

  // 사진부터 올린다. 사진이 없는 채로 명함이 먼저 뜨면 깨져 보인다.
  if (요청.photo) {
    const r = 깃허브에올리기('card/img/' + 주소 + '.jpg', 요청.photo, '명함 인물: ' + 주소);
    if (!r.ok) return r;
  }
  if (요청.bg) {
    const r = 깃허브에올리기('card/bg/' + 주소 + '.jpg', 요청.bg, '명함 배경: ' + 주소);
    if (!r.ok) return r;
  }
  if (요청.og) {
    const r = 깃허브에올리기('card/og/' + 주소 + '.jpg', 요청.og, '명함 미리보기: ' + 주소);
    if (!r.ok) return r;
  }

  const r = 깃허브에올리기('card/' + 주소 + '/index.html', base64(요청.html), '명함 발행: ' + 주소);
  if (!r.ok) return r;

  // 명단 — 누가 명함을 만들었는지 시트에 남긴다. 여기서 실패해도 발행은 된 것이다.
  let 명단 = null;
  if (요청.lead) {
    try { 명단 = 명단남기기(요청.lead, 주소); }
    catch (err) { 명단 = { ok: false, error: String(err && err.message ? err.message : err) }; }
  }

  return { ok: true, slug: 주소, lead: 명단 };
}

function 명함삭제(요청) {
  const 주소 = String(요청.slug || '').toLowerCase();
  if (!주소틀.test(주소)) return { ok: false, error: '주소가 이상합니다' };

  const 결과 = ['card/' + 주소 + '/index.html', 'card/img/' + 주소 + '.jpg',
                'card/bg/' + 주소 + '.jpg', 'card/og/' + 주소 + '.jpg']
    .map(function (경로) { return 깃허브에서지우기(경로); });

  const 지운것 = 결과.filter(function (r) { return r.ok; }).length;
  if (!지운것) return { ok: false, error: '지울 것이 없습니다' };
  return { ok: true, 지움: 지운것 };
}

/** 이미 쓰이고 있는 주소인지 미리 본다 (발행 전에 알려주려고) */
function 쓸수있나(주소) {
  주소 = String(주소 || '').toLowerCase();
  if (!주소틀.test(주소)) return { ok: false, error: '쓸 수 없는 글자가 있습니다' };
  if (막힌주소(주소))    return { ok: false, error: '이미 쓰이는 주소입니다' };
  const 응 = 깃허브('card/' + 주소 + '/index.html', 'get');
  return { ok: true, 있음: 응.getResponseCode() === 200 };
}

/** 사이트가 이미 쓰고 있는 이름은 명함 주소로 내주면 안 된다 */
function 막힌주소(주소) {
  return ['img', 'bg', 'og', 'index', 'admin', 'api', 'new', 'card'].indexOf(주소) >= 0;
}

/* ══════════════════════════════════════════════════════════════
   깃허브 파일 쓰기 · 지우기  (전부 main 브랜치)
══════════════════════════════════════════════════════════════ */
function 깃허브(경로, 방법, 본문) {
  const 주소 = 'https://api.github.com/repos/' + 설정('GITHUB_REPO') + '/contents/' + 경로 +
               (방법 === 'get' ? '?ref=' + 브랜치 + '&t=' + Date.now() : '');
  return UrlFetchApp.fetch(주소, {
    method: 방법,
    headers: {
      Authorization: 'Bearer ' + 설정('GITHUB_TOKEN'),
      Accept: 'application/vnd.github+json',
      'User-Agent': 'keungil-card',
    },
    contentType: 'application/json',
    payload: 본문 ? JSON.stringify(본문) : undefined,
    muteHttpExceptions: true,
  });
}

function 깃허브에올리기(경로, base64내용, 메모) {
  const 본문 = { message: 메모, content: base64내용, branch: 브랜치 };

  // 이미 있는 파일이면 sha 를 같이 보내야 덮어쓸 수 있다
  const 기존 = 깃허브(경로, 'get');
  if (기존.getResponseCode() === 200) {
    try { 본문.sha = JSON.parse(기존.getContentText()).sha; } catch (err) { /* 무시 */ }
  }

  const 응   = 깃허브(경로, 'put', 본문);
  const 코드 = 응.getResponseCode();
  if (코드 === 200 || 코드 === 201) return { ok: true };
  return { ok: false, error: '깃허브 저장 실패 (' + 코드 + ') ' + 사유읽기(응) };
}

function 깃허브에서지우기(경로) {
  const 기존 = 깃허브(경로, 'get');
  if (기존.getResponseCode() !== 200) return { ok: false, 없음: true };

  let sha = '';
  try { sha = JSON.parse(기존.getContentText()).sha; } catch (err) { /* 무시 */ }
  if (!sha) return { ok: false, error: '파일 정보를 읽지 못했습니다' };

  const 응 = 깃허브(경로, 'delete', { message: '명함 삭제: ' + 경로, sha: sha, branch: 브랜치 });
  return 응.getResponseCode() === 200 ? { ok: true } : { ok: false, error: 사유읽기(응) };
}

/* ══════════════════════════════════════════════════════════════
   자잘한 것들
══════════════════════════════════════════════════════════════ */
function base64(글) {
  return Utilities.base64Encode(Utilities.newBlob(글, 'text/html').getBytes());
}

function 설정(키) {
  const v = PropertiesService.getScriptProperties().getProperty(키);
  if (!v) throw new Error('스크립트 속성 ' + 키 + ' 가 비어 있습니다');
  return v;
}

/** 같은 주소에 두 사람이 동시에 발행하면 하나가 사라진다. 순서대로 처리한다. */
function 잠그고(일) {
  const 자물쇠 = LockService.getScriptLock();
  try { 자물쇠.waitLock(25000); } catch (err) {
    return { ok: false, error: '다른 발행이 진행 중입니다. 잠시 뒤 다시 눌러주세요' };
  }
  try { return 일(); } finally { try { 자물쇠.releaseLock(); } catch (err) { /* 무시 */ } }
}

function 사유읽기(응) {
  let 사유 = 응.getContentText();
  try { 사유 = JSON.parse(사유).message || 사유; } catch (err) { /* 그대로 */ }
  return 사유;
}

function 응답(값) {
  return ContentService.createTextOutput(JSON.stringify(값))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ══════════════════════════════════════════════════════════════
   설치할 때 한 번씩 눌러보는 것들 (갤러리 스크립트와 같은 이름)
══════════════════════════════════════════════════════════════ */

function 권한받기() {
  // 바깥 인터넷에 연결하는 권한 하나만 씁니다 (깃허브에 명함을 올릴 때)
  UrlFetchApp.fetch('https://api.github.com/rate_limit', { muteHttpExceptions: true });
  Logger.log('권한 확인 완료 — 이제 배포를 새 버전으로 다시 해주세요.');
}

function 점검() {
  const 속성 = PropertiesService.getScriptProperties();
  ['UPLOAD_PW', 'GITHUB_TOKEN', 'GITHUB_REPO'].forEach(function (k) {
    Logger.log(k + ': ' + (속성.getProperty(k) ? '있음' : '── 없음 ──'));
  });
  try {
    const 응 = 깃허브('card', 'get');
    const 코드 = 응.getResponseCode();
    if (코드 === 200) {
      let n = 0;
      try { n = JSON.parse(응.getContentText()).length; } catch (err) { /* 무시 */ }
      Logger.log('깃허브 연결 정상 — card 폴더에 ' + n + '개 있습니다');
    } else if (코드 === 404) {
      Logger.log('깃허브 연결 정상 — card 폴더는 아직 비어 있습니다 (처음이면 맞습니다)');
    } else {
      Logger.log('깃허브가 거절했습니다 (' + 코드 + ') ' + 사유읽기(응));
    }
  } catch (err) {
    Logger.log('깃허브를 읽지 못했습니다: ' + err.message);
  }
}


/* ══════════════════════════════════════════════════════════════
   이벤트인 명단 — 명함을 만든 사람을 「이벤트 코리아 / 이벤트인 명단」 시트에 남긴다.
   이벤트 코리아 명단 서버와 같은 폴더·같은 파일 이름을 쓰므로 한 시트에 모인다.
   (둘 다 형님 계정으로 돌아가니 같은 드라이브다)
   열: 등록시각 · 이름 · 전화 · 직군 · 지역 · 출처 · 문자동의 · 최근활동 · 메모 · 마지막문자
══════════════════════════════════════════════════════════════ */
const 명단폴더 = '이벤트 코리아';
const 명단파일 = '이벤트인 명단';

function 명단남기기(l, slug) {
  const 이름 = 다듬기_(l.name, 40), 전화 = 전화정리_(l.tel), 직군 = 다듬기_(l.job, 30);
  const 동의 = l.consent === true || l.consent === 'Y' ? 'Y' : 'N';
  const 메모 = 다듬기_((l.co ? l.co + ' · ' : '') + '명함 ' + slug, 200);
  if (!전화 || !이름) return { ok: false, error: '이름·휴대폰이 없어 명단에는 남기지 않음' };

  const sh = 명단시트_();
  const 끝 = sh.getLastRow();
  if (끝 >= 2) {
    const 값 = sh.getRange(2, 1, 끝 - 1, 10).getValues();
    for (let i = 0; i < 값.length; i++) {
      if (String(값[i][2]) === 전화) {
        const 줄 = i + 2;
        let 출처들 = String(값[i][5] || '');
        if (출처들.indexOf('명함') < 0) 출처들 = 출처들 ? 출처들 + ' · 명함' : '명함';
        sh.getRange(줄, 2).setValue(이름);
        if (직군) sh.getRange(줄, 4).setValue(직군);
        sh.getRange(줄, 6).setValue(출처들);
        if (동의 === 'Y') sh.getRange(줄, 7).setValue('Y');
        sh.getRange(줄, 8).setValue(new Date());
        sh.getRange(줄, 9).setValue(메모);
        return { ok: true, new: false };
      }
    }
  }
  sh.appendRow([new Date(), 이름, 전화, 직군, '', '명함', 동의, new Date(), 메모, '']);
  return { ok: true, new: true };
}

function 명단시트_() {
  const 폴더 = (function () {
    const 뿌리 = DriveApp.getRootFolder(), it = 뿌리.getFoldersByName(명단폴더);
    return it.hasNext() ? it.next() : 뿌리.createFolder(명단폴더);
  })();
  let ss = null;
  const it = 폴더.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) { const f = it.next(); if (f.getName() === 명단파일) { ss = SpreadsheetApp.open(f); break; } }
  if (!ss) { ss = SpreadsheetApp.create(명단파일); DriveApp.getFileById(ss.getId()).moveTo(폴더); }
  let sh = ss.getSheetByName('명단');
  if (sh) return sh;
  sh = ss.insertSheet('명단');
  sh.appendRow(['등록시각', '이름', '전화', '직군', '지역', '출처', '문자동의', '최근활동', '메모', '마지막문자']);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#E1EAE2');
  const 기본 = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (기본 && ss.getSheets().length > 1) { try { ss.deleteSheet(기본); } catch (err) { /* 무시 */ } }
  return sh;
}

function 다듬기_(v, 길이) { if (v === null || v === undefined) return ''; return String(v).replace(/[\r\n\t]/g, ' ').trim().slice(0, 길이); }

/* 010-1234-5678 · +82 10 1234 5678 → 01012345678. 휴대폰이 아니면 빈 값 */
function 전화정리_(v) {
  let d = String(v || '').replace(/[^0-9]/g, '');
  if (d.indexOf('8210') === 0) d = '0' + d.slice(2);
  return /^01[016789][0-9]{7,8}$/.test(d) ? d : '';
}
