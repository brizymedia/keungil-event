#!/usr/bin/env node
// 칼럼 글(_column/posts)의 네이버 블로그용 원고(_column/naver) 검사.
//   node scripts/naver-column-check.mjs                 전부 검사
//   node scripts/naver-column-check.mjs <파일이름…>      그 원고만 (예: 2026-10-09-grant-application-event-prep.json)
// 규칙은 _blog/GUIDE.md 9장과 같다: 원글과 25% 넘게 겹치면 막고(18% 넘으면 주의), 원글에 없는 숫자 · 마크다운 · 금지어를 막는다.
// (_blog/naver 원고는 scripts/blog-check.mjs 가 따로 검사한다.)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NDIR = resolve(ROOT, '_column', 'naver');
const PDIR = resolve(ROOT, '_column', 'posts');
const LIB = JSON.parse(readFileSync(resolve(ROOT, '_column', 'photos.json'), 'utf8'));
const LIBSRC = new Set((LIB.사진 || []).map((x) => x.src));

const 글자수 = (s) => [...String(s || '').replace(/\s+/g, '')].length;
const 붙여 = (s) => String(s || '').replace(/\s+/g, '');
const 문자열들 = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => 문자열들(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => 문자열들(x, out));
  return out;
};
const 글자만 = (s) => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const 조각 = (글) => {
  const t = String(글 || '').replace(/[\s\d.,·—\-()［\]\[/:%~]+/g, '');
  const s = new Set();
  for (let i = 0; i + 4 <= t.length; i++) s.add(t.slice(i, i + 4));
  return s;
};
const 겹침 = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };

const 오류 = [];
const 경고 = [];
const 읽기 = (dir, f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const 모든파일 = existsSync(NDIR) ? readdirSync(NDIR).filter((f) => f.endsWith('.json')).sort() : [];
const 인자 = process.argv.slice(2).map((a) => a.split(/[\\/]/).pop());
const 대상 = 인자.length ? 인자 : 모든파일;

const 원고글 = (n) => [n.제목, ...n.본문.filter((x) => typeof x === 'string'), ...n.본문.filter((x) => x && x.사진).map((x) => x.설명)].join('\n');

for (const f of 대상) {
  const 틀림 = (m) => 오류.push(`✗ naver/${f}: ${m}`);
  const 주의 = (m) => 경고.push(`△ naver/${f}: ${m}`);
  if (!existsSync(join(NDIR, f))) { 틀림('파일이 없다'); continue; }
  if (!existsSync(join(PDIR, f))) { 틀림(`같은 이름의 원글(_column/posts/${f})이 없다 — 네이버 원고는 원글과 파일 이름이 같아야 한다`); continue; }
  const n = 읽기(NDIR, f);
  const 원 = 읽기(PDIR, f);
  if (!Array.isArray(n.본문) || !n.본문.length) { 틀림('본문 배열이 없다'); continue; }
  if (n.본문.some((x) => typeof x !== 'string' && !(x && typeof x === 'object' && x.사진))) { 틀림('본문 항목은 글자이거나 { "사진", "설명" } 이어야 한다'); continue; }

  const 문단 = n.본문.filter((x) => typeof x === 'string');
  const 사진 = n.본문.filter((x) => x && typeof x === 'object');
  const 본문글자 = 문단.reduce((a, s) => a + 글자수(s), 0);

  if (n.날짜 !== 원.date) 틀림(`날짜는 원글과 같아야 한다(${원.date})`);
  if (글자수(n.제목) < 12 || 글자수(n.제목) > 40) 틀림(`제목은 12~40자 (지금 ${글자수(n.제목)})`);
  if (n.제목 === 원.title) 틀림('제목이 홈페이지 글과 똑같다 — 네이버용 제목은 새로 짓는다');
  const 키워드들 = [원.keyword?.main, ...(원.keyword?.sub || [])].filter(Boolean).map(붙여);
  if (!키워드들.some((k) => 붙여(n.제목).includes(k))) 틀림(`제목에 핵심 키워드(${키워드들.join(' · ')}) 중 하나가 있어야 한다`);
  if (문단.length < 6) 틀림(`문단은 6개 이상 (지금 ${문단.length})`);
  if (본문글자 < 700 || 본문글자 > 2500) 틀림(`본문은 700~2500자 (지금 ${본문글자})`);
  문단.forEach((s, i) => { if (s.split('\n').length > 1) 주의(`${i + 1}번째 문단에 줄바꿈이 있다 — 문단은 한 덩어리로`); });

  if (사진.length < 2) 틀림(`사진은 2장 이상 (지금 ${사진.length})`);
  for (const s of 사진) {
    if (!LIBSRC.has(s.사진)) 틀림(`사진 ${s.사진} 이 _column/photos.json 에 없다`);
    if (글자수(s.설명) < 8 || 글자수(s.설명) > 120) 틀림(`사진 설명은 8~120자: ${s.사진}`);
    const 목록 = (LIB.사진 || []).find((x) => x.src === s.사진);
    // 설명 문장은 다듬어도 되지만 행사 이름(「 — 」 앞)은 목록 캡션과 같아야 한다 — 찍은 곳을 바꾸지 않는다
    if (목록 && 목록.캡션 && 목록.캡션.split(' — ')[0] !== String(s.설명).split(' — ')[0]) 틀림(`사진 설명의 행사 이름이 목록 캡션과 다르다(${s.사진}): 「${목록.캡션.split(' — ')[0]}」`);
  }
  const 원사진 = new Set([원.cover?.src, ...(원.sections || []).flatMap((x) => x.blocks.filter((b) => b.img).map((b) => b.img.src))].filter(Boolean));
  if (사진.length && 사진.every((s) => 원사진.has(s.사진))) 주의('사진이 전부 원글과 같다 — 되도록 다른 컷으로');

  const 글 = 원고글(n);
  if (/\*\*|^\s*#|\|.*\||\[[^\]]+\]\([^)]+\)/m.test(글)) 틀림('마크다운(굵게 · 표 · 링크 · # 소제목)은 네이버 에디터에서 글자 그대로 보인다 — 빼라');
  if (/https?:\/\//.test(글)) 틀림('본문에 주소를 쓰지 않는다 — 홈페이지 링크는 페이지가 자동으로 붙인다');
  if (/\d[\d,]*\s*원|100\s*%|무조건|보장|업계\s*1위|최초/.test(글)) 틀림('가격 · 100% · 무조건 · 보장 · 1위 · 최초 같은 말은 쓰지 않는다');
  if (/010[-\s]?\d{3,4}|1533/.test(글)) 틀림('전화번호는 페이지가 자동으로 붙인다');

  const 원본글 = 문자열들(원).join('\n');
  const 새숫자 = [...new Set((글.match(/\d+(?:[.,]\d+)*/g) || []))].filter((x) => !원본글.includes(x));
  if (새숫자.length) 틀림(`원글에 없는 숫자: ${새숫자.join(', ')} — 새로 조사하지 않는다`);

  const 비교 = 겹침(조각(글), 조각(글자만(원본글)));
  if (비교 > 0.25) 틀림(`원글과 ${Math.round(비교 * 100)}% 겹친다(25% 초과) — 도입 · 순서 · 문장을 새로 짠다`);
  else if (비교 > 0.18) 주의(`원글과 ${Math.round(비교 * 100)}% 겹친다(18% 초과)`);

  for (const g of 모든파일) {
    if (g === f) continue;
    const 다른 = 겹침(조각(글), 조각(원고글(읽기(NDIR, g))));
    if (다른 > 0.25) 틀림(`다른 네이버 원고(${g})와 ${Math.round(다른 * 100)}% 겹친다`);
  }

  const 태그 = n.태그;
  if (!Array.isArray(태그) || 태그.length < 3 || 태그.length > 10) 틀림('태그는 3~10개');
  else if (태그.some((t) => /[#\s]/.test(t))) 틀림('태그는 # 없이 붙여 쓴 낱말로');

  console.log(`${오류.some((m) => m.includes(`naver/${f}:`)) ? '✗' : '✓'} ${f} — 문단 ${문단.length} · ${본문글자}자 · 사진 ${사진.length} · 원글과 겹침 ${Math.round(비교 * 100)}%`);
}

경고.forEach((m) => console.log(m));
오류.forEach((m) => console.log(m));
if (오류.length) { console.log(`\n실패 ${오류.length}건`); process.exit(1); }
console.log(`\n네이버 원고 ${대상.length}개 통과${경고.length ? ` (주의 ${경고.length})` : ''}`);
