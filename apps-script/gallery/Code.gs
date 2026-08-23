/**
 * 큰길이벤트기획 · 행사 사진 업로드 서버
 * ────────────────────────────────────────────────────────────
 * 구글 앱스 스크립트로 도는 작은 서버입니다. 하는 일은 셋:
 *
 *   1. 휴대폰이 보낸 웹용 사본(워터마크 포함) → 홈페이지 저장소의 photos 브랜치
 *   2. 사진 목록 → photos/photos.json 갱신 (갤러리가 이걸 읽습니다)
 *   3. 갤러리 다시 만들기 신호 (안 되면 6시간 안에 자동으로 됩니다)
 *
 * 설치 방법은 같은 폴더의 README.md 를 보세요.
 * 비밀번호·토큰은 이 파일에 적지 말고 「스크립트 속성」에 넣습니다.
 *
 * ※ 구글 드라이브는 쓰지 않습니다. 저장소에는 긴 변 1600px 사본만 올라가고,
 *   원본 사진은 휴대폰에만 남습니다.
 *
 * ※ 중요 — 사진은 main 이 아니라 photos 브랜치에 올라갑니다.
 *   갤러리(gallery.html)를 만드는 스크립트가 그 브랜치만 읽기 때문입니다.
 */

/* ══ 스크립트 속성에서 설정을 읽어온다 ══
   UPLOAD_PW      업로드 비밀번호 (본인만 아는 값)
   GITHUB_TOKEN   GitHub 토큰 (Contents 쓰기 권한)
   GITHUB_REPO    brizymedia/keungil-event                    */
function 설정(키) {
  const v = PropertiesService.getScriptProperties().getProperty(키);
  if (!v) throw new Error('스크립트 속성에 ' + 키 + ' 가 없습니다. README 2단계를 확인해 주세요.');
  return v;
}

const 브랜치   = 'photos';                     // 사진이 사는 브랜치 (main 아님)
const 저장경로 = 'photos';                     // 그 브랜치 안에서 사진이 쌓이는 폴더
const 목록파일 = 저장경로 + '/photos.json';

/* ══════════════════════════════════════════════════════════════
   0. 권한 받기

   "UrlFetchApp.fetch를 호출할 수 있는 권한이 없습니다" 가 뜰 때 씁니다.

   편집기 위쪽 함수 목록에서 이 함수(권한받기)를 고르고 「실행」 하세요.
   권한 요청 창이 뜨면 승인하시면 됩니다.
   그 뒤 「배포 → 배포 관리 → 연필 → 버전: 새 버전 → 배포」 를 해주세요.
══════════════════════════════════════════════════════════════ */
function 권한받기() {
  // 바깥 인터넷에 연결하는 권한 하나만 씁니다 (깃허브에 사진을 올릴 때)
  UrlFetchApp.fetch('https://api.github.com/rate_limit', { muteHttpExceptions: true });
  Logger.log('권한 확인 완료 — 이제 배포를 새 버전으로 다시 해주세요.');
}

/* ══════════════════════════════════════════════════════════════
   설치가 잘 됐는지 눈으로 보는 함수.
   편집기에서 실행하면 로그에 결과가 찍힙니다.
══════════════════════════════════════════════════════════════ */
function 점검() {
  const 속성 = PropertiesService.getScriptProperties();
  ['UPLOAD_PW', 'GITHUB_TOKEN', 'GITHUB_REPO'].forEach((k) => {
    Logger.log(k + ': ' + (속성.getProperty(k) ? '있음' : '── 없음 ──'));
  });
  try {
    const 목록 = 목록읽기();
    Logger.log('photos 브랜치 연결 정상 — 사진 ' + 목록.photos.length + '장, 항목 ' +
               목록.categories.length + '개');
  } catch (err) {
    Logger.log('photos 브랜치를 읽지 못했습니다: ' + err.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   1. 상태 확인 — 브라우저로 주소를 열면 이게 나옵니다.
══════════════════════════════════════════════════════════════ */
function doGet() {
  const 준비 = {};
  ['UPLOAD_PW', 'GITHUB_TOKEN', 'GITHUB_REPO'].forEach((k) => {
    준비[k] = !!PropertiesService.getScriptProperties().getProperty(k);
  });
  return 응답({ ok: true, 이름: '큰길이벤트기획 사진 업로드 서버', 브랜치: 브랜치, 설정완료: 준비 });
}

/* ══════════════════════════════════════════════════════════════
   2. 업로드 받기
══════════════════════════════════════════════════════════════ */
function doPost(e) {
  try {
    const 요청 = JSON.parse(e.postData.contents);

    if (요청.pw !== 설정('UPLOAD_PW')) {
      return 응답({ ok: false, error: '비밀번호가 다릅니다' });
    }

    if (요청.action === 'photo')  return 응답(사진저장(요청));
    if (요청.action === 'finish') return 응답(잠그고(function () { return 목록갱신(요청); }));
    if (요청.action === 'edit')   return 응답(잠그고(function () { return 정보수정(요청); }));
    if (요청.action === 'delete') return 응답(잠그고(function () { return 사진삭제(요청); }));

    return 응답({ ok: false, error: '알 수 없는 요청입니다: ' + 요청.action });

  } catch (err) {
    // 실패를 조용히 삼키지 않는다 — 화면에 그대로 보여준다
    return 응답({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* photos.json 은 읽고-고치고-쓰기 때문에 동시에 두 번 돌면 서로를 덮어쓴다.
   한 번에 하나만 들어가도록 잠근다. */
function 잠그고(일) {
  const 자물쇠 = LockService.getScriptLock();
  if (!자물쇠.tryLock(30000)) {
    return { ok: false, error: '다른 업로드가 처리 중입니다. 잠시 뒤 다시 눌러주세요.' };
  }
  try { return 일(); } finally { 자물쇠.releaseLock(); }
}

/* ══════════════════════════════════════════════════════════════
   3. 사진 한 장 저장
══════════════════════════════════════════════════════════════ */
function 사진저장(요청) {
  const 행사 = 요청.event || {};
  const 분류 = 슬러그(요청.cat);
  if (!분류) return { ok: false, error: '갤러리 항목(cat)이 없습니다. 업로드 페이지를 새로고침해 주세요.' };

  // 파일명에 eventId 를 넣어 두면 목록을 뒤지지 않아도 절대 겹치지 않는다
  const 번호  = ('00' + (Number(요청.index) + 1)).slice(-3);
  const 파일명 = (요청.eventId || '무제') + '-' + 번호 + '.jpg';
  const 경로   = 저장경로 + '/' + 분류 + '/' + 파일명;

  // 웹용 사본 → 홈페이지 저장소 (photos 브랜치)
  const 결과 = 깃허브에올리기(경로, 요청.web, '사진 추가: ' + (행사.name || '행사') + ' ' + 파일명);
  if (!결과.ok) return 결과;

  return { ok: true, path: 경로 };
}

/* 갤러리 폴더 이름으로 쓸 수 있는 글자만 남긴다 */
function 슬러그(값) {
  return String(값 || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/* ══════════════════════════════════════════════════════════════
   4. 사진 목록(photos.json) 갱신
══════════════════════════════════════════════════════════════ */
function 목록갱신(요청) {
  const 지금 = 목록읽기();
  const 이미있음 = {};
  지금.photos.forEach((p) => { 이미있음[p.path] = true; });

  let 추가 = 0;
  (요청.photos || []).forEach((p) => {
    if (!p || !p.path || 이미있음[p.path]) return;   // 두 번 눌러도 중복되지 않게
    지금.photos.unshift(p);                          // 새 사진이 앞으로
    이미있음[p.path] = true;
    추가++;
  });

  if (추가 === 0) return { ok: true, added: 0 };

  항목확인(지금, 요청.cat);                          // 처음 쓰는 항목이면 갤러리 칸을 만든다
  개수맞추기(지금);

  const 결과 = 목록쓰기(지금, '사진 목록 갱신 (' + 추가 + '장)');
  if (!결과.ok) return 결과;

  const 신호 = 갤러리다시만들기();
  return { ok: true, added: 추가, total: 지금.photos.length, 갤러리갱신: 신호 };
}

/* ── 행사 정보 고치기 ── */
function 정보수정(요청) {
  const 옛 = 요청.old || {};
  const 새 = 요청['new'] || {};
  if (!새.event) return { ok: false, error: '행사명은 비울 수 없습니다' };

  const 지금 = 목록읽기();
  let 바뀜 = 0;
  지금.photos.forEach((p) => {
    if ((p.event || '') !== (옛.event || '') || (p.date || '') !== (옛.date || '')) return;
    p.event   = 새.event;
    p.date    = 새.date || '';
    p.place   = 새.place || '';
    p.desc    = 새.desc || '';
    p.caption = 새.event;
    바뀜++;
  });

  if (!바뀜) return { ok: false, error: '고칠 사진을 찾지 못했습니다. 목록을 다시 불러와 주세요.' };

  const 결과 = 목록쓰기(지금, '행사 정보 수정: ' + 새.event + ' (' + 바뀜 + '장)');
  if (!결과.ok) return 결과;

  갤러리다시만들기();
  return { ok: true, changed: 바뀜 };
}

/* ── 사진 지우기 ── */
function 사진삭제(요청) {
  const 대상 = (요청.paths || []).filter(function (p) { return !!p; });
  if (!대상.length) return { ok: false, error: '지울 사진이 없습니다' };

  let 지움 = 0;
  const 못지운것 = [];
  대상.forEach((경로) => {
    const 답 = 깃허브에서지우기(경로);
    if (답.ok || 답.없음) 지움++;             // 이미 없는 파일은 지워진 걸로 친다
    else 못지운것.push(경로.split('/').pop());
  });

  // 목록에서는 요청받은 것을 모두 뺀다 (파일이 남아 있어도 갤러리에는 안 보이게)
  const 버릴것 = {};
  대상.forEach((p) => { 버릴것[p] = true; });
  const 지금 = 목록읽기();
  const 남은것 = 지금.photos.filter((p) => !버릴것[p.path]);
  지금.photos = 남은것;
  개수맞추기(지금);

  const 결과 = 목록쓰기(지금, '사진 삭제 (' + 지움 + '장)');
  if (!결과.ok) return 결과;

  갤러리다시만들기();
  return {
    ok: true,
    deleted: 지움,
    남은문제: 못지운것.length ? (못지운것.length + '장은 저장소에서 못 지웠습니다: ' +
                                 못지운것.slice(0, 3).join(', ')) : '',
  };
}

/* ── 항목(카테고리)이 없으면 만든다 ── */
function 항목확인(목록, 항목) {
  if (!항목 || !항목.slug) return;
  const slug = 슬러그(항목.slug);
  if (!slug) return;
  const 있음 = 목록.categories.some((c) => c.slug === slug);
  if (있음) return;
  목록.categories.push({
    slug: slug,
    name: 항목.name || slug,
    desc: 항목.desc || '',
    count: 0,
  });
}

/* ── 항목별 사진 수를 실제 사진에서 다시 센다 ──
   지우거나 더한 뒤에도 숫자가 어긋나지 않게. count 가 0 이면 갤러리에서 칸이 사라진다. */
function 개수맞추기(목록) {
  const 셈 = {};
  목록.photos.forEach((p) => {
    const c = p.cat;
    if (!c) return;
    셈[c] = (셈[c] || 0) + 1;
  });
  목록.categories.forEach((c) => { c.count = 셈[c.slug] || 0; });
}

/* ══════════════════════════════════════════════════════════════
   5. photos.json 읽기 · 쓰기
══════════════════════════════════════════════════════════════ */
function 목록읽기() {
  const 응 = 깃허브(목록파일, 'get');
  if (응.getResponseCode() === 404) return { updated: '', categories: [], photos: [] };
  try {
    const 내용 = JSON.parse(응.getContentText());
    const 글   = Utilities.newBlob(Utilities.base64Decode(내용.content)).getDataAsString();
    const 값   = JSON.parse(글);
    return {
      updated:    값.updated || '',
      categories: Array.isArray(값.categories) ? 값.categories : [],
      photos:     Array.isArray(값.photos) ? 값.photos : [],
    };
  } catch (err) {
    // 여기서 빈 목록을 돌려주면 기존 사진이 전부 날아간다. 차라리 멈춘다.
    throw new Error('photos.json 을 읽지 못했습니다: ' + err.message);
  }
}

function 목록쓰기(목록, 메모) {
  목록.updated = new Date().toISOString();
  const 본문 = Utilities.base64Encode(
    Utilities.newBlob(JSON.stringify(목록, null, 1)).getBytes()
  );
  return 깃허브에올리기(목록파일, 본문, 메모);
}

/* ══════════════════════════════════════════════════════════════
   6. 깃허브 파일 읽기 · 쓰기 · 지우기  (전부 photos 브랜치)
══════════════════════════════════════════════════════════════ */
function 깃허브(경로, 방법, 본문) {
  // 읽기는 ?ref= 로, 쓰기·지우기는 본문의 branch 로 브랜치를 정한다
  const 주소 = 'https://api.github.com/repos/' + 설정('GITHUB_REPO') + '/contents/' + 경로 +
               (방법 === 'get' ? '?ref=' + 브랜치 + '&t=' + Date.now() : '');
  return UrlFetchApp.fetch(주소, {
    method: 방법,
    headers: {
      Authorization: 'Bearer ' + 설정('GITHUB_TOKEN'),
      Accept: 'application/vnd.github+json',
      'User-Agent': 'keungil-photo-uploader',
    },
    contentType: 'application/json',
    payload: 본문 ? JSON.stringify(본문) : undefined,
    muteHttpExceptions: true,
  });
}

function 깃허브에올리기(경로, base64, 메모) {
  const 본문 = { message: 메모, content: base64, branch: 브랜치 };

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
  if (기존.getResponseCode() === 404) return { ok: false, 없음: true };

  let sha = '';
  try { sha = JSON.parse(기존.getContentText()).sha; } catch (err) { /* 무시 */ }
  if (!sha) return { ok: false, error: '파일 정보를 읽지 못했습니다' };

  const 응 = 깃허브(경로, 'delete', {
    message: '사진 삭제: ' + 경로.split('/').pop(),
    sha: sha,
    branch: 브랜치,
  });
  if (응.getResponseCode() === 200) return { ok: true };
  return { ok: false, error: 사유읽기(응) };
}

function 사유읽기(응) {
  let 사유 = 응.getContentText();
  try { 사유 = JSON.parse(사유).message || 사유; } catch (err) { /* 그대로 */ }
  return 사유;
}

/* ══════════════════════════════════════════════════════════════
   7. 갤러리 다시 만들기 신호

   gallery.html 은 photos.json 을 읽어 만들어 두는 정적 파일입니다.
   이 신호를 보내면 1~2분 안에 갤러리가 갱신되고,
   실패해도 6시간마다 도는 자동 작업이 어차피 해줍니다. (그래서 실패해도 안 멈춥니다)
══════════════════════════════════════════════════════════════ */
function 갤러리다시만들기() {
  try {
    const 응 = UrlFetchApp.fetch(
      'https://api.github.com/repos/' + 설정('GITHUB_REPO') + '/dispatches',
      {
        method: 'post',
        headers: {
          Authorization: 'Bearer ' + 설정('GITHUB_TOKEN'),
          Accept: 'application/vnd.github+json',
          'User-Agent': 'keungil-photo-uploader',
        },
        contentType: 'application/json',
        payload: JSON.stringify({ event_type: 'photos-updated' }),
        muteHttpExceptions: true,
      }
    );
    const 코드 = 응.getResponseCode();
    if (코드 === 204) return '요청함 (1~2분 뒤 갤러리에 반영)';
    return '자동 갱신 대기 (' + 코드 + ')';
  } catch (err) {
    return '자동 갱신 대기';
  }
}

/* ══ 공통 응답 ══ */
function 응답(값) {
  return ContentService
    .createTextOutput(JSON.stringify(값))
    .setMimeType(ContentService.MimeType.JSON);
}
