/**
 * 행사 이야기 — upload.html 로 올린 행사를 홈페이지의 글로 만든다
 * ────────────────────────────────────────────────────────────
 * photos.json 한 곳에서 행사별로 묶어(행사명 + 행사일 기준)
 *   /stories/            목록 페이지
 *   /stories/<주소>/     행사 하나당 글 페이지
 * 를 만든다. 글 내용은 사진 올릴 때 쓴 「행사 설명」이 그대로 본문이 된다.
 *
 * 설명을 쓰지 않은 행사는 글을 만들지 않는다.
 * 내용 없는 페이지가 늘면 검색에서 오히려 손해라서다.
 * (갤러리 카테고리 사진 207장은 행사일과 설명이 없어 자연히 제외된다)
 *
 * build-gallery.mjs 가 불러 쓰고, 돌려준 목록으로 sitemap·RSS 를 채운다.
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/** 날짜를 사람이 읽는 꼴로 */
const 날짜글 = (d) => {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : (d || '');
};

/** 본문에서 요약문 뽑기 — 첫 문장 위주로, 검색 결과에 보이는 글 */
const 요약 = (글, 길이 = 155) => {
  const 한줄 = String(글 || '').replace(/\s+/g, ' ').trim();
  if (한줄.length <= 길이) return 한줄;
  const 자른것 = 한줄.slice(0, 길이);
  const 끝 = Math.max(자른것.lastIndexOf('. '), 자른것.lastIndexOf('! '), 자른것.lastIndexOf('~ '));
  return (끝 > 60 ? 자른것.slice(0, 끝 + 1) : 자른것) + '…';
};

/* 본문에서 지역명을 찾아 지역 페이지로 연결한다 — 지역 검색 유입이 목적 */
const 지역주소 = {
  광양: '/gwangyang/', 순천: '/suncheon/', 여수: '/yeosu/', 고흥: '/goheung/',
  하동: '/hadong/', 남원: '/namwon/', 광주: '/gwangju/', 진주: '/jinju/', 통영: '/tongyeong/',
};

export function buildStories(옵션) {
  const { photos, ROOT, SITE, BRAND, esc, imgUrl, slug, categories } = 옵션;

  /* ── 1. 행사별로 묶기 ── */
  const 묶음 = new Map();
  for (const p of photos) {
    if (!p.date || !p.desc) continue;             // 업로드로 올린 행사만
    const 열쇠 = (p.event || '') + '|' + p.date;
    if (!묶음.has(열쇠)) {
      묶음.set(열쇠, {
        event: p.event || '행사 현장', date: p.date,
        place: p.place || '', desc: p.desc || '',
        cat: p.cat || '', thumb: p.thumb || '', cover: p.cover || '',
        photos: [],
      });
    }
    const g = 묶음.get(열쇠);
    if (!g.thumb && p.thumb) g.thumb = p.thumb;
    if (!g.cover && p.cover) g.cover = p.cover;
    g.photos.push(p);
  }

  const 카테고리이름 = new Map((categories || []).map((c) => [c.slug, c.name]));

  const stories = [...묶음.values()]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))   // 최신이 위로
    .map((s) => {
      // 한글 주소는 그대로 두면 사이트맵·공유 링크에서 인코딩이 엇갈린다.
      // 파일 이름은 한글, 링크로 쓰는 주소는 퍼센트 인코딩으로 통일한다.
      const 주소 = `${s.date.replace(/-/g, '')}-${slug(s.event)}`;
      const 대표 = s.thumb ? SITE + '/' + s.thumb.split('/').map(encodeURIComponent).join('/') : '';
      const 표지 = s.cover ? SITE + '/' + s.cover.split('/').map(encodeURIComponent).join('/') : '';
      return {
        ...s,
        주소, 경로: `/stories/${encodeURIComponent(주소)}/`,
        대표: 대표 || imgUrl(s.photos[0]),        // 썸네일 없이 올린 옛 행사는 첫 사진으로
        표지: 표지 || imgUrl(s.photos[0]),
        분야: 카테고리이름.get(s.cat) || '',
        요약: 요약(s.desc),
        지역: Object.keys(지역주소).filter((r) => (s.place + ' ' + s.event + ' ' + s.desc).includes(r)),
      };
    });

  /* 행사를 지우면 그 글 페이지도 없어져야 한다.
     남은 것만 다시 쓰면 지운 행사의 페이지가 그대로 살아남으므로 통째로 지우고 새로 만든다. */
  rmSync(resolve(ROOT, 'stories'), { recursive: true, force: true });

  if (!stories.length) return { stories: [], pages: [], rssItems: [] };

  /* ── 2. 공통 조각 ── */
  const 머리 = (제목, 설명, 경로, 이미지, 더넣기 = '') => `<!DOCTYPE html>
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
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${SITE}${경로}">
<link rel="alternate" type="application/rss+xml" title="큰길이벤트기획 소식" href="/rss.xml">
<meta name="naver-site-verification" content="ac711b26937bffbfe38e3394c5c9d2540a13b95c" />
<meta property="og:type" content="article">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${esc(제목)}">
<meta property="og:description" content="${esc(설명)}">
<meta property="og:url" content="${SITE}${경로}">
<meta property="og:image" content="${esc(이미지)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css">
${더넣기}
<style>
  :root{ --amber:#F59E0B; --amber-ink:#B45309; --dark:#0B0A10; --light:#FBF8F2; --ink:#16141C; --ink-2:#5B5664; --ink-3:#8A8494; --line:rgba(22,20,28,.09); }
  *{ box-sizing:border-box;font-family:'Pretendard',system-ui,sans-serif;word-break:keep-all; }
  html{ scroll-behavior:smooth; } body{ margin:0;background:var(--light);color:var(--ink);-webkit-font-smoothing:antialiased; }
  a{ color:inherit; } img{ display:block;max-width:100%; }
  .topbar{ position:sticky;top:0;z-index:40;background:rgba(11,10,16,.92);backdrop-filter:blur(14px);color:#fff;border-bottom:1px solid rgba(255,255,255,.08); }
  .topbar-in{ max-width:64rem;margin:0 auto;padding:.7rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem; }
  .brand{ text-decoration:none;font-weight:800;letter-spacing:-.02em;font-size:.95rem; }
  .topnav a{ color:#B9B3C2;text-decoration:none;font-size:.875rem;margin-left:1.3rem; } .topnav a:hover{ color:#fff; }
  @media (max-width:640px){ .topnav a{ margin-left:.85rem;font-size:.8rem; } .topnav a.hide-sm{ display:none; } }
  .crumb{ max-width:64rem;margin:0 auto;padding:1.1rem 1.25rem .2rem;font-size:.78rem;color:var(--ink-3); }
  .crumb a{ text-decoration:none;color:var(--ink-3); } .crumb a:hover{ color:var(--amber-ink); }
  main{ max-width:64rem;margin:0 auto;padding:1.5rem 1.25rem 4.5rem; }
  .eyebrow{ display:inline-flex;align-items:center;gap:.55rem;font-size:.74rem;font-weight:800;letter-spacing:.14em;color:var(--amber-ink);margin-bottom:.75rem; }
  .eyebrow::before{ content:'';width:1.4rem;height:1px;background:linear-gradient(90deg,transparent,var(--amber)); }
  h1{ font-size:clamp(1.65rem,3.6vw,2.5rem);font-weight:800;line-height:1.28;letter-spacing:-.03em;margin:0 0 .9rem;text-wrap:balance; }
  .meta{ display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:1.8rem; }
  .meta span,.meta a{ font-size:.8rem;font-weight:700;text-decoration:none;padding:.3rem .8rem;border-radius:9999px;background:rgba(22,20,28,.055);color:var(--ink-2); }
  .meta a{ background:rgba(245,158,11,.13);color:var(--amber-ink); } .meta a:hover{ background:rgba(245,158,11,.26); }
  .hero-img{ width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:1.1rem;margin-bottom:2rem;background:#16141C;box-shadow:0 1px 2px rgba(22,20,28,.05),0 20px 44px -22px rgba(22,20,28,.3); }
  .body{ font-size:1.02rem;line-height:1.95;color:var(--ink-2);white-space:pre-wrap;max-width:70ch;margin:0 0 2.5rem; }
  h2{ font-size:1.15rem;font-weight:800;letter-spacing:-.02em;margin:0 0 1rem; }
  .grid{ display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:.7rem;margin-bottom:2.5rem; }
  .ph{ display:block;aspect-ratio:4/3;border-radius:.8rem;overflow:hidden;background:#16141C;box-shadow:0 1px 2px rgba(22,20,28,.05),0 14px 34px -18px rgba(22,20,28,.25); }
  .ph img{ width:100%;height:100%;object-fit:cover;transition:transform .5s ease;filter:saturate(1.12) contrast(1.03); }
  .ph:hover img{ transform:scale(1.05); }
  .cta{ background:var(--dark);color:#fff;border-radius:1.25rem;padding:2rem;display:flex;align-items:center;justify-content:space-between;gap:1.5rem;flex-wrap:wrap; }
  .cta h3{ margin:0 0 .3rem;font-size:1.25rem;font-weight:800; } .cta p{ margin:0;color:#B9B3C2;font-size:.9rem; }
  .btn{ display:inline-flex;align-items:center;gap:.5rem;padding:.8rem 1.5rem;border-radius:9999px;font-weight:700;font-size:.92rem;text-decoration:none;background:var(--amber);color:#0a0a0a;white-space:nowrap; }
  .more{ margin-top:2.5rem;padding-top:1.75rem;border-top:1px solid var(--line); }
  .more h2{ margin-bottom:1rem; }
  .cards{ display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:1rem; }
  .card{ display:block;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:1rem;overflow:hidden;transition:transform .3s,box-shadow .3s;box-shadow:0 1px 2px rgba(22,20,28,.04),0 14px 34px -20px rgba(22,20,28,.2); }
  .card:hover{ transform:translateY(-3px);box-shadow:0 1px 2px rgba(22,20,28,.05),0 22px 44px -20px rgba(22,20,28,.3); }
  .card img{ width:100%;aspect-ratio:1;object-fit:cover;background:#16141C; }
  .card .in{ padding:.9rem 1rem 1.1rem; }
  .card .d{ font-size:.72rem;font-weight:700;color:var(--amber-ink);margin-bottom:.3rem; }
  .card .t{ font-size:.95rem;font-weight:800;line-height:1.45;letter-spacing:-.02em;margin-bottom:.35rem; }
  .card .s{ font-size:.8rem;color:var(--ink-2);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
  .foot{ background:var(--dark);color:#7E7889;font-size:.78rem;padding:2rem 1.25rem;text-align:center;line-height:1.8; }
  .foot a{ color:#B9B3C2;text-decoration:none; }
</style>
  <script defer src="https://www.ai-make.co.kr/stats/stats.js" data-site="keungil"></script>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  <a class="brand" href="/">${BRAND}</a>
  <nav class="topnav">
    <a href="/company.html" class="hide-sm">회사소개</a>
    <a href="/stories/">행사 이야기</a>
    <a href="/gallery.html">갤러리</a>
    <a href="/areas.html" class="hide-sm">지역안내</a>
    <a href="/quote.html">견적</a>
  </nav>
</div></div>`;

  const 꼬리 = `<div class="foot">
  <div>${BRAND} · 주식회사 브리지미디어 · 대표 김동길 · 사업자등록번호 813-81-02252</div>
  <div>전남광주통합특별시 광양시 광양읍 강변동길 1, 2층 · <a href="tel:1533-7295">1533-7295</a> · gilcaro@naver.com</div>
  <div style="margin-top:.6rem;"><a href="/">홈</a> · <a href="/stories/">행사 이야기</a> · <a href="/gallery.html">갤러리</a> · <a href="/areas.html">서비스 지역</a> · <a href="/quote.html">자동 견적서</a></div>
</div>
</body>
</html>
`;

  /* ── 3. 글 페이지 ── */
  mkdirSync(resolve(ROOT, 'stories'), { recursive: true });

  stories.forEach((s, i) => {
    const 사진들 = s.photos
      .map((p, n) => `<a class="ph" href="${imgUrl(p)}" target="_blank" rel="noopener"><img src="${imgUrl(p)}" alt="${esc(`${s.event} 현장 사진 ${n + 1} — 무대·음향·조명·LED 세팅 · ${BRAND}`)}" loading="${n < 4 ? 'eager' : 'lazy'}" decoding="async" width="800" height="600"></a>`)
      .join('\n      ');

    const 이웃 = [stories[i - 1], stories[i + 1]].filter(Boolean);
    const 이웃카드 = 이웃.length ? `
  <section class="more">
    <h2>다른 행사 이야기</h2>
    <div class="cards">
      ${이웃.map((o) => 카드(o, esc)).join('\n      ')}
    </div>
  </section>` : '';

    const 지역칩 = s.지역.map((r) => `<a href="${지역주소[r]}">${r} 행사대행</a>`).join('');
    const 분야칩 = s.cat ? `<a href="/gallery.html#${esc(s.cat)}">${esc(s.분야 || s.cat)}</a>` : '';

    const jsonld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: '행사 이야기', item: SITE + '/stories/' },
          { '@type': 'ListItem', position: 3, name: s.event, item: SITE + s.경로 } ] },
        { '@type': 'BlogPosting',
          '@id': SITE + s.경로,
          headline: s.event,
          description: s.요약,
          image: [s.표지, ...s.photos.slice(0, 6).map((p) => imgUrl(p))],
          datePublished: s.date,
          dateModified: s.date,
          inLanguage: 'ko',
          articleSection: s.분야 || '행사 대행',
          keywords: [s.event, ...s.지역.map((r) => `${r} 행사대행`), '행사기획', '무대 설치', '음향장비 대여', 'LED 영상장비 대여', BRAND].join(', '),
          author: { '@type': 'Organization', name: BRAND, '@id': SITE + '/#business' },
          publisher: { '@id': SITE + '/#business' },
          mainEntityOfPage: { '@type': 'WebPage', '@id': SITE + s.경로 },
          ...(s.place ? { contentLocation: { '@type': 'Place', name: s.place } } : {}),
        },
      ],
    };

    const 제목 = `${s.event} — ${BRAND} 행사 현장`;
    const 페이지 = 머리(제목, s.요약, s.경로, s.표지,
      `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`) + `
<div class="crumb"><a href="/">홈</a> › <a href="/stories/">행사 이야기</a> › ${esc(s.event)}</div>
<main>
  <article>
    <div class="eyebrow">${esc(날짜글(s.date))}</div>
    <h1>${esc(s.event)}</h1>
    <div class="meta">
      ${s.place ? `<span>${esc(s.place)}</span>` : ''}
      ${분야칩}
      ${지역칩}
      <span>사진 ${s.photos.length}장</span>
    </div>
    <img class="hero-img" src="${imgUrl(s.photos[0])}" alt="${esc(`${s.event} — ${BRAND} 현장`)}" width="1600" height="900">
    <div class="body">${esc(s.desc)}</div>

    <h2>현장 사진 ${s.photos.length}장</h2>
    <div class="grid">
      ${사진들}
    </div>

    <div class="cta">
      <div>
        <h3>비슷한 행사를 준비하고 계신가요?</h3>
        <p>장비와 인력을 직접 보유해 견적부터 현장 운영까지 한 팀이 맡습니다. 상담은 무료입니다.</p>
      </div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;">
        <a class="btn" href="/quote.html">바로 견적 내보기</a>
        <a class="btn" href="tel:1533-7295" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25);">1533-7295</a>
      </div>
    </div>
  </article>
  ${이웃카드}
</main>` + 꼬리;

    mkdirSync(resolve(ROOT, 'stories', s.주소), { recursive: true });
    writeFileSync(resolve(ROOT, 'stories', s.주소, 'index.html'), 페이지, 'utf8');
  });

  /* ── 4. 목록 페이지 ── */
  const 목록jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: '행사 이야기', item: SITE + '/stories/' } ] },
      { '@type': 'Blog',
        '@id': SITE + '/stories/',
        name: `${BRAND} 행사 이야기`,
        description: '광주·전남·경남에서 진행한 행사 현장 기록. 어떤 장비로 어떻게 준비했는지 그날의 이야기를 남깁니다.',
        inLanguage: 'ko',
        publisher: { '@id': SITE + '/#business' },
        blogPost: stories.map((s) => ({
          '@type': 'BlogPosting', headline: s.event, url: SITE + s.경로,
          datePublished: s.date, image: s.표지, description: s.요약,
        })) },
    ],
  };

  const 목록제목 = `행사 이야기 — 현장 기록 ${stories.length}건 | ${BRAND}`;
  const 목록설명 = `${BRAND}이 광주·전남·경남에서 진행한 행사 현장 기록 ${stories.length}건. 지역축제·기업행사·기공식·시상식·체육대회를 어떤 무대와 음향·조명·LED 구성으로 준비했는지 그날의 이야기를 남깁니다.`;

  const 목록 = 머리(목록제목, 목록설명, '/stories/', stories[0].표지,
    `<script type="application/ld+json">${JSON.stringify(목록jsonld)}</script>`) + `
<div class="crumb"><a href="/">홈</a> › 행사 이야기</div>
<main>
  <div class="eyebrow">STORIES</div>
  <h1>행사 이야기</h1>
  <p class="body" style="margin-bottom:2.25rem;">현장에서 무엇을 어떻게 준비했는지 그날의 기록을 남깁니다.
장비 구성과 운영 방식이 궁금하시면 비슷한 행사를 찾아 읽어보세요.</p>
  <div class="cards">
    ${stories.map((s) => 카드(s, esc)).join('\n    ')}
  </div>

  <div class="cta" style="margin-top:3rem;">
    <div>
      <h3>준비 중인 행사가 있으신가요?</h3>
      <p>항목만 고르시면 즉시 견적서가 나옵니다. 상담은 무료입니다.</p>
    </div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;">
      <a class="btn" href="/quote.html">바로 견적 내보기</a>
      <a class="btn" href="tel:1533-7295" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25);">1533-7295</a>
    </div>
  </div>
</main>` + 꼬리;

  writeFileSync(resolve(ROOT, 'stories', 'index.html'), 목록, 'utf8');

  /* ── 5. sitemap · RSS 용 자료 ── */
  const pages = [
    { loc: '/stories/', lastmod: stories[0].date, priority: '0.9', changefreq: 'weekly' },
    ...stories.map((s) => ({ loc: s.경로, lastmod: s.date, priority: '0.8', changefreq: 'monthly', images: s.photos.slice(0, 20) })),
  ];
  const rssItems = stories.map((s) => ({
    title: `${s.event}${s.place ? ' (' + s.place + ')' : ''}`,
    link: SITE + s.경로,
    desc: s.요약,
    date: s.date,
  }));

  return { stories, pages, rssItems };
}

/** 목록·이웃에 쓰는 카드 한 장 */
function 카드(s, esc) {
  return `<a class="card" href="${s.경로}">
        <img src="${esc(s.대표)}" alt="${esc(s.event + ' 대표 이미지')}" loading="lazy" decoding="async" width="600" height="600">
        <div class="in">
          <div class="d">${esc(날짜글(s.date))}${s.place ? ' · ' + esc(s.place) : ''}</div>
          <div class="t">${esc(s.event)}</div>
          <div class="s">${esc(s.요약)}</div>
        </div>
      </a>`;
}
