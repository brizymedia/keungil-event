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
let photos = [], data = {};
try {
  const r = await fetch(PHOTOS_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  data = await r.json();
  photos = data.photos || [];
} catch (e) {
  console.error('photos.json 을 불러오지 못했습니다:', e.message);
  process.exit(1);
}


/* ── 카테고리별 SEO 메타 (현장 사진의 현수막·LED에서 확인한 실제 행사·지역) ── */
const CAT_SEO = {
  festival: {
    name: '지역축제 & 공연행사',
    regions: ['고흥', '순천', '광양', '여수'],
    events: ['제24회 녹동바다불꽃축제 (고흥 녹동항)', '고흥 남열해돋이해수욕장 해맞이 행사', '순천조례호수공원 제7회 물총축제', '제2회 남도마을 한가위 축제 및 노래자랑'],
    desc: '고흥 녹동항 제24회 녹동바다불꽃축제, 순천조례호수공원 물총축제, 고흥 남열해돋이 해맞이 행사 등 지역축제 현장입니다. 무대·트러스 설치부터 라인어레이 음향, 무빙헤드 조명, LED 전광판 영상까지 큰길이벤트기획이 종합 대행했습니다.',
  },
  conference: {
    name: '컨퍼런스 · 포럼 · 기념식',
    regions: ['광양', '고흥', '여수', '순천', '전남'],
    events: ['2025 광양시 정책비전 투어', '2026 옥룡면 시민과의 대화', '국립소록도병원 개원 110주년 기념식 및 제23회 한센인의 날', '가야문화권 지역발전 시장·군수 협의회', '여순10·19 여순추모공원 참배'],
    desc: '광양시 정책비전 투어와 시민과의 대화, 국립소록도병원 개원 110주년 기념식 및 제23회 한센인의 날, 가야문화권 시장·군수 협의회 등 기관·지자체 행사 현장입니다. 회의 음향과 LED 영상, 다중 카메라 중계와 의전 세팅을 한 팀이 맡아 운영했습니다.',
  },
  ceremony: {
    name: '시상식 & 이취임식',
    regions: ['여수', '광양', '순천', '전남'],
    events: ['여수라이온스클럽 창립 제59주년 및 회장 이·취임식', 'JCI 광양청년회의소 2026 회장단·감사 이·취임식', '제10·11대 재광양고흥군향우회 회장단 이·취임식', '태인동청년회 제39대 회장단 이·취임식 및 전역식', '제53차 전남지구JC 회원대회', '(사)한국권투협회 전남지회 발대식 및 취임식'],
    desc: '여수라이온스클럽 창립 59주년, JCI 광양청년회의소 이·취임식, 재광양고흥군향우회 회장단 이·취임식, 전남지구JC 회원대회 등 단체 시상식과 이·취임식 현장입니다. 식순 기획과 무대 연출, 현수막·LED 영상, 음향·조명 세팅을 준비했습니다.',
  },
  groundbreaking: {
    name: '기공식 · 오픈식 · 브랜드 론칭',
    regions: ['무안', '광주', '전남'],
    events: ['광주호남모델협회 워크숍 비치웨어 패션쇼 (무안 오배캠핑 풀빌라)'],
    desc: '기공식과 준공식, 오픈식과 브랜드 론칭, 패션쇼 등 브랜드 행사 현장입니다. 시삽·제막 의전 세팅부터 야외 무대와 음향·조명까지 현장 조건에 맞춰 준비했습니다.',
  },
  sports: {
    name: '체육대회 & 명랑운동회',
    regions: ['순천', '여수', '광양'],
    events: ['2025 제5회 순천시 읍면동 체육대회 (팔마실내체육관)', '제10회 여수진남초등학교 총동문 한마음체육대회', '제38차 순천도사초등학교 총동문 체육대회'],
    desc: '순천시 읍면동 체육대회, 여수진남초·순천도사초 총동문 한마음체육대회 등 체육대회와 명랑운동회 현장입니다. 실내체육관과 운동장 여건에 맞춘 무대·음향·LED 영상, 경품과 진행 MC를 함께 준비했습니다.',
  },
  school: {
    name: '학교 행사 & 축제',
    regions: ['여수', '광양', '순천'],
    events: ['여수아리울중학교 제60회 아리울제', '한올고등학교 한꿈축제', 'HOSEONG FESTA 2025', '광양 유치원 꿈·끼 사랑 발표회'],
    desc: '여수아리울중학교 아리울제, 한올고 한꿈축제, 호성 페스타 등 중·고교 축제와 유치원·초등 발표회 현장입니다. 강당과 체육관 여건에 맞춰 무대·음향·조명·영상을 구성하고 리허설까지 진행했습니다.',
  },
  busking: {
    name: '버스킹 & 음악회',
    regions: ['광양', '하동'],
    events: ['광양 배알도 별빛버스킹 (광양시 문화예술과)', '제23회 광양매화축제 공연 무대'],
    desc: '광양 배알도 별빛버스킹과 광양매화축제 공연 무대 등 거리 버스킹과 야외 음악회 현장입니다. 소규모 공연에 맞는 음향과 조명, 이동식 무대를 준비하고 공연팀 섭외와 진행까지 맡았습니다.',
  },
  film: {
    name: '공연 영상 촬영 & 중계',
    regions: ['전남', '광양', '여수'],
    events: ['National Youth Dance Festival 전국 청소년 댄스 페스티벌 공연 촬영·중계'],
    desc: '전국 청소년 댄스 페스티벌 등 공연장 영상 촬영과 다중 카메라 중계 현장입니다. 지미집과 슬라이더 카메라, 4K 스위칭과 조명 콘솔을 자체 인력이 운용하며 무대 조명·헤이즈 연출까지 함께 진행했습니다.',
  },
};

/* 지역명 → areas.html 앵커 */
const REGION_ANCHOR = { 광양:'gwangyang', 순천:'suncheon', 여수:'yeosu', 고흥:'goheung', 하동:'hadong', 남원:'namwon', 광주:'gwangju', 진주:'jinju', 통영:'tongyeong' };

// 카테고리(폴더)별 묶기 — photos.json 의 categories 순서를 따른다
const cats = (data.categories || []).filter((c) => c.count > 0);
const byCat = new Map(cats.map((c) => {
  const seo = CAT_SEO[c.slug] || {};
  return [c.slug, { ...c, ...seo, id: c.slug, photos: [] }];
}));
for (const p of photos) {
  const g = byCat.get(p.cat);
  if (g) g.photos.push(p);
}
const events = [...byCat.values()].filter((g) => g.photos.length);

const latest = (data.updated || new Date().toISOString()).slice(0, 10);
const totalPhotos = photos.length;

// ── HTML ────────────────────────────────────────────────
const sections = events.map((g) => {
  const regions = g.regions || [];
  const evs = g.events || [];
  // 사진 alt: 분야 + 지역 + 서비스 키워드를 돌아가며 넣어 지역 검색에 걸리게 한다
  const imgs = g.photos.map((p, i) => {
    const region = regions.length ? regions[i % regions.length] : '광주·전남·경남';
    const alt = `${region} ${g.name} 현장 — 무대·음향·조명·LED 세팅 · ${BRAND} (${i + 1})`;
    return `<a class="ph" href="${imgUrl(p)}" data-i="${i}" target="_blank" rel="noopener"><img src="${imgUrl(p)}" alt="${esc(alt)}" loading="lazy" decoding="async" width="800" height="600"></a>`;
  }).join('\n        ');
  const regionTags = regions.length
    ? `<div class="ev-regions">${regions.map((r) => `<a href="areas.html#${esc(REGION_ANCHOR[r] || '')}">${esc(r)}</a>`).join('')}</div>` : '';
  const evList = evs.length
    ? `<div class="ev-list"><h3>이 분야에서 진행한 주요 행사</h3><ul>${evs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '';
  return `
  <article class="ev" id="${esc(g.id)}" itemscope itemtype="https://schema.org/ImageGallery">
    <header>
      <div class="ev-meta">사진 ${g.photos.length}장${regions.length ? ' · ' + esc(regions.join(' · ')) : ''}</div>
      <h2 itemprop="name">${esc(regions[0] ? regions[0] + ' · ' : '')}${esc(g.name)}</h2>
      <p class="ev-desc" itemprop="description">${esc(g.desc || '')}</p>
      ${regionTags}
    </header>
    <div class="grid">
        ${imgs}
    </div>
    ${evList}
    <div class="ev-cta"><a href="quote.html">${esc(g.name)} 견적 받기</a><a href="areas.html">지역별 안내</a><a href="index.html#services">서비스 자세히</a></div>
  </article>`;
}).join('\n');

const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: '행사 갤러리', item: SITE + '/gallery.html' } ] },
    { '@type': 'CollectionPage', '@id': SITE + '/gallery.html', url: SITE + '/gallery.html', name: `${BRAND} 행사 갤러리`, inLanguage: 'ko',
      description: `광양·순천·여수·고흥 등 광주·전남·경남에서 ${BRAND}이 진행한 행사 현장 사진 ${totalPhotos}장. 행사 종류별 무대·음향·조명·LED 세팅 기록.`,
      publisher: { '@id': SITE + '/#business' },
      hasPart: events.map((g) => ({ '@type': 'ImageGallery', name: (g.regions && g.regions[0] ? g.regions[0] + ' · ' : '') + g.name,
        url: SITE + '/gallery.html#' + g.id,
        description: g.desc || '',
        keywords: [...(g.regions || []).flatMap((r) => [`${r} ${g.name}`, `${r} 이벤트회사`, `${r} 행사대행`]), ...(g.events || [])].join(', '),
        contentLocation: (g.regions || []).map((r) => ({ '@type': 'Place', name: r, address: { '@type': 'PostalAddress', addressLocality: r, addressCountry: 'KR' } })),
        about: (g.events || []).map((e) => ({ '@type': 'Event', name: e })),
        image: g.photos.slice(0, 12).map((p) => imgUrl(p)) })) }
  ]
};

/* 페이지 전체 키워드 — 지역 × 분야 조합 */
const ALL_REGIONS = [...new Set(events.flatMap((g) => g.regions || []))];
const PAGE_KEYWORDS = [
  ...ALL_REGIONS.flatMap((r) => [`${r} 이벤트회사`, `${r} 행사대행`, `${r} 무대 설치`, `${r} 음향장비 대여`, `${r} 조명 대여`, `${r} LED 전광판 대여`]),
  ...events.flatMap((g) => (g.regions || []).slice(0, 2).map((r) => `${r} ${g.name.replace(/\s*[&·]\s*/g, ' ')}`)),
  ...events.flatMap((g) => (g.events || []).map((e) => e.replace(/\s*\(.*?\)\s*/g, ''))),
  '행사 사진', '행사 현장 사진', '이벤트회사 추천', BRAND,
].join(', ');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0B0A10">
<title>행사 갤러리 — 지역축제·컨퍼런스·시상식·체육대회 현장 사진 ${totalPhotos}장 | ${BRAND}</title>
<meta name="description" content="${esc(`${BRAND}이 광주·전남·경남(광양·순천·여수·고흥·하동·남원·광주·진주·통영)에서 진행한 지역축제·컨퍼런스·시상식·기공식·체육대회·학교행사·버스킹·영상촬영 현장. 무대·트러스, 음향·조명·LED 영상장비 세팅 기록 ${events.length}개 분야, 사진 ${totalPhotos}장.`)}">
<meta name="keywords" content="${esc(PAGE_KEYWORDS)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${SITE}/gallery.html">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="행사 갤러리 — ${BRAND} 현장 사진">
<meta property="og:description" content="광주·전남·경남 행사 현장 ${events.length}개 분야 · 사진 ${totalPhotos}장. 무대·음향·조명·LED.">
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
  .ev-regions{ display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 1.2rem; }
  .ev-regions a{ font-size:.78rem;font-weight:700;text-decoration:none;padding:.28rem .75rem;border-radius:9999px;background:rgba(245,158,11,.12);color:var(--amber-ink);transition:all .25s; }
  .ev-regions a:hover{ background:rgba(245,158,11,.24); }
  .ev-list{ margin-top:1.2rem;padding:1rem 1.2rem;border-radius:.9rem;background:rgba(22,20,28,.035);border:1px solid var(--line); }
  .ev-list h3{ margin:0 0 .5rem;font-size:.76rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3); }
  .ev-list ul{ margin:0;padding:0;list-style:none;display:grid;gap:.35rem; }
  .ev-list li{ font-size:.88rem;color:var(--ink-2);line-height:1.6;padding-left:1.1rem;position:relative; }
  .ev-list li::before{ content:'';position:absolute;left:0;top:.55rem;width:.35rem;height:.35rem;border-radius:50%;background:var(--amber); }
  .ev-cta{ margin-top:1.1rem;display:flex;gap:.5rem;flex-wrap:wrap; }
  .ev-cta a{ font-size:.82rem;font-weight:700;text-decoration:none;padding:.5rem 1rem;border-radius:9999px;border:1px solid var(--line);color:var(--ink-2);transition:all .25s; }
  .ev-cta a:hover{ border-color:var(--amber);color:var(--ink);background:rgba(245,158,11,.07); }
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
  <h1>행사 갤러리 — ${events.length}개 분야 · 사진 ${totalPhotos}장</h1>
  <p class="lead">광양·순천·여수·고흥 등 광주·전남·경남 곳곳에서 ${BRAND}이 직접 세팅하고 운영한 현장입니다. 무대·트러스, 음향·조명·LED 영상장비, 드론쇼까지 — 행사 종류별로 모아 보실 수 있습니다.</p>
  <nav class="toc" aria-label="행사 분야">${events.map((g) => `<a href="#${esc(g.id)}">${esc(g.name)} <span style="opacity:.6;font-weight:600;">${g.photos.length}</span></a>`).join('')}</nav>
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
  주식회사 브리지미디어 (${BRAND}) · 대표 김동길 · 사업자등록번호 813-81-02252 · 전남광주통합특별시 광양시 광양읍 강변동길 1, 2층 · <a href="tel:15337295">1533-7295</a> · <a href="mailto:gilcaro@naver.com">gilcaro@naver.com</a><br>
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
/* 사진 사이트맵 제목·설명에도 지역 키워드를 넣는다 */
const catOf = new Map(events.map((g) => [g.slug, g]));
const photoIdx = new Map();
function imgTitle(ph) {
  const g = catOf.get(ph.cat); if (!g) return ph.event || '';
  const i = (photoIdx.get(ph.cat) || 0); photoIdx.set(ph.cat, i + 1);
  const r = (g.regions && g.regions.length) ? g.regions[i % g.regions.length] : '광주·전남·경남';
  return `${r} ${g.name} 현장 — ${BRAND}`;
}
function imgCaption(ph) {
  const g = catOf.get(ph.cat); if (!g) return '';
  return `${g.name} 무대·트러스 설치, 음향·조명·LED 영상장비 세팅. ${(g.regions || []).join(' · ')} 지역 행사 대행 ${BRAND}.`;
}

const today = new Date().toISOString().slice(0, 10);
const pages = [
  { loc: '/', lastmod: today, priority: '1.0', changefreq: 'weekly' },
  { loc: '/company.html', lastmod: today, priority: '0.9', changefreq: 'monthly' },
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
    <image:image><image:loc>${esc(imgUrl(ph))}</image:loc><image:title>${esc(imgTitle(ph))}</image:title><image:caption>${esc(imgCaption(ph))}</image:caption></image:image>`).join('')}
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(resolve(ROOT, 'sitemap.xml'), sitemap, 'utf8');

console.log(`gallery.html: ${events.length}개 분야, 사진 ${totalPhotos}장 · sitemap.xml 갱신 완료`);
