/* 원고 검사 — 스레드 500자 · 인스타 캡션 2,200자 · 해시태그 30개 · 슬라이드 형식 · 키워드 · 카드 이미지 유무 */
import fs from 'node:fs';
import { content, tips, fill, cardFiles, KEYWORDS } from './lib.mjs';
let bad = 0; const err = (id, m) => { console.error(`❌ ${id}: ${m}`); bad++; };
const ids = new Set();
for (const p of content()) {
  if (ids.has(p.id)) err(p.id, 'id 중복'); ids.add(p.id);
  const th = fill(p.threads, 'threads', p.id), cap = fill(p.caption, 'instagram', p.id);
  if (th.length > 500) err(p.id, `스레드 ${th.length}자 (500자 이하)`);
  if (cap.length > 2200) err(p.id, `캡션 ${cap.length}자`);
  if ((cap.match(/#/g) || []).length > 30) err(p.id, '해시태그 30개 초과');
  if (!KEYWORDS.includes(p.kw)) err(p.id, `키워드 「${p.kw}」 는 ${KEYWORDS.join('·')} 중 하나여야 함`);
  if (!Array.isArray(p.slides) || p.slides.length < 2 || p.slides.length > 9 || p.slides.some(s => s.length !== 3)) err(p.id, '슬라이드는 [작은제목, 큰제목, 본문] 2~9장');
  if (!p.yt || p.yt.length > 100) err(p.id, '유튜브 제목 1~100자');
  if (process.argv.includes('--cards')) cardFiles(p).forEach(f => fs.existsSync(f) || err(p.id, '카드 없음 ' + f));
}
tips().forEach((t, i) => { const x = fill(t, 'threads', 'tip'); if (x.length > 500) err('tip' + (i + 1), `${x.length}자`); });
console.log(bad ? `문제 ${bad}건` : `원고 ${ids.size}편 · 짧은 글 ${tips().length}편 이상 없음`);
process.exit(bad ? 1 : 0);
