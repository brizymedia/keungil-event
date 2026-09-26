/* 자동 게시
 *   node post.mjs threads          스레드 — 원고(캐러셀 이미지 + 글) 다음 편
 *   node post.mjs threads-tip      스레드 — 짧은 질문형 글 다음 편
 *   node post.mjs instagram        인스타 — 캐러셀 다음 편
 *   node post.mjs reels            인스타 — 릴스 (세로 영상을 만들어 바로 업로드)
 *   node post.mjs youtube          유튜브 — 쇼츠 (세로 영상 업로드)
 *   --dry                          실제로 올리지 않고 무엇을 올릴지만 출력
 *   --id p07                       순서 무시하고 특정 글
 * 토큰이 없으면 그 채널은 조용히 건너뛴다(워크플로가 설치 전에도 실패하지 않게).
 */
import fs from 'node:fs';
import path from 'node:path';
import { CFG, CARDS_DIR, content, tips, loadState, saveState, fill, cardUrls, cardFiles, api, log, sleep } from './lib.mjs';

const [, , channel = ''] = process.argv;
const idArg = process.argv.includes('--id') ? process.argv[process.argv.indexOf('--id') + 1] : '';
const S = loadState();
const posts = content();

function pick(key) {
  if (idArg) return posts.find(p => p.id === idArg);
  const i = S[key.ch][key.f] || 0;
  if (i >= posts.length) { log(`⚠ ${key.ch}: 원고를 다 올렸습니다 (${posts.length}편). content.json 에 새 글을 추가하세요.`); return null; }
  return posts[i];
}
function done(ch, f, rec) { if (!idArg) S[ch][f] = (S[ch][f] || 0) + 1; S[ch].log.push({ at: new Date().toISOString(), ...rec }); saveState(S); }

/* ══ 스레드 ══════════════════════════════════════════ */
const TH = (p, params) => api('POST', `${CFG.THREADS_GRAPH}/${CFG.THREADS_USER_ID}/${p}`, { ...params, access_token: CFG.THREADS_TOKEN });
async function threadsPublish(creationId) {
  /* 미디어는 처리될 시간이 필요하다 — 상태가 FINISHED 가 될 때까지 기다린다 */
  for (let i = 0; i < 20; i++) {
    const st = await api('GET', `${CFG.THREADS_GRAPH}/${creationId}`, { fields: 'status,error_message', access_token: CFG.THREADS_TOKEN }).catch(() => ({}));
    if (!st.status || st.status === 'FINISHED') break;
    if (st.status === 'ERROR') throw new Error('스레드 미디어 처리 실패: ' + st.error_message);
    await sleep(5000);
  }
  return TH('threads_publish', { creation_id: creationId });
}
async function threadsPost() {
  const post = pick({ ch: 'threads', f: 'next' }); if (!post) return;
  const text = fill(post.threads, 'threads', post.id);
  if (text.length > 500) throw new Error(`스레드 글이 500자를 넘습니다 (${post.id}: ${text.length}자)`);
  const imgs = cardUrls(post);
  if (CFG.DRY || !CFG.THREADS_TOKEN) return log(`[${CFG.DRY ? '연습' : '토큰 없음'}] 스레드 ${post.id}\n${text}\n이미지 ${imgs.length}장: ${imgs[0]} …`);
  const children = [];
  for (const u of imgs) children.push((await TH('threads', { media_type: 'IMAGE', image_url: u, is_carousel_item: true })).id);
  const c = await TH('threads', { media_type: 'CAROUSEL', children: children.join(','), text });
  const r = await threadsPublish(c.id);
  log(`✅ 스레드 게시 ${post.id} → ${r.id}`);
  done('threads', 'next', { id: post.id, media: r.id });
}
async function threadsTip() {
  const list = tips(); const i = S.threads.tipNext || 0;
  if (i >= list.length) return log('⚠ 스레드 짧은 글을 다 올렸습니다. tips.json 에 추가하세요.');
  const text = fill(list[i], 'threads', `tip${i + 1}`);
  if (CFG.DRY || !CFG.THREADS_TOKEN) return log(`[${CFG.DRY ? '연습' : '토큰 없음'}] 스레드 짧은 글 #${i + 1}\n${text}`);
  const params = { media_type: 'TEXT', text };
  if (text.includes('http')) params.link_attachment = text.match(/https?:\/\/\S+/)[0];   // 링크 미리보기 카드
  const c = await TH('threads', params);
  const r = await threadsPublish(c.id);
  log(`✅ 스레드 짧은 글 #${i + 1} → ${r.id}`);
  done('threads', 'tipNext', { tip: i + 1, media: r.id });
}

/* ══ 인스타그램 (Instagram API with Instagram Login) ════ */
const IG = (p, params) => api('POST', `${CFG.IG_GRAPH}/${CFG.IG_USER_ID}/${p}`, { ...params, access_token: CFG.IG_TOKEN });
async function igWait(id, limit = 40) {
  for (let i = 0; i < limit; i++) {
    const st = await api('GET', `${CFG.IG_GRAPH}/${id}`, { fields: 'status_code,status', access_token: CFG.IG_TOKEN });
    if (st.status_code === 'FINISHED') return;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error('인스타 미디어 처리 실패: ' + (st.status || st.status_code));
    await sleep(6000);
  }
  throw new Error('인스타 미디어 처리 시간 초과');
}
async function instagramPost() {
  const post = pick({ ch: 'instagram', f: 'next' }); if (!post) return;
  const caption = fill(post.caption, 'instagram', post.id);
  const imgs = cardUrls(post);
  if (CFG.DRY || !CFG.IG_TOKEN) return log(`[${CFG.DRY ? '연습' : '토큰 없음'}] 인스타 ${post.id}\n${caption}\n이미지 ${imgs.length}장`);
  const children = [];
  for (const u of imgs) children.push((await IG('media', { image_url: u, is_carousel_item: true })).id);
  for (const c of children) await igWait(c);
  const c = await IG('media', { media_type: 'CAROUSEL', children: children.join(','), caption });
  await igWait(c.id);
  const r = await IG('media_publish', { creation_id: c.id });
  log(`✅ 인스타 캐러셀 ${post.id} → ${r.id}`);
  done('instagram', 'next', { id: post.id, media: r.id, kw: post.kw });
}

/* 세로 영상 만들기 — 워크플로에서 playwright · ffmpeg 가 있을 때 */
async function makeShort(post) {
  const out = path.join(CARDS_DIR, post.id, 'short.mp4');
  if (fs.existsSync(out)) return out;
  const { chromium } = await import('playwright');
  const { renderPost, makeVideo } = await import('./render.mjs');
  const b = await chromium.launch();
  try { return makeVideo(post, await renderPost(b, post, { story: true }), out); } finally { await b.close(); }
}
async function reelsPost() {
  const post = pick({ ch: 'instagram', f: 'reelNext' }); if (!post) return;
  const caption = fill(post.caption, 'instagram', post.id + '-reel');
  if (CFG.DRY || !CFG.IG_TOKEN) return log(`[${CFG.DRY ? '연습' : '토큰 없음'}] 인스타 릴스 ${post.id}`);
  const file = await makeShort(post), size = fs.statSync(file).size;
  /* 재개 가능 업로드 — 영상을 어딘가에 공개로 올려 둘 필요가 없다 */
  const c = await IG('media', { media_type: 'REELS', upload_type: 'resumable', caption, share_to_feed: true });
  const up = await fetch(c.uri, { method: 'POST', headers: { Authorization: `OAuth ${CFG.IG_TOKEN}`, offset: '0', file_size: String(size) }, body: fs.readFileSync(file) });
  if (!up.ok) throw new Error('릴스 업로드 실패: ' + (await up.text()).slice(0, 300));
  await igWait(c.id, 60);
  const r = await IG('media_publish', { creation_id: c.id });
  log(`✅ 인스타 릴스 ${post.id} → ${r.id}`);
  done('instagram', 'reelNext', { id: post.id, reel: r.id, kw: post.kw });
}

/* ══ 유튜브 쇼츠 ═════════════════════════════════════ */
async function youtubePost() {
  const post = pick({ ch: 'youtube', f: 'next' }); if (!post) return;
  const title = post.yt.slice(0, 95);
  const desc = [post.slides.map(s => s[1].replace(/\n/g, ' ')).join(' → '), '',
    '📘 무료 전자책 「AI가 추천하는 가게의 7가지 조건」 + 우리 가게 홈페이지 데모', fill('{LINK}', 'youtube', post.id), '',
    '큰길브리지 · 전국 비대면 홈페이지 제작 · 1533-7295', '#Shorts #AI검색 #홈페이지제작 #자영업'].join('\n');
  if (CFG.DRY || !CFG.YT_REFRESH_TOKEN) return log(`[${CFG.DRY ? '연습' : '토큰 없음'}] 유튜브 쇼츠 ${post.id} — ${title}`);
  const file = await makeShort(post), size = fs.statSync(file).size;
  const tok = await api('POST', 'https://oauth2.googleapis.com/token', {}, { body: new URLSearchParams({ client_id: CFG.YT_CLIENT_ID, client_secret: CFG.YT_CLIENT_SECRET, refresh_token: CFG.YT_REFRESH_TOKEN, grant_type: 'refresh_token' }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST', headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify({ snippet: { title, description: desc, tags: ['AI검색', '홈페이지제작', '자영업', '소상공인', '챗GPT', '큰길브리지'], categoryId: '27', defaultLanguage: 'ko' },
      status: { privacyStatus: CFG.YT_PRIVACY, selfDeclaredMadeForKids: false } })
  });
  if (!init.ok) throw new Error('유튜브 업로드 시작 실패: ' + (await init.text()).slice(0, 300));
  const put = await fetch(init.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: fs.readFileSync(file) });
  const v = await put.json();
  if (!put.ok) throw new Error('유튜브 업로드 실패: ' + JSON.stringify(v).slice(0, 300));
  log(`✅ 유튜브 쇼츠 ${post.id} → https://youtube.com/shorts/${v.id} (${v.status?.privacyStatus})`);
  done('youtube', 'next', { id: post.id, video: v.id });
}

const run = { threads: threadsPost, 'threads-tip': threadsTip, instagram: instagramPost, reels: reelsPost, youtube: youtubePost }[channel];
if (!run) { console.error('사용법: node post.mjs threads|threads-tip|instagram|reels|youtube [--dry] [--id p07]'); process.exit(2); }
await run().catch(e => { console.error('❌', e.message); process.exitCode = 1; });
