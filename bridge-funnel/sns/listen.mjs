/* 잠재 고객 찾기 (하루 한 번) — 스레드에서 「홈페이지 만들고 싶다」 류의 최근 글을 찾아 사장님 메일로 보낸다.
 * 자동으로 모르는 사람에게 답글을 달지 않는다(스팸 · 정책 위반). 사장님이 보고 직접 대화를 건다.
 * 필요: THREADS_TOKEN (threads_keyword_search 권한), BRIDGE_FUNNEL_API (자동영업 서버 주소 — 메일 발송용)
 */
import { CFG, api, log, loadMemo, saveMemo } from './lib.mjs';

const QUERIES = (process.env.LISTEN_QUERIES || '홈페이지 제작,홈페이지 만들,홈페이지 추천,랜딩페이지 제작,가게 홈페이지,네이버 검색 안나와,챗GPT 가게 추천,자영업 마케팅').split(',').map(s => s.trim()).filter(Boolean);
const S = loadMemo();

if (!CFG.THREADS_TOKEN) { log('스레드 토큰 없음 — 건너뜀'); process.exit(0); }
const me = await api('GET', `${CFG.THREADS_GRAPH}/me`, { fields: 'username', access_token: CFG.THREADS_TOKEN });
const found = [];
for (const q of QUERIES) {
  const r = await api('GET', `${CFG.THREADS_GRAPH}/keyword_search`, { q, search_type: 'RECENT', fields: 'id,text,username,permalink,timestamp', limit: 25, access_token: CFG.THREADS_TOKEN })
    .catch(e => (log(`검색 실패 「${q}」:`, e.message), { data: [] }));
  for (const p of r.data || []) {
    if (S.listen[p.id] || p.username === me.username || Date.parse(p.timestamp) < Date.now() - 2 * 864e5) continue;
    /* 업체 광고 글은 빼고, 「찾는 사람」의 글만 */
    if (/제작해\s?드|문의\s?주세요|상담\s?환영|저렴하게\s?만들어|포트폴리오|DM\s?주세요|제작\s?업체입니다/.test(p.text || '')) continue;
    S.listen[p.id] = Date.now();
    found.push({ q, user: p.username, text: String(p.text || '').slice(0, 220), url: p.permalink, at: p.timestamp });
  }
}
/* 기록은 2주치만 */
Object.entries(S.listen).forEach(([k, t]) => { if (t < Date.now() - 14 * 864e5) delete S.listen[k]; });
saveMemo(S);
log(`새로 찾은 글 ${found.length}개`);
if (!found.length) process.exit(0);

const FUNNEL = process.env.BRIDGE_FUNNEL_API;
if (FUNNEL && !CFG.DRY) {
  const r = await fetch(FUNNEL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'prospects', key: process.env.BRIDGE_FUNNEL_KEY || '', items: found }) });
  log('메일 발송:', r.status, (await r.text()).slice(0, 120));
} else log('자동영업 서버 주소(BRIDGE_FUNNEL_API)가 없어 메일을 보내지 않았습니다 — 공개 로그에는 목록을 남기지 않습니다');
