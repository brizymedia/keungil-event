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
//   node threads-autopost.mjs analyze --topic "주제" [--top 5] [--days 7] [--refs 참고글.txt]
//                                                              잘 된 글 패턴 분석 → 변형 원고
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

const METRICS = 'views,likes,replies,reposts,quotes,shares';

async function recentWithInsights(limit) {
  const { data = [] } = await call('GET', `${VER}/${USER_ID}/threads`, {
    fields: 'id,text,timestamp,permalink,is_quote_post', limit,
  });
  const rows = [];
  for (const p of data) {
    const row = { ...p, views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, shares: 0 };
    try {
      const ins = await call('GET', `${VER}/${p.id}/insights`, { metric: METRICS });
      for (const m of ins.data || []) row[m.name] = m.values?.[0]?.value ?? m.total_value?.value ?? 0;
    } catch (e) {
      row.error = e.message;
    }
    rows.push(row);
  }
  return rows;
}

async function insights(opts) {
  const rows = await recentWithInsights(Number(opts.limit || 10));
  console.table(rows.map(r => ({
    id: r.id, 날짜: (r.timestamp || '').slice(0, 10), 첫줄: (r.text || '').split('\n')[0].slice(0, 20),
    views: r.views, likes: r.likes, replies: r.replies, reposts: r.reposts, shares: r.shares,
    '답글률%': r.views ? ((r.replies / r.views) * 100).toFixed(2) : '-',
    ...(r.error ? { 오류: r.error.slice(0, 40) } : {}),
  })));
}

// ── AI(Claude API) 공통 ──────────────────────────────────

const POSTS_SCHEMA = {
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
};

const WRITING_RULES = [
  '규칙:',
  '- 글 하나는 200~450자, 모바일에서 읽기 쉽게 줄바꿈을 자주 한다.',
  '- 첫 줄은 12~25자의 훅.',
  '- 공감형 · 리스트형 · 전후비교형 · 반전형 · 질문형을 골고루 섞는다.',
  '- 10개 중 3개는 질문으로 끝나 답글을 유도한다.',
  '- 10개 중 1개만 상품이나 무료 자료를 언급한다.',
  '- 지어낸 수익 금액, 가짜 후기, 과장 광고 표현은 절대 쓰지 않는다.',
  '- 해시태그는 쓰지 않는다. topic 필드에 주제 태그로 쓸 단어 1개를 넣는다.',
];

function accountBrief(topic) {
  return [
    '너는 한국 스레드(Threads)에서 팔로워를 모은 SNS 카피라이터다.',
    `계정 대상: ${env.ACCOUNT_AUDIENCE || '직장인'}`,
    `계정 주제: ${topic}`,
    `팔 상품(가끔만 자연스럽게 언급): ${env.PRODUCT_NAME || '없음'}`,
  ];
}

async function askClaude(system, content, schema) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: env.CLAUDE_MODEL || 'claude-opus-5',
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('요청이 거절되었습니다. 문구를 바꿔 다시 시도하세요.');
  if (msg.stop_reason === 'max_tokens') throw new Error('응답이 잘렸습니다. 개수를 줄여 다시 시도하세요.');
  return JSON.parse(msg.content.find(b => b.type === 'text').text);
}

// 새 원고를 start 날짜부터 하루 slots.length 개씩 배치해 posts 에 붙인다.
function schedule(posts, out, start, slots, dayOffset = 0) {
  const ids = new Set(posts.map(p => p.id));
  out.forEach((p, i) => {
    const slot = slots[i % slots.length];
    const at = atKst(start, dayOffset + Math.floor(i / slots.length), slot);
    let id = `${at.slice(0, 10)}-${slot.replace(':', '')}`;
    while (ids.has(id)) id += 'b';
    ids.add(id);
    posts.push({ id, at, type: p.type, topic: p.topic, text: [...p.text].slice(0, MAX_TEXT).join('') });
  });
}

function postSlots(perDay) {
  return (env.POST_TIMES || '08:10,12:40,20:30').split(',').map(s => s.trim()).slice(0, perDay);
}

function startDate(opts, posts) {
  if (opts.start) return new Date(`${opts.start}T00:00:00+09:00`);
  // 이미 예약된 글이 있으면 마지막 예약일 다음 날부터 잇는다.
  const last = Math.max(0, ...posts.map(p => Date.parse(p.at)));
  const next = nextKstMidnight();
  if (last < next.getTime()) return next;
  const kst = new Date(last + 9 * 3600e3);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() + 86400e3 - 9 * 3600e3);
}

// ── AI 원고 생성 ─────────────────────────────────────────

async function generate(opts) {
  const topic = opts.topic || env.ACCOUNT_TOPIC;
  if (!topic) throw new Error('--topic "계정 주제" 또는 .env 의 ACCOUNT_TOPIC 이 필요합니다.');
  const days = Number(opts.days || 7);
  const slots = postSlots(Number(opts.perDay || 3));
  const posts = readJson(POSTS_FILE, []);
  const start = startDate(opts, posts);
  const system = [...accountBrief(topic), ...WRITING_RULES].join('\n');
  const schema = { type: 'object', properties: { posts: POSTS_SCHEMA }, required: ['posts'], additionalProperties: false };

  const CHUNK = 10;   // 한 번 요청에 10일 치씩
  for (let d0 = 0; d0 < days; d0 += CHUNK) {
    const n = Math.min(CHUNK, days - d0) * slots.length;
    console.log(`${d0 + 1}~${d0 + n / slots.length}일 차 원고 ${n}개 생성 중…`);
    const { posts: out } = await askClaude(system,
      `서로 겹치지 않는 스레드 글 ${n}개를 만들어 줘.` +
      (posts.length ? ` 이미 만든 글의 첫 줄과 겹치지 않게 해:\n${posts.slice(-30).map(p => '- ' + p.text.split('\n')[0]).join('\n')}` : ''),
      schema);
    schedule(posts, out.slice(0, n), start, slots, d0);
    writeJson(POSTS_FILE, posts);
  }
  console.log(`✓ ${POSTS_FILE} 에 저장했습니다. 발행 전에 꼭 읽고 내 말투 · 경험으로 고쳐 주세요.`);
}

// ── 잘 된 글 분석 → 변형 원고 ─────────────────────────────
// 내 최근 글 중 성과 상위 글(+ 선택: 참고 글 파일)을 분석해 "왜 잘 됐는지"를 정리하고,
// 그 패턴으로 내 주제의 새 원고를 만든다. 결과 보고서는 analysis.md 에 남긴다.

async function analyze(opts) {
  const topic = opts.topic || env.ACCOUNT_TOPIC;
  if (!topic) throw new Error('--topic "계정 주제" 또는 .env 의 ACCOUNT_TOPIC 이 필요합니다.');
  const top = Number(opts.top || 5);
  const days = Number(opts.days || 7);
  const slots = postSlots(Number(opts.perDay || 3));

  const samples = [];
  if (!opts.refs || opts.mine) {
    const rows = (await recentWithInsights(Number(opts.scan || 50))).filter(r => r.text && !r.error);
    // 조회수만 보면 자극적인 글이 올라오므로 답글 · 공유(대화와 저장 신호)에 가중치를 준다.
    const score = r => r.views + 30 * r.replies + 20 * (r.reposts + r.quotes + r.shares);
    rows.sort((a, b) => score(b) - score(a));
    for (const r of rows.slice(0, top)) {
      samples.push(`[내 글 · 조회 ${r.views} · 답글 ${r.replies} · 공유 ${r.reposts + r.quotes + r.shares}]\n${r.text}`);
    }
  }
  if (opts.refs) {
    // 참고 글: 다른 계정의 잘 된 글을 한 편씩 --- 로 구분해 붙여 넣은 텍스트 파일(구조 분석용, 문장 복사 금지)
    const refs = fs.readFileSync(path.resolve(opts.refs), 'utf8').split(/\n-{3,}\n/).map(t => t.trim()).filter(Boolean);
    for (const t of refs) samples.push(`[참고 글]\n${t}`);
  }
  if (!samples.length) throw new Error('분석할 글이 없습니다. 발행한 글이 쌓인 뒤 실행하거나 --refs 파일을 주세요.');

  const n = days * slots.length;
  const system = [
    ...accountBrief(topic),
    '너는 먼저 잘 된 글들을 분석하는 편집자 역할을 하고, 그다음 카피라이터로서 새 글을 쓴다.',
    '분석: 각 글의 훅 유형, 구조(줄 수 · 전개 순서), 감정 포인트, 답글을 부른 장치를 짧게 정리하고, 공통 패턴을 3~6개로 뽑는다.',
    '작성: 그 패턴을 내 계정 주제에 옮겨 새 글을 쓴다. [참고 글]의 문장 · 고유 표현 · 수치를 그대로 쓰지 않는다(구조만 빌린다).',
    ...WRITING_RULES,
  ].join('\n');
  const schema = {
    type: 'object',
    properties: {
      patterns: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, why: { type: 'string' }, how: { type: 'string' } },
          required: ['name', 'why', 'how'],
          additionalProperties: false,
        },
      },
      posts: POSTS_SCHEMA,
    },
    required: ['patterns', 'posts'],
    additionalProperties: false,
  };

  console.log(`잘 된 글 ${samples.length}개 분석 → 새 원고 ${n}개 생성 중…`);
  const out = await askClaude(system,
    `아래 글들을 분석하고, 찾은 패턴으로 새 스레드 글 ${n}개를 써 줘.\n\n${samples.join('\n\n---\n\n')}`, schema);

  const posts = readJson(POSTS_FILE, []);
  const start = startDate(opts, posts);
  schedule(posts, out.posts.slice(0, n), start, slots);
  writeJson(POSTS_FILE, posts);

  const report = [
    `# 잘 된 글 분석 — ${new Date().toISOString().slice(0, 10)}`, '',
    ...out.patterns.flatMap(p => [`## ${p.name}`, `- 왜 먹혔나: ${p.why}`, `- 내 글에 쓰는 법: ${p.how}`, '']),
    `새 원고 ${Math.min(n, out.posts.length)}개를 ${POSTS_FILE} 에 추가했습니다.`,
  ].join('\n');
  fs.writeFileSync(path.join(DIR, 'analysis.md'), report + '\n');
  console.log(report);
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
  whoami, list, publish, replies, insights, generate, analyze,
  'token:exchange': tokenExchange,
  'token:refresh': tokenRefresh,
};

const opts = args();
const cmd = COMMANDS[opts._[0]];
if (!cmd) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 15).join('\n'));
  process.exit(opts._[0] ? 1 : 0);
}
try {
  await cmd(opts);
} catch (e) {
  console.error(`오류: ${e.message}`);
  process.exit(1);
}
