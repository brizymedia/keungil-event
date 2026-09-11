/**
 * 블로그 — _blog/posts/*.json 을 홈페이지 글로 만든다
 * ──────────────────────────────────────────────────
 *   /blog/               글 목록 (최신순, 24개씩 → /blog/page/2/)
 *   /blog/<지역>/        지역별 모음 (예: /blog/gwangju/)
 *   /blog/<글주소>/      글 하나
 *
 * 원본은 _blog/ 에 둔다. 밑줄로 시작하는 폴더는 GitHub Pages(Jekyll)가 공개하지 않는다.
 * blog/ 는 매번 지우고 새로 만든다 — 결과 HTML 을 손으로 고치지 말고 원본 JSON 이나 이 템플릿을 고친다.
 *
 * 혼자 실행:  node scripts/build-blog.mjs    (blog/ 만 다시 만든다. sitemap·RSS 는 build-gallery.mjs 가 이 파일을 불러 채운다)
 * 글 형식·규칙: _blog/GUIDE.md   ·   검사: node scripts/blog-check.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const 기본값 = {
  SITE: 'https://xn--wk0bn7yi8h24iszc.com',
  BRAND: '큰길이벤트기획',
  CDN: 'https://cdn.jsdelivr.net/gh/brizymedia/keungil-event@photos/',
};
const 쪽당 = 24;

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 글 안에서는 **굵게** 와 [글자](주소) 만 쓴다. 주소는 / 로 시작하거나 https:// 여야 한다. */
export function 인라인(글) {
  return esc(글)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g, (m, t, u) =>
      u.startsWith('/') ? `<a href="${u}">${t}</a>` : `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
}
export const 글자만 = (글) => String(글 ?? '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
export const 날짜글 = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : String(d || ''); };
export const 글주소 = (slug) => `/blog/${encodeURIComponent(slug)}/`;

export function 지역표(ROOT) {
  const j = JSON.parse(readFileSync(resolve(ROOT, '_blog', 'regions.json'), 'utf8'));
  const 표 = new Map(j.지역.map((r) => [r.slug, r]));
  표.set('common', { slug: 'common', 이름: '행사 준비 공통', 서비스페이지: '', 이동: '', 비중: 0 });
  return 표;
}

/** photos.json 의 묶음을 사진 한 장씩 풀어 경로 → 정보 로 */
export function 사진목록(ROOT) {
  const j = JSON.parse(readFileSync(resolve(ROOT, '_blog', 'photos.json'), 'utf8'));
  const 표 = new Map();
  j.묶음.forEach((g, i) => {
    const 경로들 = g.path || Array.from({ length: g.번호[1] - g.번호[0] + 1 },
      (_, k) => `photos/${g.분야}/${String(g.번호[0] + k).padStart(3, '0')}.jpg`);
    경로들.forEach((p) => 표.set(p, { ...g, path: p, 묶음번호: i }));
  });
  return 표;
}

export function 글읽기(ROOT) {
  const 폴더 = resolve(ROOT, '_blog', 'posts');
  if (!existsSync(폴더)) return [];
  return readdirSync(폴더).filter((f) => f.endsWith('.json')).map((f) => {
    const p = JSON.parse(readFileSync(resolve(폴더, f), 'utf8'));
    Object.defineProperty(p, '_파일', { value: f, enumerable: false });
    return p;
  }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug < b.slug ? -1 : 1));
}

/** 본문 글자 — 읽는 시간·검사·중복 비교에 쓴다 */
export function 본문글(p) {
  const 조각 = [p.lead, ...(p.points || [])];
  for (const s of p.sections || []) {
    조각.push(s.h2);
    for (const b of s.blocks || []) {
      if (b.p) 조각.push(b.p);
      if (b.tip) 조각.push(b.tip);
      if (b.ul) 조각.push(...b.ul);
      if (b.ol) 조각.push(...b.ol);
      if (b.table) 조각.push(...(b.table.head || []), ...(b.table.rows || []).flat());
    }
  }
  for (const f of p.faq || []) 조각.push(f.q, f.a);
  return 조각.map(글자만).join('\n');
}

export function 글이미지들(p) {
  const 목록 = p.cover ? [p.cover] : [];
  for (const s of p.sections || []) for (const b of s.blocks || []) if (b.img) 목록.push(b.img);
  return 목록;
}

const CSS = `
:root{--amber:#F59E0B;--amber-ink:#B45309;--dark:#0B0A10;--light:#FBF8F2;--ink:#16141C;--ink-2:#4A4553;--ink-3:#7E7889;--line:rgba(22,20,28,.1)}
*{box-sizing:border-box;font-family:'Pretendard',system-ui,sans-serif;word-break:keep-all}
html{scroll-behavior:smooth}body{margin:0;background:var(--light);color:var(--ink);-webkit-font-smoothing:antialiased}
a{color:inherit}img{display:block;max-width:100%}
.topbar{position:sticky;top:0;z-index:40;background:rgba(11,10,16,.94);backdrop-filter:blur(14px);color:#fff;border-bottom:1px solid rgba(255,255,255,.08)}
.topbar-in{max-width:64rem;margin:0 auto;padding:.7rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}
.brand{text-decoration:none;font-weight:800;letter-spacing:-.02em;font-size:.95rem;white-space:nowrap}
.topnav{display:flex;gap:1.1rem;flex-wrap:wrap;justify-content:flex-end}
.topnav a{color:#B9B3C2;text-decoration:none;font-size:.875rem;white-space:nowrap}.topnav a:hover,.topnav a[aria-current]{color:#fff}
@media (max-width:640px){.topnav{gap:.85rem}.topnav a{font-size:.8rem}.topnav .hide-sm{display:none}}
.crumb{max-width:46rem;margin:0 auto;padding:1.1rem 1.25rem 0;font-size:.78rem;color:var(--ink-3)}.crumb.wide{max-width:64rem}
.crumb a{text-decoration:none}.crumb a:hover{color:var(--amber-ink)}
.art{max-width:46rem;margin:0 auto;padding:1.1rem 1.25rem 3rem}
.eyebrow{font-size:.74rem;font-weight:800;letter-spacing:.1em;color:var(--amber-ink);margin:0 0 .65rem}
h1{font-size:clamp(1.55rem,4.2vw,2.3rem);line-height:1.32;letter-spacing:-.03em;margin:0 0 1rem;font-weight:800;text-wrap:balance}
.meta{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 1.5rem}
.meta a,.meta span{font-size:.78rem;font-weight:700;text-decoration:none;padding:.28rem .75rem;border-radius:9999px;background:rgba(22,20,28,.06);color:var(--ink-2)}
.meta a{background:rgba(245,158,11,.14);color:var(--amber-ink)}.meta a:hover{background:rgba(245,158,11,.26)}
.lead{font-size:1.06rem;line-height:1.9;color:var(--ink);margin:0 0 1.5rem}.lead a{color:var(--amber-ink);font-weight:700}
figure{margin:0 0 1.7rem}figure img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:.9rem;background:#16141C}
figure.cover img{aspect-ratio:16/9}
figcaption{font-size:.8rem;color:var(--ink-3);margin-top:.5rem;line-height:1.6}
.points{background:#fff;border:1px solid var(--line);border-radius:1rem;padding:1.05rem 1.25rem;margin:0 0 1.7rem}
.points b{display:block;font-size:.78rem;letter-spacing:.06em;color:var(--amber-ink);margin-bottom:.4rem}
.points ul{margin:0;padding-left:1.1rem}.points li{line-height:1.75;margin:.2rem 0}
.toc{border-left:3px solid var(--amber);padding:.15rem 0 .15rem 1rem;margin:0 0 2.2rem}
.toc b{font-size:.78rem;color:var(--ink-3)}.toc ol{margin:.35rem 0 0;padding-left:1.1rem}.toc li{line-height:1.9}.toc a{text-decoration:none}.toc a:hover{color:var(--amber-ink)}
.body h2,.faq h2{font-size:1.3rem;line-height:1.42;letter-spacing:-.02em;margin:2.5rem 0 .9rem;font-weight:800;scroll-margin-top:4.5rem;text-wrap:balance}
.body p,.faq p{font-size:1.01rem;line-height:1.95;color:var(--ink-2);margin:0 0 1.1rem}
.body ul,.body ol{margin:0 0 1.2rem;padding-left:1.25rem;color:var(--ink-2)}.body li{line-height:1.85;margin:.3rem 0}
.body b{color:var(--ink)}.body a,.faq a{color:var(--amber-ink);font-weight:700;text-underline-offset:3px}
.tbl{overflow-x:auto;margin:0 0 1.4rem;border:1px solid var(--line);border-radius:.8rem;background:#fff}
table{border-collapse:collapse;width:100%;font-size:.9rem;min-width:32rem}
th,td{padding:.62rem .8rem;text-align:left;vertical-align:top;border-bottom:1px solid var(--line);line-height:1.6}
th{background:rgba(22,20,28,.04);font-weight:800;white-space:nowrap}tbody tr:last-child td{border-bottom:0}
.tip{background:rgba(245,158,11,.1);border-radius:.8rem;padding:.85rem 1.1rem;margin:0 0 1.3rem;font-size:.96rem;line-height:1.8;color:var(--ink)}
.tip::before{content:'현장 메모';display:block;font-size:.72rem;font-weight:800;letter-spacing:.06em;color:var(--amber-ink);margin-bottom:.15rem}
.faq details{background:#fff;border:1px solid var(--line);border-radius:.8rem;margin:0 0 .55rem;padding:0 1rem}
.faq summary{cursor:pointer;font-weight:700;padding:.8rem 0;line-height:1.6}.faq details p{margin:0 0 .9rem}
.src{margin-top:2rem;font-size:.84rem;color:var(--ink-3);line-height:1.7}.src ul{padding-left:1.1rem;margin:.4rem 0 0}.src a{color:var(--ink-2)}
.cta{background:var(--dark);color:#fff;border-radius:1.1rem;padding:1.5rem;margin-top:2.4rem;display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between}
.cta h3{margin:0 0 .3rem;font-size:1.12rem}.cta p{margin:0;color:#B9B3C2;font-size:.88rem;line-height:1.7}
.btn{display:inline-flex;align-items:center;padding:.72rem 1.25rem;border-radius:9999px;font-weight:800;font-size:.9rem;text-decoration:none;background:var(--amber);color:#0a0a0a;white-space:nowrap}
.btn.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.28)}
.more{max-width:64rem;margin:0 auto;padding:.5rem 1.25rem 4rem}.more h2{font-size:1.1rem;margin:0 0 1rem}
.wrap{max-width:64rem;margin:0 auto;padding:1.1rem 1.25rem 4rem}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:1rem}
.card{display:block;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:1rem;overflow:hidden;transition:transform .25s,box-shadow .25s}
.card:hover{transform:translateY(-3px);box-shadow:0 18px 40px -22px rgba(22,20,28,.35)}
.card img{width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;background:#16141C}
.card .in{padding:.85rem 1rem 1.05rem}.card .r{font-size:.72rem;font-weight:800;color:var(--amber-ink);margin-bottom:.3rem}
.card .t{font-size:.98rem;font-weight:800;line-height:1.45;letter-spacing:-.02em}
.card .s{font-size:.82rem;color:var(--ink-2);line-height:1.6;margin-top:.35rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.chips{display:flex;flex-wrap:wrap;gap:.45rem;margin:0 0 1.8rem}
.chips a{font-size:.85rem;font-weight:700;text-decoration:none;padding:.42rem .9rem;border-radius:9999px;background:#fff;border:1px solid var(--line)}
.chips a[aria-current]{background:var(--dark);color:#fff;border-color:var(--dark)}.chips small{font-weight:600;margin-left:.3rem;opacity:.6}
.pager{display:flex;gap:.45rem;justify-content:center;margin-top:2rem}
.pager a,.pager span{padding:.45rem .85rem;border-radius:.6rem;border:1px solid var(--line);text-decoration:none;font-weight:700;font-size:.9rem;background:#fff}.pager span{background:var(--dark);color:#fff}
.empty{background:#fff;border:1px dashed rgba(22,20,28,.2);border-radius:1rem;padding:1.3rem 1.4rem;color:var(--ink-2);line-height:1.8;margin-bottom:1.5rem}
.foot{background:var(--dark);color:#7E7889;font-size:.78rem;padding:2rem 1.25rem;text-align:center;line-height:1.8}.foot a{color:#B9B3C2;text-decoration:none}
a:focus-visible,summary:focus-visible{outline:2px solid var(--amber);outline-offset:3px;border-radius:.3rem}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.card{transition:none}.card:hover{transform:none}}
`.trim();

export function buildBlog(옵션 = {}) {
  const ROOT = 옵션.ROOT;
  const SITE = 옵션.SITE || 기본값.SITE;
  const BRAND = 옵션.BRAND || 기본값.BRAND;
  const CDN = 옵션.CDN || 기본값.CDN;
  const 사진주소 = (path) => CDN + String(path).split('/').map(encodeURIComponent).join('/');
  const 지역 = 지역표(ROOT);
  const posts = 글읽기(ROOT);
  const 제이슨 = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

  rmSync(resolve(ROOT, 'blog'), { recursive: true, force: true });
  const 쓰기 = (폴더, html) => {
    const d = resolve(ROOT, 폴더);
    mkdirSync(d, { recursive: true });
    writeFileSync(resolve(d, 'index.html'), html, 'utf8');
  };

  const 머리 = ({ 제목, 설명, 경로, 이미지, 종류 = 'website', 더넣기 = '', 색인 = true }) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0B0A10">
<title>${esc(제목)}</title>
<meta name="description" content="${esc(설명)}">
<meta name="robots" content="${색인 ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">
<link rel="canonical" href="${SITE}${경로}">
<link rel="alternate" type="application/rss+xml" title="${BRAND} 소식" href="/rss.xml">
<meta name="naver-site-verification" content="ac711b26937bffbfe38e3394c5c9d2540a13b95c" />
<meta property="og:type" content="${종류}">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${esc(제목)}">
<meta property="og:description" content="${esc(설명)}">
<meta property="og:url" content="${SITE}${경로}">
<meta property="og:image" content="${esc(이미지)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css">
${더넣기}
<style>${CSS}</style>
<script defer src="https://www.ai-make.co.kr/stats/stats.js" data-site="keungil"></script>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  <a class="brand" href="/">${BRAND}</a>
  <nav class="topnav" aria-label="주 메뉴">
    <a href="/company.html" class="hide-sm">회사소개</a>
    <a href="/blog/" aria-current="page">블로그</a>
    <a href="/stories/" class="hide-sm">행사 이야기</a>
    <a href="/gallery.html">갤러리</a>
    <a href="/quote.html">견적</a>
  </nav>
</div></div>`;

  const 꼬리 = `<footer class="foot">
  <div>${BRAND} · 주식회사 브리지미디어 · 대표 김동길 · 사업자등록번호 813-81-02252</div>
  <div>전남광주통합특별시 광양시 광양읍 강변동길 1, 2층 · <a href="tel:1533-7295">1533-7295</a> · gilcaro@naver.com</div>
  <div style="margin-top:.6rem;"><a href="/">홈</a> · <a href="/blog/">블로그</a> · <a href="/stories/">행사 이야기</a> · <a href="/gallery.html">갤러리</a> · <a href="/areas.html">서비스 지역</a> · <a href="/quote.html">자동 견적서</a></div>
</footer>
</body>
</html>
`;

  const 상담 = `<div class="cta">
    <div><h3>준비 중인 행사가 있으신가요?</h3><p>장비와 인력을 직접 보유해 견적부터 현장 운영까지 한 팀이 맡습니다. 상담은 무료입니다.</p></div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;"><a class="btn" href="/quote.html">자동 견적서</a><a class="btn ghost" href="tel:1533-7295">1533-7295</a></div>
  </div>`;

  const 카드 = (p) => {
    const r = 지역.get(p.region);
    return `<a class="card" href="${글주소(p.slug)}">
      <img src="${esc(사진주소(p.cover.path))}" alt="${esc(p.cover.alt)}" loading="lazy" decoding="async" width="800" height="500">
      <div class="in"><div class="r">${esc(r ? r.이름 : '')} · ${esc(날짜글(p.date))}</div><div class="t">${esc(p.title)}</div><div class="s">${esc(p.description)}</div></div>
    </a>`;
  };

  const 개수 = new Map();
  posts.forEach((p) => 개수.set(p.region, (개수.get(p.region) || 0) + 1));
  const 칩 = (현재) => `<nav class="chips" aria-label="지역별 글">
    <a href="/blog/"${현재 === '' ? ' aria-current="page"' : ''}>전체<small>${posts.length}</small></a>
    ${[...지역.values()].filter((r) => 개수.get(r.slug)).map((r) =>
      `<a href="/blog/${r.slug}/"${현재 === r.slug ? ' aria-current="page"' : ''}>${esc(r.이름)}<small>${개수.get(r.slug)}</small></a>`).join('\n    ')}
  </nav>`;

  /* ── 글 페이지 ── */
  const 이미지html = (im, 표지) => `<figure${표지 ? ' class="cover"' : ''}>
    <img src="${esc(사진주소(im.path))}" alt="${esc(im.alt)}" ${표지 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="${표지 ? 1600 : 1200}" height="${표지 ? 900 : 900}">
    <figcaption>${인라인(im.caption)}</figcaption>
  </figure>`;
  const 블록 = (b) => {
    if (b.p) return `<p>${인라인(b.p)}</p>`;
    if (b.tip) return `<div class="tip">${인라인(b.tip)}</div>`;
    if (b.ul) return `<ul>${b.ul.map((x) => `<li>${인라인(x)}</li>`).join('')}</ul>`;
    if (b.ol) return `<ol>${b.ol.map((x) => `<li>${인라인(x)}</li>`).join('')}</ol>`;
    if (b.table) return `<div class="tbl"><table><thead><tr>${b.table.head.map((h) => `<th scope="col">${인라인(h)}</th>`).join('')}</tr></thead><tbody>${
      b.table.rows.map((row) => `<tr>${row.map((c) => `<td>${인라인(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (b.img) return 이미지html(b.img, false);
    return '';
  };

  for (const p of posts) {
    const r = 지역.get(p.region) || { 이름: '', 서비스페이지: '' };
    const 지역글 = p.region !== 'common';
    const 경로 = 글주소(p.slug);
    const 분 = Math.max(1, Math.round(본문글(p).length / 500));
    const 관련 = [...posts.filter((o) => o !== p && o.region === p.region),
                  ...posts.filter((o) => o !== p && o.region !== p.region && o.topic === p.topic)].slice(0, 3);

    const ld = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: '블로그', item: SITE + '/blog/' },
        ...(지역글 ? [{ '@type': 'ListItem', position: 3, name: r.이름 + ' 행사 준비', item: `${SITE}/blog/${p.region}/` }] : []),
        { '@type': 'ListItem', position: 지역글 ? 4 : 3, name: p.title, item: SITE + 경로 } ] },
      { '@type': 'BlogPosting', '@id': SITE + 경로, headline: p.title, description: p.description,
        image: 글이미지들(p).map((im) => 사진주소(im.path)),
        datePublished: p.date, dateModified: p.updated || p.date, inLanguage: 'ko',
        keywords: [p.keyword.main, ...(p.keyword.sub || [])].join(', '),
        author: { '@type': 'Organization', name: BRAND, url: SITE + '/' },
        publisher: { '@id': SITE + '/#business' },
        mainEntityOfPage: { '@type': 'WebPage', '@id': SITE + 경로 },
        ...(지역글 ? { spatialCoverage: { '@type': 'Place', name: `${r.도} ${r.시군}` } } : {}) },
      ...((p.faq || []).length ? [{ '@type': 'FAQPage', '@id': SITE + 경로 + '#faq',
        mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: 글자만(f.a) } })) }] : []),
    ] };

    const html = 머리({ 제목: `${p.title} | ${BRAND}`, 설명: p.description, 경로, 이미지: 사진주소(p.cover.path), 종류: 'article',
      더넣기: `<meta property="article:published_time" content="${p.date}">\n${제이슨(ld)}` }) + `
<div class="crumb"><a href="/">홈</a> › <a href="/blog/">블로그</a>${지역글 ? ` › <a href="/blog/${p.region}/">${esc(r.이름)}</a>` : ''}</div>
<article class="art">
  <p class="eyebrow">${esc(지역글 ? r.이름 + ' 행사 준비' : '행사 준비')} · ${esc(날짜글(p.date))}</p>
  <h1>${esc(p.title)}</h1>
  <div class="meta">
    ${지역글 ? `<a href="/blog/${p.region}/">${esc(r.이름)} 글 모음</a>` : ''}
    ${r.서비스페이지 ? `<a href="${r.서비스페이지}">${esc(r.이름)} 행사기획 안내</a>` : ''}
    <span>읽는 시간 약 ${분}분</span>
  </div>
  <p class="lead">${인라인(p.lead)}</p>
  ${이미지html(p.cover, true)}
  <div class="points"><b>이 글의 요점</b><ul>${p.points.map((x) => `<li>${인라인(x)}</li>`).join('')}</ul></div>
  <nav class="toc" aria-label="목차"><b>목차</b><ol>${p.sections.map((s, i) => `<li><a href="#s${i + 1}">${esc(s.h2)}</a></li>`).join('')}</ol></nav>
  <div class="body">
${p.sections.map((s, i) => `<h2 id="s${i + 1}">${esc(s.h2)}</h2>\n${s.blocks.map(블록).join('\n')}`).join('\n')}
  </div>
  ${(p.faq || []).length ? `<section class="faq" id="faq"><h2>자주 묻는 질문</h2>${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${인라인(f.a)}</p></details>`).join('')}</section>` : ''}
  ${(p.sources || []).length ? `<div class="src"><b>확인한 자료</b> (${esc(날짜글(p.updated || p.date))} 기준)<ul>${p.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`).join('')}</ul></div>` : ''}
  ${상담}
</article>
${관련.length ? `<section class="more"><h2>같이 보면 좋은 글</h2><div class="cards">${관련.map(카드).join('\n')}</div></section>` : ''}
` + 꼬리;
    쓰기(`blog/${p.slug}`, html);
  }

  /* ── 목록 (/blog/, /blog/page/N/) ── */
  const 대표이미지 = posts[0] ? 사진주소(posts[0].cover.path) : `${SITE}/hero-stage-1280.jpg`;
  const 쪽수 = Math.max(1, Math.ceil(posts.length / 쪽당));
  for (let n = 1; n <= 쪽수; n++) {
    const 조각 = posts.slice((n - 1) * 쪽당, n * 쪽당);
    const 경로 = n === 1 ? '/blog/' : `/blog/page/${n}/`;
    const 쪽나눔 = 쪽수 > 1 ? `<nav class="pager" aria-label="쪽 이동">${Array.from({ length: 쪽수 }, (_, i) => i + 1).map((k) =>
      k === n ? `<span aria-current="page">${k}</span>` : `<a href="${k === 1 ? '/blog/' : `/blog/page/${k}/`}">${k}</a>`).join('')}</nav>` : '';
    const ld = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: '블로그', item: SITE + '/blog/' } ] },
      { '@type': 'Blog', '@id': SITE + '/blog/', name: `${BRAND} 행사 준비 블로그`, inLanguage: 'ko', publisher: { '@id': SITE + '/#business' },
        blogPost: 조각.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: SITE + 글주소(p.slug), datePublished: p.date, image: 사진주소(p.cover.path) })) } ] };
    const html = 머리({
      제목: n === 1 ? `행사 준비 블로그 — 광주·전남·경남 지역별 행사 정보 | ${BRAND}` : `행사 준비 블로그 ${n}쪽 | ${BRAND}`,
      설명: '광주·순천·여수·광양 등 광주·전남·경남에서 행사를 준비하는 담당자를 위한 글. 천막·음향·무대 같은 장비부터 날씨·안전·견적·계약까지 현장 기준으로 정리합니다.',
      경로, 이미지: 대표이미지, 더넣기: 제이슨(ld) }) + `
<div class="crumb wide"><a href="/">홈</a> › 블로그${n > 1 ? ` › ${n}쪽` : ''}</div>
<main class="wrap">
  <p class="eyebrow">BLOG</p>
  <h1>행사 준비 블로그</h1>
  <p class="lead" style="max-width:46rem">행사를 맡은 담당자가 먼저 확인할 것들을 지역별로 정리합니다. 장소와 장비, 날씨와 안전, 견적과 계약까지 현장 기준으로 씁니다.</p>
  ${칩('')}
  ${posts.length ? `<div class="cards">${조각.map(카드).join('\n')}</div>` : '<div class="empty">첫 글을 준비하고 있습니다.</div>'}
  ${쪽나눔}
  ${상담}
</main>
` + 꼬리;
    쓰기(n === 1 ? 'blog' : `blog/page/${n}`, html);
  }

  /* ── 지역 모음 (/blog/<지역>/) ── */
  const 허브 = [];
  for (const r of 지역.values()) {
    const 목록 = posts.filter((p) => p.region === r.slug);
    if (r.slug === 'common' && !목록.length) continue;
    const 경로 = `/blog/${r.slug}/`;
    const 소개 = r.slug === 'common'
      ? '지역과 상관없이 행사 준비에 두루 쓰이는 글입니다.'
      : `${esc(r.이름)}에서 행사를 준비하는 담당자를 위한 글입니다. ${esc(r.이동)}.${r.서비스페이지 ? ` 서비스 안내는 <a href="${r.서비스페이지}">${esc(r.이름)} 행사기획 페이지</a>에 있습니다.` : ''}`;
    const ld = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: '블로그', item: SITE + '/blog/' },
        { '@type': 'ListItem', position: 3, name: `${r.이름} 행사 준비`, item: SITE + 경로 } ] },
      { '@type': 'CollectionPage', '@id': SITE + 경로, name: `${r.이름} 행사 준비 정보`, inLanguage: 'ko',
        hasPart: 목록.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: SITE + 글주소(p.slug) })) } ] };
    const html = 머리({
      제목: `${r.이름} 행사 준비 정보 — 장소·장비·안전·견적 | ${BRAND}`,
      설명: `${r.이름}에서 행사를 준비할 때 확인할 것들. 천막·음향·무대 같은 장비, 날씨와 안전, 견적과 계약까지 현장 기준으로 정리한 글 모음입니다.`,
      경로, 이미지: 목록[0] ? 사진주소(목록[0].cover.path) : 대표이미지, 색인: 목록.length > 0, 더넣기: 제이슨(ld) }) + `
<div class="crumb wide"><a href="/">홈</a> › <a href="/blog/">블로그</a> › ${esc(r.이름)}</div>
<main class="wrap">
  <p class="eyebrow">${r.slug === 'common' ? 'GUIDE' : esc(`${r.도} ${r.시군}`)}</p>
  <h1>${esc(r.이름)} 행사 준비 정보</h1>
  <p class="lead" style="max-width:46rem">${소개}</p>
  ${칩(r.slug)}
  ${목록.length ? `<div class="cards">${목록.map(카드).join('\n')}</div>`
    : `<div class="empty">${esc(r.이름)} 글은 곧 올라옵니다. 그동안 다른 지역 글을 참고해 보세요.</div>${posts.length ? `<div class="cards">${posts.slice(0, 6).map(카드).join('\n')}</div>` : ''}`}
  ${상담}
</main>
` + 꼬리;
    쓰기(`blog/${r.slug}`, html);
    if (목록.length) 허브.push({ loc: 경로, lastmod: 목록[0].updated || 목록[0].date, priority: '0.7', changefreq: 'weekly' });
  }

  /* ── sitemap · RSS 용 ── */
  const pages = posts.length ? [
    { loc: '/blog/', lastmod: posts[0].updated || posts[0].date, priority: '0.8', changefreq: 'daily' },
    ...허브,
    ...posts.map((p) => ({ loc: 글주소(p.slug), lastmod: p.updated || p.date, priority: '0.7', changefreq: 'monthly',
      images: 글이미지들(p).map((im) => ({ path: im.path, event: 글자만(im.alt) })) })),
  ] : [];
  const rssItems = posts.slice(0, 50).map((p) => ({ title: p.title, link: SITE + 글주소(p.slug), desc: p.description, date: p.date }));
  return { posts, pages, rssItems };
}

/* 혼자 실행할 때 */
const 이파일 = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === 이파일) {
  const ROOT = resolve(dirname(이파일), '..');
  const { posts, pages } = buildBlog({ ROOT });
  console.log(`blog/: 글 ${posts.length}개 · sitemap 대상 ${pages.length}개 (sitemap·RSS 는 build-gallery.mjs 가 갱신)`);
}
