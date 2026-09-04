/**
 * 큰길이벤트기획 — 전자명함 서버 (Google Apps Script)
 *
 * card/index.html 에서 「명함 발행하기」를 누르면 여기로 옵니다.
 * 받은 것을 깃허브 main 브랜치에 파일로 써 넣습니다. 그러면 깃허브 페이지가
 * 1~2분 안에 올려주고, 짧은 주소로 열립니다.
 *
 *   card/{주소}/index.html   완성된 명함 (og 태그가 박혀 있어 카톡 미리보기가 뜬다)
 *   card/img/{주소}.jpg      명함 안에 보이는 사진
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
    const r = 깃허브에올리기('card/img/' + 주소 + '.jpg', 요청.photo, '명함 사진: ' + 주소);
    if (!r.ok) return r;
  }
  if (요청.og) {
    const r = 깃허브에올리기('card/og/' + 주소 + '.jpg', 요청.og, '명함 미리보기: ' + 주소);
    if (!r.ok) return r;
  }

  const r = 깃허브에올리기('card/' + 주소 + '/index.html', base64(요청.html), '명함 발행: ' + 주소);
  if (!r.ok) return r;

  return { ok: true, slug: 주소 };
}

function 명함삭제(요청) {
  const 주소 = String(요청.slug || '').toLowerCase();
  if (!주소틀.test(주소)) return { ok: false, error: '주소가 이상합니다' };

  const 결과 = ['card/' + 주소 + '/index.html', 'card/img/' + 주소 + '.jpg', 'card/og/' + 주소 + '.jpg']
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
  return ['img', 'og', 'index', 'admin', 'api', 'new', 'card'].indexOf(주소) >= 0;
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

/** 설치가 제대로 됐는지 여기서 한 번 눌러 보세요 */
function 설치확인() {
  ['UPLOAD_PW', 'GITHUB_TOKEN', 'GITHUB_REPO'].forEach(function (k) {
    const v = PropertiesService.getScriptProperties().getProperty(k);
    Logger.log(k + ' : ' + (v ? '있음' : '★ 비어 있음'));
  });
  const 응 = 깃허브('card', 'get');
  Logger.log('깃허브 응답 : ' + 응.getResponseCode() + ' (200 이나 404 면 정상)');
}
