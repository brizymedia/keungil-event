/* 큰길브리지 SNS 자동화 — 공용 도구 (원고 읽기 · 상태 저장 · API 호출 · 링크 만들기) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');                    // 저장소 뿌리
export const CARDS_DIR = path.join(HERE, 'cards');
export const STATE_FILE = path.join(HERE, 'state.json');            // 게시 진도 — 저장소에 커밋
export const MEMO_FILE = path.join(HERE, '.cache', 'memo.json');    // 답한 댓글 · 찾은 글 — Actions 캐시에만 (30분마다 커밋하지 않게)

/* 설정 — GitHub Actions 의 Secrets / Variables 에서 들어온다 */
export const CFG = {
  /* 무료 자료 랜딩 — ai-make 로 옮긴 뒤에는 저장소 변수 BRIDGE_LANDING 을 https://www.ai-make.co.kr/free/ 로 */
  LANDING: process.env.BRIDGE_LANDING || 'https://xn--wk0bn7yi8h24iszc.com/bridge-funnel/free/',
  /* 카드 이미지가 공개로 올라가 있는 주소 (인스타 · 스레드가 이 주소에서 이미지를 가져간다) */
  CARDS_BASE: process.env.BRIDGE_CARDS_BASE || 'https://xn--wk0bn7yi8h24iszc.com/bridge-funnel/sns/cards',
  THREADS_TOKEN: process.env.THREADS_TOKEN || '',
  THREADS_USER_ID: process.env.THREADS_USER_ID || 'me',
  IG_TOKEN: process.env.IG_TOKEN || '',
  IG_USER_ID: process.env.IG_USER_ID || 'me',
  IG_GRAPH: process.env.IG_GRAPH || 'https://graph.instagram.com/v23.0',   // 「인스타그램 로그인」 방식 API
  THREADS_GRAPH: 'https://graph.threads.net/v1.0',
  YT_CLIENT_ID: process.env.YT_CLIENT_ID || '',
  YT_CLIENT_SECRET: process.env.YT_CLIENT_SECRET || '',
  YT_REFRESH_TOKEN: process.env.YT_REFRESH_TOKEN || '',
  YT_PRIVACY: process.env.YT_PRIVACY || 'public',
  DRY: process.argv.includes('--dry') || process.env.DRY_RUN === '1'
};

export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function readJSON(f, fallback) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } }
export function content() { return readJSON(path.join(HERE, 'content.json'), { posts: [] }).posts; }
export function tips() { return readJSON(path.join(HERE, 'tips.json'), { tips: [] }).tips; }

/* 상태 — 어느 글까지 올렸는지, 어떤 댓글에 답했는지. 워크플로가 커밋해서 다음 실행에 넘긴다 */
export function loadState() {
  const s = readJSON(STATE_FILE, {});
  return Object.assign({ threads: { next: 0, tipNext: 0, log: [] }, instagram: { next: 0, reelNext: 0, log: [] }, youtube: { next: 0, log: [] } }, s);
}
export function saveState(s) {
  ['threads', 'instagram', 'youtube'].forEach(k => { if (s[k].log.length > 200) s[k].log = s[k].log.slice(-200); });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');
}
export function loadMemo() { return Object.assign({ replied: {}, listen: {} }, readJSON(MEMO_FILE, {})); }
export function saveMemo(m) {
  const ids = Object.keys(m.replied); if (ids.length > 5000) ids.slice(0, ids.length - 5000).forEach(k => delete m.replied[k]);
  fs.mkdirSync(path.dirname(MEMO_FILE), { recursive: true });
  fs.writeFileSync(MEMO_FILE, JSON.stringify(m));
}

/* 링크 — 어느 채널 · 어느 글에서 왔는지 utm 으로 남긴다 (자동영업 서버의 「유입 경로」에 찍힌다) */
export function link(source, contentId, medium = 'social') {
  const u = new URL(CFG.LANDING);
  u.searchParams.set('utm_source', source); u.searchParams.set('utm_medium', medium); u.searchParams.set('utm_campaign', 'ai-search'); if (contentId) u.searchParams.set('utm_content', contentId);
  return u.toString();
}
export const fill = (text, source, id) => String(text || '').replaceAll('{LINK}', link(source, id));

/* 카드 이미지 주소 — 글 하나당 슬라이드 수 + CTA 1장 */
export function cardUrls(post) { const n = post.slides.length + 1; return Array.from({ length: n }, (_, i) => `${CFG.CARDS_BASE}/${post.id}/${i + 1}.jpg`); }
export function cardFiles(post, kind = 'feed') { const n = post.slides.length + 1; return Array.from({ length: n }, (_, i) => path.join(CARDS_DIR, post.id, kind === 'story' ? `s${i + 1}.jpg` : `${i + 1}.jpg`)); }

/* HTTP — 실패하면 본문까지 보여 준다 (토큰 만료 · 권한 부족을 바로 알 수 있게) */
export async function api(method, url, params = {}, { json, headers = {}, body } = {}) {
  const u = new URL(url);
  if (method === 'GET' || (!json && !body)) Object.entries(params).forEach(([k, v]) => v !== undefined && u.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)));
  const init = { method, headers: { ...headers } };
  if (json) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(json); }
  else if (body) init.body = body;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u, init);
    const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; }
    if (r.ok) return d;
    if (r.status >= 500 && i < 2) { await sleep(3000 * (i + 1)); continue; }
    const msg = d?.error?.message || d?.error_description || t.slice(0, 300);
    const e = new Error(`${method} ${u.pathname} → ${r.status} ${msg}`); e.status = r.status; e.data = d; throw e;
  }
}

/* 댓글 키워드 → DM 문구 */
export const DM = {
  '전자책': s => `요청하신 무료 전자책 「AI가 추천하는 가게의 7가지 조건」입니다 📘\n아래에서 연락처만 남기시면 바로 받으실 수 있어요. 우리 가게 이름 넣은 홈페이지 데모와 전자명함도 같이 드려요.\n👉 ${link(s, 'dm-ebook', 'dm')}`,
  '데모': s => `우리 가게 이름이 들어간 홈페이지 데모, 1분이면 보실 수 있어요 🖥\n상호 · 업종 · 지역만 넣으시면 바로 열립니다 (무료 · 결제 정보 없음).\n👉 ${link(s, 'dm-demo', 'dm')}`,
  '견적': s => `홈페이지 자동 견적 링크입니다 💰\n먼저 무료 데모를 보시고, 옵션을 고르면 금액이 바로 나와요. 마음에 들면 전자계약 · 결제까지 온라인으로 됩니다.\n👉 ${link(s, 'dm-quote', 'dm')}`,
  '명함': s => `무료 모바일 전자명함 링크입니다 📇\n연락처 남기시면 명함 만드는 화면과 전자책도 같이 드려요.\n👉 ${link(s, 'dm-card', 'dm')}`
};
export const KEYWORDS = Object.keys(DM);
/* 댓글에서 키워드 찾기 — 띄어쓰기 · 따옴표 무시 */
export function findKeyword(text) {
  const t = String(text || '').replace(/[\s「」"'`.,!~]/g, '');
  return KEYWORDS.find(k => t.includes(k)) || '';
}
