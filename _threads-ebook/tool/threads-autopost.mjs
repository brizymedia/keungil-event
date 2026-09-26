#!/usr/bin/env node
// 스레드 자동 발행 도구 — 공식 Threads API 만 사용한다(로그인 매크로 · 자동 좋아요/팔로우 없음).
//
//   node threads-autopost.mjs whoami            토큰 확인(내 아이디 · 사용자명)
//   node threads-autopost.mjs token:exchange    짧은 토큰(1시간) → 장기 토큰(60일)
//   node threads-autopost.mjs token:refresh     장기 토큰 60일 연장
//   node threads-autopost.mjs generate --topic "직장인 AI 부업" --days 30 [--start 2026-10-01]
//   node threads-autopost.mjs list              발행 예정 · 완료 목록
//   node threads-autopost.mjs publish [--dry]   발행 시각이 지난 글만 발행(중복 발행 없음)
//   node threads-autopost.mjs replies --post <게시물ID> [--dry]   키워드 답글에 자동 답글
//   node threads-autopost.mjs insights [--limit 10]              최근 게시물 성과
//
// 설정은 .env(또는 환경 변수)에서 읽는다. .env.example 참고.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(DIR, '.env'));

const API = 'https://graph.threads.net';
const VER = 'v1.0';
const env = process.env;
const USER_ID = env.THREADS_USER_ID || 'me';
const POSTS_FILE = path.join(DIR, env.POSTS_FILE || 'posts.json');
const PUBLISHED_FILE = path.join(DIR, 'published.json');
const REPLIED_FILE = path.join(DIR, 'replied.json');
const MAX_PER_RUN = Number(env.MAX_PER_RUN || 3);      // 한 번 실행에 최대 발행 수
const MAX_TEXT = 500;                                   // 스레드 글자 수 한도

// ── 공통 ────────────────────────────────────────────────

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function args() {
  const out = { _: [] };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const key = a[i].slice(2);
      const next = a[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a[i]);
  }
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function token() {
  const t = env.THREADS_ACCESS_TOKEN;
  if (!t) throw new Error('THREADS_ACCESS_TOKEN 이 없습니다. .env 를 확인하세요.');
  return t;
}

async function call(method, pathname, params = {}) {
  const url = new URL(pathname.startsWith('http') ? pathname : `${API}/${pathname}`);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries({ access_token: token(), ...params })) {
    if (v === undefined || v === null) continue;
    (method === 'GET' ? url.searchParams : body).set(k, String(v));
  }
  const res = await fetch(url, method === 'GET' ? {} : { method, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    throw new Error(`Threads API ${res.status}: ${e.message || res.statusText || JSON.stringify(data)}`);
  }
  return data;
}

// ── 토큰 ────────────────────────────────────────────────

async function whoami() {
  const me = await call('GET', `${VER}/me`, { fields: 'id,username' });
  console.log(`✓ 연결됨 — @${me.username} (THREADS_USER_ID=${me.id})`);
}

async function tokenExchange() {
  if (!env.THREADS_APP_SECRET) throw new Error('THREADS_APP_SECRET(앱 시크릿 코드)이 필요합니다.');
  const d = await call('GET', 'access_token', {
    grant_type: 'th_exchange_token',
    client_secret: env.THREADS_APP_SECRET,
  });
  printToken(d);
}

async function tokenRefresh() {
  const d = await call('GET', 'refresh_access_token', { grant_type: 'th_refresh_token' });
  printToken(d);
}

function printToken(d) {
  const days = Math.round((d.expires_in || 0) / 86400);
  console.log('새 장기 토큰(.env 의 THREADS_ACCESS_TOKEN 을 교체하세요):\n');
  console.log(d.access_token);
  console.log(`\n유효 기간: 약 ${days}일. 만료 전에 token:refresh 를 다시 실행하세요.`);
}

// ── 발행 ────────────────────────────────────────────────

async function waitFinished(containerId) {
  for (let i = 0; i < 20; i++) {
    const s = await call('GET', `${VER}/${containerId}`, { fields: 'status,error_message' });
    if (s.status === 'FINISHED') return;
    if (s.status === 'ERROR' || s.status === 'EXPIRED') {
      throw new Error(`컨테이너 ${s.status}: ${s.error_message || ''}`);
    }
    await sleep(15000);
  }
  throw new Error('컨테이너 처리 시간이 초과되었습니다.');
}

async function publishOne(post) {
  const params = { text: post.text };
  if (post.image) Object.assign(params, { media_type: 'IMAGE', image_url: post.image });
  else if (post.video) Object.assign(params, { media_type: 'VIDEO', video_url: post.video });
  else params.media_type = 'TEXT';
  if (post.topic) params.topic_tag = post.topic;
  if (post.link && !post.image && !post.video) params.link_attachment = post.link;
  if (post.replyTo) params.reply_to_id = post.replyTo;

  const { id: containerId } = await call('POST', `${VER}/${USER_ID}/threads`, params);
  // 이미지 · 영상은 처리 시간이 필요하다(텍스트도 상태 확인 후 발행하면 안전하다).
  if (params.media_type !== 'TEXT') await sleep(30000);
  await waitFinished(containerId);
  const { id } = await call('POST', `${VER}/${USER_ID}/threads_publish`, { creation_id: containerId });
  return id;
}

function validate(posts) {
  const seen = new Set();
  for (const p of posts) {
    if (!p.id || !p.at || !p.text) throw new Error(`id · at · text 가 모두 필요합니다: ${JSON.stringify(p).slice(0, 80)}`);
    if (seen.has(p.id)) throw new Error(`id 가 중복되었습니다: ${p.id}`);
    if ([...p.text].length > MAX_TEXT) throw new Error(`${p.id}: ${MAX_TEXT}자를 넘습니다.`);
    if (Number.isNaN(Date.parse(p.at))) throw new Error(`${p.id}: at 날짜 형식이 잘못되었습니다.`);
    seen.add(p.id);
  }
}

async function publish(opts) {
  const posts = readJson(POSTS_FILE, []);
  validate(posts);
  const done = readJson(PUBLISHED_FILE, {});
  const now = Date.now();
  const due = posts
    .filter(p => !done[p.id] && Date.parse(p.at) <= now)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(0, MAX_PER_RUN);

  if (!due.length) return console.log('발행할 글이 없습니다.');
  for (const [i, post] of due.entries()) {
    if (opts.dry) { console.log(`[dry] ${post.id} — ${post.text.split('\n')[0]}`); continue; }
    try {
      const mediaId = await publishOne(post);
      done[post.id] = { mediaId, publishedAt: new Date().toISOString() };
      writeJson(PUBLISHED_FILE, done);
      console.log(`✓ ${post.id} 발행 (${mediaId})`);
    } catch (e) {
      console.error(`✗ ${post.id} 실패 — ${e.message}`);
      process.exitCode = 1;
    }
    if (i < due.length - 1) await sleep(60000);   // 연속 발행 사이 1분
  }
}

function list() {
  const posts = readJson(POSTS_FILE, []);
  const done = readJson(PUBLISHED_FILE, {});
  const now = Date.now();
  for (const p of [...posts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const mark = done[p.id] ? '✓ 발행됨' : Date.parse(p.at) <= now ? '● 대기(발행 시각 지남)' : '○ 예정';
    console.log(`${mark.padEnd(16)} ${p.at}  ${p.id}  ${p.text.split('\n')[0].slice(0, 30)}`);
  }
  console.log(`\n전체 ${posts.length} · 발행 ${Object.keys(done).length}`);
}

// ── 자동 답글: "댓글에 '자료' 남기면 링크 드려요" ─────────────

async function replies(opts) {
  const postId = opts.post;
  if (!postId) throw new Error('--post <게시물ID> 가 필요합니다. (insights 명령으로 ID 확인)');
  const keywords = (env.REPLY_KEYWORDS || '자료').split(',').map(s => s.trim()).filter(Boolean);
  const templates = (env.REPLY_TEMPLATES || '').split('||').map(s => s.trim()).filter(Boolean);
  if (!templates.length) throw new Error('REPLY_TEMPLATES 를 .env 에 설정하세요. 여러 문구는 || 로 구분합니다.');
  const limit = Number(env.REPLY_MAX_PER_RUN || 20);
  const gap = Math.max(20, Number(env.REPLY_GAP_SECONDS || 30)) * 1000;

  const me = await call('GET', `${VER}/me`, { fields: 'username' });
  const state = readJson(REPLIED_FILE, {});
  const answered = new Set(state[postId] || []);   // 이미 답한 사용자명

  const { data = [] } = await call('GET', `${VER}/${postId}/replies`, {
    fields: 'id,text,username,timestamp', reverse: 'false',
  });
  const targets = data.filter(r =>
    r.username && r.username !== me.username && !answered.has(r.username) &&
    keywords.some(k => (r.text || '').includes(k)));

  console.log(`답글 ${data.length}개 중 대상 ${targets.length}개 (한 번에 최대 ${limit}개)`);
  let n = 0;
  for (const r of targets.slice(0, limit)) {
    const text = templates[n % templates.length].replaceAll('{name}', r.username);
    if (opts.dry) console.log(`[dry] @${r.username} ← ${text}`);
    else {
      try {
        await publishOne({ text, replyTo: r.id });
        answered.add(r.username);
        state[postId] = [...answered];
        writeJson(REPLIED_FILE, state);
        console.log(`✓ @${r.username} 에게 답글`);
      } catch (e) {
        console.error(`✗ @${r.username} — ${e.message}`);
        break;   // 제한 등 오류가 나면 즉시 멈춘다
      }
      await sleep(gap);
    }
    n++;
  }
}

// ── 성과 ────────────────────────────────────────────────

async function insights(opts) {
  const { data = [] } = await call('GET', `${VER}/${USER_ID}/threads`, {
    fields: 'id,text,timestamp,permalink', limit: Number(opts.limit || 10),
  });
  const rows = [];
  for (const p of data) {
    const row = { id: p.id, 날짜: (p.timestamp || '').slice(0, 10), 첫줄: (p.text || '').split('\n')[0].slice(0, 20) };
    try {
      const ins = await call('GET', `${VER}/${p.id}/insights`, { metric: 'views,likes,replies,reposts,quotes,shares' });
      for (const m of ins.data || []) row[m.name] = m.values?.[0]?.value ?? m.total_value?.value ?? 0;
      row['답글률%'] = row.views ? ((row.replies / row.views) * 100).toFixed(2) : '-';
    } catch (e) {
      row.오류 = e.message.slice(0, 40);
    }
    rows.push(row);
  }
  console.table(rows);
}

// ── AI 원고 생성(Claude API) ──────────────────────────────

async function generate(opts) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const topic = opts.topic || env.ACCOUNT_TOPIC;
  if (!topic) throw new Error('--topic "계정 주제" 또는 .env 의 ACCOUNT_TOPIC 이 필요합니다.');
  const days = Number(opts.days || 7);
  const perDay = Number(opts.perDay || 3);
  const start = opts.start ? new Date(`${opts.start}T00:00:00+09:00`) : nextKstMidnight();
  const slots = (env.POST_TIMES || '08:10,12:40,20:30').split(',').map(s => s.trim()).slice(0, perDay);

  const client = new Anthropic();
  const system = [
    '너는 한국 스레드(Threads)에서 팔로워를 모은 SNS 카피라이터다.',
    `계정 대상: ${env.ACCOUNT_AUDIENCE || '직장인'}`,
    `계정 주제: ${topic}`,
    `팔 상품(가끔만 자연스럽게 언급): ${env.PRODUCT_NAME || '없음'}`,
    '규칙:',
    '- 글 하나는 200~450자, 모바일에서 읽기 쉽게 줄바꿈을 자주 한다.',
    '- 첫 줄은 12~25자의 훅.',
    '- 공감형 · 리스트형 · 전후비교형 · 반전형 · 질문형을 골고루 섞는다.',
    '- 10개 중 3개는 질문으로 끝나 답글을 유도한다.',
    '- 10개 중 1개만 상품이나 무료 자료를 언급한다.',
    '- 지어낸 수익 금액, 가짜 후기, 과장 광고 표현은 절대 쓰지 않는다.',
    '- 해시태그는 쓰지 않는다. topic 필드에 주제 태그로 쓸 단어 1개를 넣는다.',
  ].join('\n');

  const schema = {
    type: 'object',
    properties: {
      posts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            text: { type: 'string' },
            topic: { type: 'string' },
          },
          required: ['type', 'text', 'topic'],
          additionalProperties: false,
        },
      },
    },
    required: ['posts'],
    additionalProperties: false,
  };

  const posts = readJson(POSTS_FILE, []);
  const ids = new Set(posts.map(p => p.id));
  const CHUNK = 10;   // 한 번 요청에 10일 치씩
  for (let d0 = 0; d0 < days; d0 += CHUNK) {
    const n = Math.min(CHUNK, days - d0) * slots.length;
    console.log(`${d0 + 1}~${d0 + n / slots.length}일 차 원고 ${n}개 생성 중…`);
    const stream = client.beta.messages.stream({
      model: env.CLAUDE_MODEL || 'claude-opus-5',
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system,
      messages: [{
        role: 'user',
        content: `서로 겹치지 않는 스레드 글 ${n}개를 만들어 줘.` +
          (posts.length ? ` 이미 만든 글의 첫 줄과 겹치지 않게 해:\n${posts.slice(-30).map(p => '- ' + p.text.split('\n')[0]).join('\n')}` : ''),
      }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new Error('요청이 거절되었습니다. 주제 문구를 바꿔 다시 시도하세요.');
    if (msg.stop_reason === 'max_tokens') throw new Error('응답이 잘렸습니다. --days 를 줄여 다시 시도하세요.');
    const textBlock = msg.content.find(b => b.type === 'text');
    const out = JSON.parse(textBlock.text).posts;

    out.slice(0, n).forEach((p, i) => {
      const day = d0 + Math.floor(i / slots.length);
      const slot = slots[i % slots.length];
      const at = atKst(start, day, slot);
      let id = `${at.slice(0, 10)}-${slot.replace(':', '')}`;
      while (ids.has(id)) id += 'b';
      ids.add(id);
      posts.push({ id, at, type: p.type, topic: p.topic, text: [...p.text].slice(0, MAX_TEXT).join('') });
    });
    writeJson(POSTS_FILE, posts);
  }
  console.log(`✓ ${POSTS_FILE} 에 저장했습니다. 발행 전에 꼭 읽고 내 말투 · 경험으로 고쳐 주세요.`);
}

function nextKstMidnight() {
  const kst = new Date(Date.now() + 9 * 3600e3);
  kst.setUTCHours(0, 0, 0, 0);
  kst.setUTCDate(kst.getUTCDate() + 1);
  return new Date(kst.getTime() - 9 * 3600e3);
}

function atKst(start, dayOffset, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = new Date(start.getTime() + dayOffset * 86400e3 + (h * 60 + m) * 60e3);
  const k = new Date(t.getTime() + 9 * 3600e3).toISOString().slice(0, 16);
  return `${k}:00+09:00`;
}

// ── 실행 ────────────────────────────────────────────────

const COMMANDS = {
  whoami, list, publish, replies, insights, generate,
  'token:exchange': tokenExchange,
  'token:refresh': tokenRefresh,
};

const opts = args();
const cmd = COMMANDS[opts._[0]];
if (!cmd) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 13).join('\n'));
  process.exit(opts._[0] ? 1 : 0);
}
try {
  await cmd(opts);
} catch (e) {
  console.error(`오류: ${e.message}`);
  process.exit(1);
}
