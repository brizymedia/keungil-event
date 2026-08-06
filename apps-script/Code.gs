/**
 * YM토탈이벤트 · 행사 사진 업로드 서버
 * ────────────────────────────────────────────────────────────
 * 구글 앱스 스크립트로 도는 아주 작은 서버입니다. 하는 일은 셋:
 *
 *   1. 원본 사진  →  구글 드라이브 (행사별 폴더를 자동으로 만듭니다)
 *   2. 웹용 축소본 →  홈페이지 저장소 (갤러리에서 빨리 뜨게)
 *   3. 사진 목록  →  photos.json 갱신 (갤러리가 이걸 읽습니다)
 *
 * 설치 방법은 같은 폴더의 README.md 를 보세요.
 * 비밀번호·토큰은 이 파일에 적지 말고 「스크립트 속성」에 넣습니다.
 */

/* ══ 스크립트 속성에서 설정을 읽어온다 ══
   UPLOAD_PW      업로드 비밀번호 (본인만 아는 값)
   GITHUB_TOKEN   GitHub 토큰 (Contents 쓰기 권한)
   GITHUB_REPO    brizymedia/keungil-event
   DRIVE_FOLDER   원본을 모아둘 구글 드라이브 폴더 ID          */
function 설정(키) {
  const v = PropertiesService.getScriptProperties().getProperty(키);
  if (!v) throw new Error('스크립트 속성에 ' + 키 + ' 가 없습니다. README 3단계를 확인해 주세요.');
  return v;
}

const 저장경로 = 'photos';                    // 저장소 안에서 사진이 쌓이는 폴더
const 목록파일 = 저장경로 + '/photos.json';

/* 사진은 main 이 아니라 photos 브랜치에 쌓습니다.
   main 에 넣으면 사진 한 장을 올릴 때마다 홈페이지 배포가 한 번씩 돌아
   배포 대기열이 막힙니다. (16장 올리면 배포가 17번 도는 셈)
   photos 브랜치는 배포와 무관하고, 갤러리는 이 브랜치에서 바로 읽습니다. */
const 저장브랜치 = 'photos';

/* ══════════════════════════════════════════════════════════════
   0. 권한 받기

   "UrlFetchApp.fetch를 호출할 수 있는 권한이 없습니다" 가 뜰 때 씁니다.

   편집기 위쪽 함수 목록에서 이 함수(권한받기)를 고르고 「실행」 하세요.
   권한 요청 창이 뜨면 승인하시면 됩니다.
   그 뒤 「배포 → 배포 관리 → 연필 → 버전: 새 버전 → 배포」 를 해주세요.
══════════════════════════════════════════════════════════════ */
function 권한받기() {
  // 바깥 인터넷에 연결하는 권한 (깃허브에 사진을 올릴 때 씁니다)
  UrlFetchApp.fetch('https://api.github.com/rate_limit', { muteHttpExceptions: true });
  // 드라이브에 폴더와 파일을 만드는 권한 (원본 보관에 씁니다)
  DriveApp.getRootFolder().getName();
  Logger.log('권한 확인 완료 — 이제 배포를 새 버전으로 다시 해주세요.');
}

/* ══════════════════════════════════════════════════════════════
   1. 상태 확인 — 브라우저로 주소를 열면 이게 나옵니다.
      설치가 잘 됐는지 눈으로 보려고 만든 것입니다.
══════════════════════════════════════════════════════════════ */
function doGet() {
  const 준비 = {};
  ['UPLOAD_PW', 'GITHUB_TOKEN', 'GITHUB_REPO', 'DRIVE_FOLDER'].forEach((k) => {
    준비[k] = !!PropertiesService.getScriptProperties().getProperty(k);
  });
  return 응답({ ok: true, 이름: 'YM 사진 업로드 서버', 설정완료: 준비 });
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
    if (요청.action === 'finish') return 응답(목록갱신(요청));

    return 응답({ ok: false, error: '알 수 없는 요청입니다: ' + 요청.action });

  } catch (err) {
    // 실패를 조용히 삼키지 않는다 — 화면에 그대로 보여준다
    return 응답({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ── 사진 한 장 저장 ── */
function 사진저장(요청) {
  const 행사 = 요청.event || {};
  const 번호 = ('00' + (요청.index + 1)).slice(-3);
  const 파일명 = 번호 + '.jpg';
  const 경로 = 저장경로 + '/' + 요청.eventId + '/' + 파일명;

  // (1) 웹용 축소본 → 홈페이지 저장소
  const 결과 = 깃허브에올리기(경로, 요청.web, '사진 추가: ' + (행사.name || '행사') + ' ' + 파일명);
  if (!결과.ok) return 결과;

  // (2) 원본 → 구글 드라이브 (보내온 경우에만)
  let 드라이브 = '';
  if (요청.orig) {
    try {
      const 폴더 = 행사폴더(행사);
      const blob = Utilities.newBlob(Utilities.base64Decode(요청.orig), 'image/jpeg',
                                     (요청.origName || 파일명));
      드라이브 = 폴더.createFile(blob).getId();
    } catch (err) {
      // 원본 백업이 실패해도 사진 자체는 이미 올라갔다. 사실대로 알려준다.
      return { ok: true, path: 경로, 원본경고: '원본 백업 실패: ' + err.message };
    }
  }
  return { ok: true, path: 경로, drive: 드라이브 };
}

/* ── 행사별 드라이브 폴더 (없으면 만든다) ── */
function 행사폴더(행사) {
  const 뿌리 = DriveApp.getFolderById(설정('DRIVE_FOLDER'));
  const 이름 = (행사.date || '날짜미정') + ' ' + (행사.name || '행사');
  const 있는것 = 뿌리.getFoldersByName(이름);
  return 있는것.hasNext() ? 있는것.next() : 뿌리.createFolder(이름);
}

/* ── 사진 목록(photos.json) 갱신 ── */
function 목록갱신(요청) {
  const 지금 = 목록읽기();
  const 이미있음 = {};
  지금.photos.forEach((p) => { 이미있음[p.path] = true; });

  let 추가 = 0;
  (요청.photos || []).forEach((p) => {
    if (이미있음[p.path]) return;      // 두 번 눌러도 중복되지 않게
    지금.photos.unshift(p);            // 새 사진이 앞으로
    추가++;
  });

  if (추가 === 0) return { ok: true, added: 0 };

  const 본문 = Utilities.base64Encode(
    Utilities.newBlob(JSON.stringify(지금, null, 1)).getBytes()
  );
  const 결과 = 깃허브에올리기(목록파일, 본문, '사진 목록 갱신 (' + 추가 + '장)');
  if (!결과.ok) return 결과;
  return { ok: true, added: 추가, total: 지금.photos.length };
}

function 목록읽기() {
  const 응 = 깃허브(목록파일, 'get');
  if (응.getResponseCode() === 404) return { photos: [] };
  try {
    const 내용 = JSON.parse(응.getContentText());
    const 글 = Utilities.newBlob(Utilities.base64Decode(내용.content)).getDataAsString();
    const 값 = JSON.parse(글);
    return (값 &&값.photos) ? 값 : { photos: [] };
  } catch (err) {
    return { photos: [] };
  }
}

/* ══════════════════════════════════════════════════════════════
   3. 깃허브 파일 쓰기
══════════════════════════════════════════════════════════════ */
function 깃허브(경로, 방법, 본문) {
  return UrlFetchApp.fetch(
    'https://api.github.com/repos/' + 설정('GITHUB_REPO') + '/contents/' + 경로 +
      (방법 === 'get' ? '?ref=' + 저장브랜치 : ''),
    {
      method: 방법,
      headers: {
        Authorization: 'Bearer ' + 설정('GITHUB_TOKEN'),
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ym-photo-uploader',
      },
      contentType: 'application/json',
      payload: 본문 ? JSON.stringify(본문) : undefined,
      muteHttpExceptions: true,
    }
  );
}

function 깃허브에올리기(경로, base64, 메모) {
  const 본문 = { message: 메모, content: base64, branch: 저장브랜치 };

  // 이미 있는 파일이면 sha 를 같이 보내야 덮어쓸 수 있다
  const 기존 = 깃허브(경로, 'get');
  if (기존.getResponseCode() === 200) {
    try { 본문.sha = JSON.parse(기존.getContentText()).sha; } catch (err) { /* 무시 */ }
  }

  const 응 = 깃허브(경로, 'put', 본문);
  const 코드 = 응.getResponseCode();
  if (코드 === 200 || 코드 === 201) return { ok: true };

  let 사유 = 응.getContentText();
  try { 사유 = JSON.parse(사유).message || 사유; } catch (err) { /* 그대로 */ }
  return { ok: false, error: '깃허브 저장 실패 (' + 코드 + ') ' + 사유 };
}

/* ══ 공통 응답 ══ */
function 응답(값) {
  return ContentService
    .createTextOutput(JSON.stringify(값))
    .setMimeType(ContentService.MimeType.JSON);
}
