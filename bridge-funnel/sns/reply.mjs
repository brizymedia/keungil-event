/* 댓글 자동 응대 (30분마다)
 *   인스타: 댓글에 키워드(전자책 · 데모 · 견적 · 명함) → DM(비공개 답장)으로 링크 + 댓글에 「DM 드렸어요」
 *   스레드: 답글에 키워드 → 링크를 답글로 (스레드는 DM API 가 없다)
 *   (선택) AI 응대: 키워드는 없지만 질문인 댓글에 Claude 가 짧은 답을 단다 — 저장소 변수 AI_REPLY=1 + 시크릿 ANTHROPIC_API_KEY
 *   --dry  실제로 보내지 않고 출력만
 */
import { CFG, loadMemo, saveMemo, api, log, findKeyword, DM, sleep } from './lib.mjs';

const S = loadMemo();
const SINCE = Date.now() - 72 * 3600e3;          // 최근 3일 댓글만 (처음 켰을 때 옛 댓글에 몰아 답하지 않게)
const AI_ON = process.env.AI_REPLY === '1' && !!process.env.ANTHROPIC_API_KEY;
const AI_MAX = Number(process.env.AI_REPLY_MAX || 5);
let aiCount = 0, sent = 0;

const seen = id => !!S.replied[id];
const mark = (id, what) => { S.replied[id] = { at: new Date().toISOString(), what }; };
const 질문같다 = t => /[?？]|(나요|까요|가요|어요|예요|인가|할까|되나|되요|돼요|얼마|어떻게|방법|궁금)\s*[.!~]*\s*$/.test(String(t).trim()) && String(t).trim().length >= 6;

/* ══ AI 답글 초안 (Claude) ═══════════════════════════ */
let ai = null;
async function aiReply(comment, postText, channel) {
  if (!AI_ON || aiCount >= AI_MAX || !질문같다(comment)) return '';
  if (!ai) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); ai = new Anthropic(); }
  aiCount++;
  const res = await ai.beta.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1024,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [
      '너는 전국 비대면 홈페이지 제작사 「큰길브리지」의 SNS 담당자다. 사장님(소상공인) 댓글에 짧고 따뜻하게 답한다.',
      '- 한국어 존댓말, 2~3문장, 200자 이내. 이모지는 0~1개. 해시태그 · 링크 금지.',
      '- 질문에 대한 실제 도움이 되는 답을 먼저 준다(AI 검색 · 홈페이지 · 검색 등록 · 가게 소개 문구 등).',
      '- 가격을 물으면: 베이직 10만원 · 고급형 50만원 · 회사형 100만원(부가세 별도), 옵션은 자동 견적에서 확인 가능하다고만 말한다. 할인 · 약속 · 기간 보장은 만들지 않는다.',
      '- 모르는 사실(특정 가게 순위 · 검색 결과 보장 등)은 단정하지 않는다. 필요하면 「댓글에 “데모” 남겨 주시면 링크 드릴게요」 또는 1533-7295 로 안내한다.',
      '- 욕설 · 스팸 · 광고 · 정치 · 의료 · 법률 판단이 필요한 댓글이면 정확히 SKIP 한 단어만 출력한다.'
    ].join('\n'),
    messages: [{ role: 'user', content: `채널: ${channel}\n우리 게시글 요약: ${String(postText || '').slice(0, 300)}\n\n댓글: ${comment}\n\n이 댓글에 달 답글만 출력해.` }]
  });
  if (res.stop_reason === 'refusal') return '';
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!text || /^SKIP\b/.test(text) || text.length > 300) return '';
  return text;
}

/* ══ 인스타그램 ══════════════════════════════════════ */
async function instagram() {
  if (!CFG.IG_TOKEN) return log('인스타 토큰 없음 — 건너뜀');
  const G = CFG.IG_GRAPH, T = CFG.IG_TOKEN;
  const me = await api('GET', `${G}/me`, { fields: 'user_id,username', access_token: T });
  const media = await api('GET', `${G}/${CFG.IG_USER_ID}/media`, { fields: 'id,caption,timestamp', limit: 12, access_token: T });
  for (const m of media.data || []) {
    if (Date.parse(m.timestamp) < Date.now() - 14 * 864e5) continue;
    const cs = await api('GET', `${G}/${m.id}/comments`, { fields: 'id,text,username,timestamp,from', limit: 50, access_token: T }).catch(e => (log('댓글 읽기 실패', e.message), { data: [] }));
    for (const c of cs.data || []) {
      if (seen(c.id) || Date.parse(c.timestamp) < SINCE || c.username === me.username) continue;
      /* 캐시가 날아갔을 때 두 번 답하지 않게 — 이미 우리 답글이 달려 있으면 건너뛴다 */
      const 답들 = await api('GET', `${G}/${c.id}/replies`, { fields: 'username', access_token: T }).catch(() => ({ data: [] }));
      if ((답들.data || []).some(x => x.username === me.username)) { mark(c.id, 'ig-already'); continue; }
      const kw = findKeyword(c.text);
      if (kw) {
        log(`인스타 @${c.username}: 「${c.text}」 → ${kw} DM`);
        if (!CFG.DRY) {
          /* 비공개 답장 — 댓글 단 사람에게 DM 1통 (댓글 후 7일 안에만 가능) */
          await api('POST', `${G}/${CFG.IG_USER_ID}/messages`, {}, { json: { recipient: { comment_id: c.id }, message: { text: DM[kw]('instagram') } }, headers: { Authorization: `Bearer ${T}` } })
            .catch(e => log('  DM 실패:', e.message));
          await api('POST', `${G}/${c.id}/replies`, { message: `@${c.username} DM으로 보내 드렸어요 📩 안 보이시면 「메시지 요청」함을 확인해 주세요!`, access_token: T }).catch(e => log('  답글 실패:', e.message));
          await sleep(1500);
        }
        mark(c.id, 'ig-dm-' + kw); sent++;
        continue;
      }
      const a = await aiReply(c.text, m.caption, '인스타그램').catch(e => (log('AI 실패', e.message), ''));
      if (a) {
        log(`인스타 @${c.username}: 「${c.text}」 → AI 답글: ${a}`);
        if (!CFG.DRY) await api('POST', `${G}/${c.id}/replies`, { message: `@${c.username} ${a}`, access_token: T }).catch(e => log('  답글 실패:', e.message));
        mark(c.id, 'ig-ai'); sent++;
      } else mark(c.id, 'ig-skip');
    }
  }
}

/* ══ 스레드 ══════════════════════════════════════════ */
async function threads() {
  if (!CFG.THREADS_TOKEN) return log('스레드 토큰 없음 — 건너뜀');
  const G = CFG.THREADS_GRAPH, T = CFG.THREADS_TOKEN, U = CFG.THREADS_USER_ID;
  const me = await api('GET', `${G}/me`, { fields: 'id,username', access_token: T });
  const posts = await api('GET', `${G}/${U}/threads`, { fields: 'id,text,timestamp', limit: 15, access_token: T });
  const reply = async (to, text) => {
    const c = await api('POST', `${G}/${U}/threads`, { media_type: 'TEXT', text, reply_to_id: to, access_token: T });
    await sleep(2000);
    return api('POST', `${G}/${U}/threads_publish`, { creation_id: c.id, access_token: T });
  };
  for (const p of posts.data || []) {
    if (Date.parse(p.timestamp) < Date.now() - 14 * 864e5) continue;
    const rs = await api('GET', `${G}/${p.id}/replies`, { fields: 'id,text,username,timestamp', access_token: T }).catch(e => (log('답글 읽기 실패', e.message), { data: [] }));
    for (const r of rs.data || []) {
      if (seen(r.id) || Date.parse(r.timestamp) < SINCE || r.username === me.username) continue;
      const 답들 = await api('GET', `${G}/${r.id}/replies`, { fields: 'username', access_token: T }).catch(() => ({ data: [] }));
      if ((답들.data || []).some(x => x.username === me.username)) { mark(r.id, 'th-already'); continue; }
      const kw = findKeyword(r.text);
      if (kw) {
        const text = DM[kw]('threads').replace(/^요청하신/, `@${r.username} 요청하신`);
        log(`스레드 @${r.username}: 「${r.text}」 → ${kw} 링크 답글`);
        if (!CFG.DRY) await reply(r.id, text.slice(0, 500)).catch(e => log('  답글 실패:', e.message));
        mark(r.id, 'th-link-' + kw); sent++;
        continue;
      }
      const a = await aiReply(r.text, p.text, '스레드').catch(e => (log('AI 실패', e.message), ''));
      if (a) {
        log(`스레드 @${r.username}: 「${r.text}」 → AI 답글: ${a}`);
        if (!CFG.DRY) await reply(r.id, a).catch(e => log('  답글 실패:', e.message));
        mark(r.id, 'th-ai'); sent++;
      } else mark(r.id, 'th-skip');
    }
  }
}

for (const [name, fn] of [['인스타', instagram], ['스레드', threads]]) {
  try { await fn(); } catch (e) { console.error(`❌ ${name}:`, e.message); process.exitCode = 1; }
}
saveMemo(S);
log(`끝 — 응대 ${sent}건 (AI ${aiCount}건)`);
