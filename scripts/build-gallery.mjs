/**
 * 갤러리 정적 페이지 + 사이트맵 생성기
 *
 * photos 브랜치의 photos.json(행사명·날짜·장소·설명·사진)을 읽어
 *   - gallery.html  : 행사별로 묶은 정적 갤러리 페이지 (검색엔진·AI 크롤러가 읽을 수 있는 HTML)
 *   - sitemap.xml   : 페이지 + 갤러리 이미지 사이트맵
 * 을 만든다. GitHub Actions(.github/workflows/gallery.yml)가 주기적으로 실행해 커밋한다.
 *
 * 로컬 실행:  node scripts/build-gallery.mjs
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://xn--wk0bn7yi8h24iszc.com';
const PHOTOS_URL = 'https://raw.githubusercontent.com/brizymedia/keungil-event/photos/photos/photos.json';
const CDN = 'https://cdn.jsdelivr.net/gh/brizymedia/keungil-event@photos/';
const BRAND = '큰길이벤트기획';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const imgUrl = (p) => CDN + String(p.path || '').split('/').map(encodeURIComponent).join('/');
const slug = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'event';
const fmtDate = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : (d || ''); };

// ── 데이터 ──────────────────────────────────────────────
let photos = [];
try {
  const r = await fetch(PHOTOS_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  photos = (await r.json()).photos || [];
} catch (e) {
  console.error('photos.json 을 불러오지 못했습니다:', e.message);
  process.exit(1);
}

// 행사별 묶기 (event|date), 최신순
const groups = new Map();
for (const p of photos) {
  const key = (p.event || '') + '|' + (p.date || '');
  if (!groups.has(key)) groups.set(key, { event: p.event || '(행사명 없음)', date: p.date || '', place: p.place || '', desc: p.desc || '', photos: [] });
  const g = groups.get(key);
  if (p.desc && !g.desc) g.desc = p.desc;
  if (p.place && !g.place) g.place = p.place;
  g.photos.push(p);
}
const events = [...groups.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
// 같은 이름 행사가 여러 날짜면 slug 에 날짜 붙이기
const seen = new Map();
for (const g of events) { const base = slug(g.event); const n = (seen.get(base) || 0) + 1; seen.set(base, n); g.id = n === 1 ? base : base + '-' + (g.date || n).replace(/-/g, ''); }

const latest = events[0]?.date || new Date().toISOString().slice(0, 10);
const totalPhotos = photos.length;

// 지역 힌트: 행사명/장소에서 지역명 추출 (SEO 문장용)
const REGIONS = ['광양', '순천', '여수', '고흥', '녹동', '하동', '남원', '광주', '진주', '통영', '보성', '구례', '곡성', '담양', '나주', '목포', '사천', '거제'];
const regionOf = (g) => REGIONS.find((r) => (g.event + ' ' + g.place).includes(r)) || '';
const defaultDesc = (g) => {
  const r = regionOf(g); const where = g.place || (r ? r + ' 일원' : '전남·경남');
  return `${where}에서 진행한 ${g.event} 현장입니다. ${BRAND}이 무대·트러스 설치, 음향·조명·LED 영상장비 세팅과 현장 운영을 맡았습니다.`;
};

// ── HTML ────────────────────────────────────────────────
const sections = events.map((g) => {
  const r = regionOf(g);
  const desc = g.desc || defaultDesc(g);
  const imgs = g.photos.map((p, i) => {
    const alt = `${g.event} 현장 사진 ${i + 1}${g.place ? ' — ' + g.place : ''} · ${BRAND}`;
    return `<a class="ph" href="${imgUrl(p)}" data-i="${i}" target="_blank" rel="noopener"><img src="${imgUrl(p)}" alt="${esc(alt)}" loading="lazy" decoding="async" width="800" height="600"></a>`;
  }).join('\n        ');
  return `
  <article class="ev" id="${esc(g.id)}" itemscope itemtype="https://schema.org/ImageGallery">
    <header>
      <div class="ev-meta">${esc(fmtDate(g.date))}${g.place ? ' · ' + esc(g.place) : ''}${r ? ' · <span class="tag">' + esc(r) + '</span>' : ''} · 사진 ${g.photos.length}장</div>
      <h2 itemprop="name">${esc(g.event)}</h2>
      <p class="ev-desc" itemprop="description">${esc(desc)}</p>
    </header>
    <div class="grid">
        ${imgs}
    </div>
  </article>`;
}).join('\n');

const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: '행사 갤러리', item: SITE + '/gallery.html' } ] },
    { '@type': 'CollectionPage', '@id': SITE + '/gallery.html', url: SITE + '/gallery.html', name: `${BRAND} 행사 갤러리`, inLanguage: 'ko',
      description: `광양·순천·여수·고흥 등 전남·경남에서 ${BRAND}이 진행한 행사 현장 사진 ${totalPhotos}장. 행사별 무대·음향·조명·LED 세팅 기록.`,
      publisher: { '@id': SITE + '/#business' },
      hasPart: events.map((g) => ({ '@type': 'ImageGallery', name: g.event, url: SITE + '/gallery.html#' + g.id, datePublished: g.date || undefined,
        contentLocation: g.place ? { '@type': 'Place', name: g.place } : undefined,
        description: g.desc || defaultDesc(g),
        image: g.photos.slice(0, 12).map((p) => imgUrl(p)) })) }
  ]
};

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0B0A10">
<title>행사 갤러리 — 광양·순천·여수·고흥 행사 현장 사진 ${totalPhotos}장 | ${BRAND}</title>
<meta name="description" content="${esc(`${BRAND}이 전남·경남(광양·순천·여수·고흥·하동·남원·광주·진주·통영)에서 진행한 지역축제·기업행사·기관행사 현장. 무대·트러스, 음향·조명·LED 영상장비, 드론쇼 세팅 기록 ${events.length}건, 사진 ${totalPhotos}장.`)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${SITE}/gallery.html">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="행사 갤러리 — ${BRAND} 현장 사진">
<meta property="og:description" content="전남·경남 행사 현장 ${events.length}건 · 사진 ${totalPhotos}장. 무대·음향·조명·LED·드론쇼.">
<meta property="og:url" content="${SITE}/gallery.html">
<meta property="og:image" content="${events[0] && events[0].photos[0] ? imgUrl(events[0].photos[0]) : SITE + '/hero-stage-1280.jpg'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
  :root{ --amber:#F59E0B; --amber-2:#FBBF24; --amber-ink:#B45309; --dark:#0B0A10; --light:#FBF8F2; --ink:#16141C; --ink-2:#5B5664; --ink-3:#8A8494; --line:rgba(22,20,28,.09); }
  *{ box-sizing:border-box;font-family:'Pretendard',system-ui,sans-serif;word-break:keep-all; }
  html{ scroll-behavior:smooth; } body{ margin:0;background:var(--light);color:var(--ink);-webkit-font-smoothing:antialiased; }
  a{ color:inherit; }
  .topbar{ position:sticky;top:0;z-index:40;background:rgba(11,10,16,.92);backdrop-filter:blur(14px);color:#fff;border-bottom:1px solid rgba(255,255,255,.08); }
  .topbar-in{ max-width:80rem;margin:0 auto;padding:.7rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem; }
  .brand{ display:flex;align-items:center;gap:.5rem;text-decoration:none;font-weight:800;letter-spacing:-.02em;font-size:.95rem; }
  .brand img{ height:1.8rem;filter:brightness(0) invert(1) drop-shadow(0 0 6px rgba(245,158,11,.5)); }
  .topnav a{ color:#B9B3C2;text-decoration:none;font-size:.875rem;margin-left:1.4rem; } .topnav a:hover{ color:#fff; }
  header.hero{ background:var(--dark);color:#fff;padding:4.5rem 1.25rem 3.5rem;position:relative;overflow:hidden; }
  header.hero::after{ content:'';position:absolute;right:-10%;top:-40%;width:50vw;height:50vw;border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,.25),transparent 65%);filter:blur(80px);pointer-events:none; }
  .hero-in{ max-width:80rem;margin:0 auto;position:relative; }
  .eyebrow{ display:inline-flex;align-items:center;gap:.6rem;font-size:.72rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#8A8494;margin-bottom:.9rem; }
  .eyebrow::before{ content:'';width:1.5rem;height:1px;background:linear-gradient(90deg,transparent,var(--amber)); }
  h1{ font-size:clamp(1.9rem,4vw,3rem);font-weight:800;line-height:1.15;letter-spacing:-.03em;margin:0 0 .8rem; }
  .lead{ color:#CFC9D6;font-size:1.02rem;line-height:1.75;max-width:62ch;margin:0 0 1.5rem; }
  .toc{ display:flex;flex-wrap:wrap;gap:.45rem; }
  .toc a{ text-decoration:none;font-size:.82rem;font-weight:700;padding:.4rem .85rem;border-radius:9999px;border:1px solid rgba(255,255,255,.18);color:#fff;transition:all .25s; }
  .toc a:hover{ border-color:var(--amber);background:rgba(245,158,11,.1); }
  main{ max-width:80rem;margin:0 auto;padding:2.5rem 1.25rem 5rem; }
  .ev{ background:#fff;border:1px solid var(--line);border-radius:1.25rem;padding:1.75rem;margin-bottom:1.5rem;box-shadow:0 1px 2px rgba(22,20,28,.04),0 16px 40px -18px rgba(22,20,28,.16);scroll-margin-top:5rem; }
  .ev-meta{ font-size:.8rem;color:var(--amber-ink);font-weight:700;margin-bottom:.4rem; }
  .ev-meta .tag{ display:inline-block;padding:.1rem .5rem;border-radius:9999px;background:rgba(245,158,11,.14);color:var(--amber-ink); }
  .ev h2{ font-size:1.5rem;font-weight:800;letter-spacing:-.02em;margin:0 0 .5rem;line-height:1.3; }
  .ev-desc{ color:var(--ink-2);line-height:1.8;margin:0 0 1.2rem;font-size:.95rem;white-space:pre-wrap;max-width:80ch; }
  .grid{ display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.7rem; }
  .ph{ display:block;aspect-ratio:4/3;border-radius:.8rem;overflow:hidden;background:#16141C;box-shadow:0 1px 2px rgba(22,20,28,.05),0 14px 34px -18px rgba(22,20,28,.25); }
  .ph img{ width:100%;height:100%;object-fit:cover;transition:transform .5s ease;filter:saturate(1.15) contrast(1.04);display:block; }
  .ph:hover img{ transform:scale(1.05); }
  .cta{ margin-top:2.5rem;background:var(--dark);color:#fff;border-radius:1.25rem;padding:2rem;display:flex;align-items:center;justify-content:space-between;gap:1.5rem;flex-wrap:wrap; }
  .cta h3{ margin:0 0 .3rem;font-size:1.3rem;font-weight:800; } .cta p{ margin:0;color:#B9B3C2;font-size:.92rem; }
  .btn{ display:inline-flex;align-items:center;gap:.5rem;padding:.8rem 1.5rem;border-radius:9999px;font-weight:700;font-size:.92rem;text-decoration:none;background:var(--amber);color:#0a0a0a;white-space:nowrap; }
  .foot{ background:var(--dark);color:#7E7889;font-size:.78rem;padding:2rem 1.25rem;text-align:center;line-height:1.8; }
  .foot a{ color:#B9B3C2;text-decoration:none; }
  #lb{ display:none;position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.93);align-items:center;justify-content:center;padding:1rem; }
  #lb.on{ display:flex; } #lb img{ max-width:92vw;max-height:88vh;object-fit:contain;border-radius:.6rem; }
  #lb button{ position:absolute;background:rgba(255,255,255,.12);border:none;color:#fff;width:2.75rem;height:2.75rem;border-radius:50%;font-size:1.4rem;cursor:pointer; }
  #lb .p{ left:1rem;top:50%;transform:translateY(-50%); } #lb .n{ right:1rem;top:50%;transform:translateY(-50%); } #lb .x{ top:1rem;right:1rem;font-size:1.1rem;width:2.2rem;height:2.2rem; }
  #lb .c{ position:absolute;bottom:1rem;left:50%;transform:translateX(-50%);color:#B9B3C2;font-size:.85rem; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  <a class="brand" href="index.html"><img src="logo-kgm-transparent.png" alt="${BRAND}"><span>${BRAND}</span></a>
  <nav class="topnav"><a href="index.html#services">서비스</a><a href="areas.html">지역안내</a><a href="quote.html">견적 · 문의</a><a href="tel:15337295" style="color:var(--amber-2);font-weight:700;">1533-7295</a></nav>
</div></div>

<header class="hero"><div class="hero-in">
  <div class="eyebrow">Gallery</div>
  <h1>행사 갤러리 — 현장 ${events.length}건 · 사진 ${totalPhotos}장</h1>
  <p class="lead">광양·순천·여수·고흥 등 전남·경남 곳곳에서 ${BRAND}이 직접 세팅하고 운영한 행사 현장입니다. 무대·트러스, 음향·조명·LED 영상장비, 드론쇼까지 — 행사별로 무엇을 준비했는지 사진과 함께 기록합니다.</p>
  <nav class="toc" aria-label="행사 목록">${events.map((g) => `<a href="#${esc(g.id)}">${esc(g.event)}</a>`).join('')}</nav>
</div></header>

<main>
${sections}
  <div class="cta">
    <div><h3>이런 현장, 우리 행사에도 필요하다면</h3><p>행사 일정·장소·인원을 알려주시면 당일 안에 개략 견적을 드립니다. 상담·견적 무료.</p></div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;"><a class="btn" href="quote.html">자동 견적서</a><a class="btn" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25);" href="tel:15337295">1533-7295</a></div>
  </div>
</main>

<div id="lb" onclick="if(event.target===this)lbClose()"><button class="p" onclick="lbMove(-1)">‹</button><img id="lb-img" alt=""><button class="n" onclick="lbMove(1)">›</button><button class="x" onclick="lbClose()">✕</button><div class="c" id="lb-c"></div></div>
<footer class="foot">
  주식회사 브리지미디어 (${BRAND}) · 대표 김동길 · 사업자등록번호 813-81-02252 · 전라남도 광양시 광양읍 강변동길 1, 2층 · <a href="tel:15337295">1533-7295</a> · <a href="mailto:gilcaro@naver.com">gilcaro@naver.com</a><br>
  <a href="index.html">홈</a> · <a href="areas.html">서비스 지역</a> · <a href="quote.html">자동 견적서</a> · <a href="upload.html">사진 올리기</a> · 마지막 갱신 ${new Date().toISOString().slice(0, 10)}
</footer>
<script>
(function(){
  var lb=document.getElementById('lb'),im=document.getElementById('lb-img'),c=document.getElementById('lb-c'),list=[],idx=0;
  document.querySelectorAll('.ev').forEach(function(ev){
    var links=[].slice.call(ev.querySelectorAll('a.ph'));
    links.forEach(function(a,i){ a.addEventListener('click',function(e){ e.preventDefault(); list=links.map(function(l){return {src:l.href,alt:l.querySelector('img').alt};}); idx=i; show(); }); });
  });
  function show(){ im.src=list[idx].src; im.alt=list[idx].alt; c.textContent=(idx+1)+' / '+list.length; lb.classList.add('on'); document.body.style.overflow='hidden'; }
  window.lbClose=function(){ lb.classList.remove('on'); document.body.style.overflow=''; };
  window.lbMove=function(d){ if(!list.length) return; idx=(idx+d+list.length)%list.length; show(); };
  document.addEventListener('keydown',function(e){ if(!lb.classList.contains('on')) return; if(e.key==='Escape') lbClose(); if(e.key==='ArrowLeft') lbMove(-1); if(e.key==='ArrowRight') lbMove(1); });
})();
</script>
</body>
</html>
`;
writeFileSync(resolve(ROOT, 'gallery.html'), html, 'utf8');

// ── sitemap.xml ─────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const pages = [
  { loc: '/', lastmod: today, priority: '1.0', changefreq: 'weekly' },
  { loc: '/areas.html', lastmod: today, priority: '0.9', changefreq: 'monthly' },
  { loc: '/gallery.html', lastmod: latest, priority: '0.8', changefreq: 'weekly', images: photos.slice(0, 500) },
  { loc: '/quote.html', lastmod: today, priority: '0.7', changefreq: 'monthly' },
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map((p) => `  <url>
    <loc>${SITE}${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${(p.images || []).map((ph) => `
    <image:image><image:loc>${esc(imgUrl(ph))}</image:loc><image:title>${esc((ph.event || '') + (ph.place ? ' — ' + ph.place : ''))}</image:title></image:image>`).join('')}
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(resolve(ROOT, 'sitemap.xml'), sitemap, 'utf8');

console.log(`gallery.html: 행사 ${events.length}건, 사진 ${totalPhotos}장 · sitemap.xml 갱신 완료`);
