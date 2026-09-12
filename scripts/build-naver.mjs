/* 네이버 블로그용 원고 페이지 — /naver/
 *
 * 홈페이지 글을 그대로 네이버에 올리면 네이버가 유사문서로 걸러 한쪽이 검색에서 빠진다.
 * 그래서 루틴은 같은 사실을 다른 구성 · 다른 문장으로 다시 쓴 원고를 _blog/naver/ 에 넣는다
 * (파일 이름은 원글 _blog/posts/… 와 같다). 이 페이지는 그 원고를 「복사」 단추로 보여 줄 뿐,
 * 붙여넣기와 발행은 사람이 한다 — 네이버는 자동 발행 API 를 닫았고 매크로는 계정이 막힌다.
 * 규칙은 _blog/GUIDE.md 9장, 검사는 scripts/blog-check.mjs.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { esc, 글자만, 날짜글, 글주소 } from './build-blog.mjs';

/** 네이버에 붙일 때는 퓨니코드보다 한글 주소가 보기 좋다 */
export const 한글사이트 = 'https://큰길이벤트.com';

export function 네이버읽기(ROOT) {
  const 폴더 = resolve(ROOT, '_blog', 'naver');
  if (!existsSync(폴더)) return [];
  return readdirSync(폴더).filter((f) => f.endsWith('.json')).map((f) => {
    const n = JSON.parse(readFileSync(resolve(폴더, f), 'utf8'));
    Object.defineProperty(n, '_파일', { value: f, enumerable: false });
    return n;
  }).sort((a, b) => (a._파일 < b._파일 ? 1 : -1));
}

export const 네이버문단들 = (n) => (n.본문 || []).filter((x) => typeof x === 'string');
export const 네이버사진들 = (n) => (n.본문 || []).filter((x) => x && typeof x === 'object' && x.사진);
/** 검사 · 겹침 비교에 쓰는 글자 */
export const 네이버글 = (n) => [n.제목, ...네이버문단들(n), ...네이버사진들(n).map((x) => x.설명)].map(글자만).join('\n');

/** 네이버 에디터에 그대로 붙여 넣을 본문 */
export function 복사본문(n, 글주소전체) {
  const 덩어리 = [];
  let 번호 = 0;
  for (const 조각 of n.본문 || []) {
    if (typeof 조각 === 'string') 덩어리.push(글자만(조각));
    else if (조각 && 조각.사진) { 번호 += 1; 덩어리.push(`[사진 ${번호}]`); }
  }
  덩어리.push(`표까지 정리한 자세한 글은 홈페이지에 있습니다.\n${글주소전체}`);
  덩어리.push('행사 준비 상담 1533-7295 (큰길이벤트기획)');
  const 태그 = (n.태그 || []).map((t) => '#' + String(t).replace(/^#/, '').replace(/\s+/g, '')).join(' ');
  if (태그) 덩어리.push(태그);
  return 덩어리.join('\n\n');
}

const CSS = `
:root{--amber:#F59E0B;--amber-ink:#B45309;--dark:#0B0A10;--light:#FBF8F2;--ink:#16141C;--ink-2:#4A4553;--ink-3:#7E7889;--line:rgba(22,20,28,.12)}
*{box-sizing:border-box;font-family:'Pretendard',system-ui,sans-serif;word-break:keep-all}
body{margin:0;background:var(--light);color:var(--ink);-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}
.top{background:var(--dark);color:#fff;padding:1rem 1.25rem}
.top-in,.wrap{max-width:46rem;margin:0 auto}
.top b{font-size:1.05rem;letter-spacing:-.02em}
.top p{margin:.35rem 0 0;color:#B9B3C2;font-size:.85rem;line-height:1.6}
.wrap{padding:1.25rem 1.25rem 4rem}
.how{background:#fff;border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;margin-bottom:1.5rem}
.how h2{margin:0 0 .6rem;font-size:.95rem}
.how ol{margin:0;padding-left:1.1rem;color:var(--ink-2);font-size:.9rem;line-height:1.8}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:1.1rem;margin-bottom:1.5rem}
.meta{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between;font-size:.8rem;color:var(--ink-3);margin-bottom:.7rem}
.meta a{color:var(--amber-ink)}
.row{display:flex;gap:.6rem;align-items:flex-start;justify-content:space-between;margin:1.1rem 0 .4rem}
.row h2{margin:0;font-size:1.05rem;line-height:1.5;letter-spacing:-.02em}
.row b{font-size:.85rem;color:var(--ink-2)}
button{flex:none;border:0;border-radius:999px;background:var(--amber-ink);color:#fff;font-weight:700;font-size:.8rem;padding:.5rem .9rem;cursor:pointer}
button:hover{background:#92400E}button.ok{background:#15803D}
.body{white-space:pre-wrap;font-size:.9rem;line-height:1.85;color:var(--ink);background:#FAF7F1;border:1px solid var(--line);border-radius:10px;padding:.9rem;margin:0;max-height:22rem;overflow:auto}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.8rem;margin-top:.6rem}
figure{margin:0}
/* width 를 주지 않으면 아직 안 받은 사진의 크기가 0 이 돼 lazy 로딩이 영원히 안 걸린다 */
figure img{width:100%;border-radius:10px;aspect-ratio:4/3;object-fit:cover;background:#EFE9E0}
figcaption{font-size:.78rem;color:var(--ink-2);line-height:1.6;margin:.4rem 0}
.shot-go{display:inline-block;font-size:.78rem;color:var(--amber-ink);margin-right:.6rem}
.no{color:var(--ink-2);font-size:.9rem;line-height:1.8}
@media (max-width:520px){.row{flex-direction:column}button{width:100%;padding:.7rem}}
`;

const 스크립트 = `
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]'); if (!b) return;
  var el = document.getElementById(b.getAttribute('data-copy')); if (!el) return;
  var t = el.textContent, 옛 = b.textContent;
  function 됐다() { b.textContent = '복사됨'; b.classList.add('ok'); setTimeout(function () { b.textContent = 옛; b.classList.remove('ok'); }, 1500); }
  function 손으로() {
    var ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); 됐다(); } catch (_) { alert('복사가 안 됩니다. 글을 길게 눌러 직접 복사해 주세요.'); }
    ta.remove();
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(됐다, 손으로);
  else 손으로();
});
`;

export function buildNaver(옵션 = {}) {
  const { ROOT, BRAND = '큰길이벤트기획', CDN = '' } = 옵션;
  const 원고들 = 네이버읽기(ROOT);
  const 글목록 = new Map();
  const 글폴더 = resolve(ROOT, '_blog', 'posts');
  if (existsSync(글폴더)) {
    for (const f of readdirSync(글폴더).filter((x) => x.endsWith('.json'))) {
      글목록.set(f, JSON.parse(readFileSync(resolve(글폴더, f), 'utf8')));
    }
  }
  const 사진주소 = (p) => CDN + String(p || '').split('/').map(encodeURIComponent).join('/');

  const 카드들 = 원고들.slice(0, 20).map((n, k) => {
    const 원글 = 글목록.get(n._파일);
    const 주소 = 원글 ? 한글사이트 + decodeURIComponent(글주소(원글.slug)) : 한글사이트 + '/blog/';
    const 본문 = 복사본문(n, 주소);
    const 사진들 = 네이버사진들(n);
    const 그림 = 사진들.map((s, i) => `
        <figure>
          <img src="${esc(사진주소(s.사진))}" alt="${esc(s.설명 || '')}" loading="lazy">
          <figcaption><b>[사진 ${i + 1}]</b> <span id="c${k}-${i}">${esc(s.설명 || '')}</span></figcaption>
          <a class="shot-go" href="${esc(사진주소(s.사진))}" target="_blank" rel="noopener">사진 열기</a>
          <button data-copy="c${k}-${i}">설명 복사</button>
        </figure>`).join('');
    return `
      <article class="card">
        <div class="meta">
          <span>${esc(날짜글(n.날짜 || (n._파일 || '').slice(0, 10)))}</span>
          ${원글 ? `<a href="${글주소(원글.slug)}" target="_blank" rel="noopener">홈페이지 원글 보기</a>` : ''}
        </div>
        <div class="row"><h2 id="t${k}">${esc(n.제목 || '')}</h2><button data-copy="t${k}">제목 복사</button></div>
        <div class="row"><b>본문 · 링크 · 태그</b><button data-copy="b${k}">본문 복사</button></div>
        <pre class="body" id="b${k}">${esc(본문)}</pre>
        ${사진들.length ? `<div class="shots">${그림}\n        </div>` : ''}
      </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>네이버 블로그용 원고 — ${esc(BRAND)}</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css">
<style>${CSS}</style>
</head>
<body>
<div class="top"><div class="top-in">
  <b>네이버 블로그용 원고</b>
  <p>홈페이지 글과 같은 내용을 다른 문장으로 새로 쓴 원고입니다. 같은 글을 두 곳에 올리면 네이버가 유사문서로 걸러 한쪽이 검색에서 빠지기 때문입니다. 이 페이지는 검색에 잡히지 않습니다.</p>
</div></div>
<div class="wrap">
  <section class="how">
    <h2>발행 순서</h2>
    <ol>
      <li>네이버 블로그 앱(또는 PC) → 글쓰기</li>
      <li><b>제목 복사</b> → 제목 칸에 붙여넣기</li>
      <li><b>본문 복사</b> → 본문에 붙여넣기</li>
      <li>본문의 <b>[사진 1]</b> 자리에 아래 사진을 넣고, 그 줄은 지웁니다. 사진 설명 칸에는 <b>설명 복사</b>를 붙여넣습니다.</li>
      <li>붙여넣은 홈페이지 주소가 파란 링크로 안 바뀌면, 그 줄을 선택하고 에디터의 링크 단추를 눌러 주세요.</li>
      <li>발행 — 태그는 본문 맨 아래에 이미 붙어 있습니다.</li>
    </ol>
  </section>
${카드들 || '  <p class="no">아직 원고가 없습니다. 매일 아침 7시 루틴이 그날 글 하나를 네이버용으로 다시 써서 여기에 올립니다.</p>'}
</div>
<script>${스크립트}</script>
</body>
</html>
`;
  mkdirSync(resolve(ROOT, 'naver'), { recursive: true });
  writeFileSync(resolve(ROOT, 'naver', 'index.html'), html, 'utf8');
  return { 원고수: 원고들.length };
}
