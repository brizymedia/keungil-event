/**
 * 오늘 쓸 블로그 글 고르기
 * ────────────────────────
 *   node scripts/blog-plan.mjs          사람이 읽는 목록
 *   node scripts/blog-plan.mjs --json   루틴이 읽는 JSON
 *   node scripts/blog-plan.mjs --n 5    몇 개 고를지 (기본 5)
 *
 * 1) 지역: _blog/regions.json 의 '비중'대로 나눈다. 지금까지 쓴 글 수가 비중보다 모자란 지역부터.
 * 2) 주제: _blog/keywords.json 의 검색량 × 계절(앞으로 1~2달이 성수기면 높게) × 지역전용 가산.
 *    같은 지역에 이미 쓴 주제는 빼고, 같은 날 같은 주제는 되도록 겹치지 않게.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 글읽기 } from './build-blog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 인자 = process.argv.slice(2);
const JSON출력 = 인자.includes('--json');
const 개수 = Number(인자[인자.indexOf('--n') + 1]) || 5;

const 지역들 = JSON.parse(readFileSync(resolve(ROOT, '_blog', 'regions.json'), 'utf8')).지역;
const 키 = JSON.parse(readFileSync(resolve(ROOT, '_blog', 'keywords.json'), 'utf8'));
const posts = 글읽기(ROOT);
const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const 이번달 = Number(오늘.slice(5, 7));
const 달더하기 = (n) => ((이번달 - 1 + n) % 12) + 1;

const 쓴주제 = new Set(posts.map((p) => `${p.region}|${p.topic}`));
const 지역글수 = new Map(지역들.map((r) => [r.slug, posts.filter((p) => p.region === r.slug).length]));

function 계절(성수기 = []) {
  if (!성수기.length) return 1;
  if (성수기.includes(달더하기(1)) || 성수기.includes(달더하기(2))) return 1.6;   // 미리 올려 두면 성수기에 걸린다
  if (성수기.includes(이번달)) return 1.3;
  return 1;
}

/* 후보 만들기 */
const 후보 = [];
for (const r of 지역들) {
  const 전용 = 키.지역전용.filter((x) => x.region === r.slug);
  const 전용주제 = new Set(전용.map((x) => x.topic));
  for (const t of 키.주제) {
    if (전용주제.has(t.topic)) continue;               // 같은 주제의 지역전용 틀이 있으면 그걸 쓴다
    const 채움 = (s) => s.split('{지역}').join(r.이름);
    const 량 = 키.검색량[r.slug]?.[t.topic];
    const 보정 = 키.보정?.[r.slug]?.[t.topic] ?? 1;
    후보.push({ region: r.slug, 지역: r.이름, topic: t.topic, main: 채움(t.k), sub: t.s.map(채움),
      검색량: 량 ?? null, 점수: (량 == null ? 0.15 : Math.max(량, 0.05)) * 보정 * 계절(t.성수기), 성수기: t.성수기, 메모: '' });
  }
  for (const x of 전용) {
    const 량 = x.검색량 ?? 키.검색량[r.slug]?.[x.topic];
    후보.push({ region: r.slug, 지역: r.이름, topic: x.topic, main: x.k, sub: x.s,
      검색량: 량 ?? null, 점수: (량 == null ? 0.15 : 량) * (x.보정 ?? 1) * 계절(x.성수기) * 1.3, 성수기: x.성수기, 메모: x.메모 || '' });
  }
}
const 남은후보 = 후보.filter((c) => !쓴주제.has(`${c.region}|${c.topic}`));

/* 고르기 */
const 고른것 = [];
const 합계 = 지역들.reduce((a, r) => a + r.비중, 0);
for (let n = 1; n <= 개수; n++) {
  const 가능지역 = 지역들.filter((r) => 남은후보.some((c) => c.region === r.slug && !고른것.includes(c)));
  if (!가능지역.length) break;
  const 전체 = posts.length + n;
  const 모자람 = (r) => (r.비중 / 합계) * 전체 - (지역글수.get(r.slug) + 고른것.filter((c) => c.region === r.slug).length);
  const r = 가능지역.sort((a, b) => 모자람(b) - 모자람(a) || b.비중 - a.비중)[0];
  const 오늘주제 = new Set(고른것.map((c) => c.topic));
  const c = 남은후보.filter((x) => x.region === r.slug && !고른것.includes(x))
    .sort((a, b) => b.점수 * (오늘주제.has(b.topic) ? 0.5 : 1) - a.점수 * (오늘주제.has(a.topic) ? 0.5 : 1))[0];
  고른것.push(c);
}

const 요약 = {
  오늘, 이미쓴글: posts.length,
  지역별글수: Object.fromEntries(지역들.map((r) => [r.이름, 지역글수.get(r.slug)])),
  남은후보수: 남은후보.length,
  고른것: 고른것.map((c, i) => ({ 순서: i + 1, region: c.region, 지역: c.지역, topic: c.topic, 핵심키워드: c.main, 보조키워드: c.sub,
    검색량: c.검색량, 점수: Math.round(c.점수 * 100) / 100, 메모: c.메모 })),
};

if (JSON출력) { console.log(JSON.stringify(요약, null, 2)); process.exit(0); }
console.log(`${오늘} 쓸 글 ${고른것.length}개 (이미 ${posts.length}개, 남은 후보 ${남은후보.length}개)`);
요약.고른것.forEach((c) => console.log(`${c.순서}. [${c.지역}] ${c.topic} — "${c.핵심키워드}"  보조: ${c.보조키워드.join(', ')}  (검색량 ${c.검색량 ?? '미미'}, 점수 ${c.점수})${c.메모 ? `\n   메모: ${c.메모}` : ''}`));
if (고른것.length < 개수) console.log(`※ 후보가 모자라 ${고른것.length}개만 골랐다 — _blog/keywords.json 에 주제를 보충할 때다.`);
console.log('지역별 글 수: ' + Object.entries(요약.지역별글수).map(([k, v]) => `${k} ${v}`).join(' · '));
