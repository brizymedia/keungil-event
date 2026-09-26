/* 카드 이미지 만들기
 *   node render.mjs            content.json 의 모든 글 → cards/{id}/1.jpg … (1080×1350, 인스타 · 스레드용). 이미 있는 건 건너뛴다
 *   node render.mjs --force    전부 다시
 *   node render.mjs --story p05   p05 의 세로(1080×1920) 프레임 → cards/p05/s1.jpg …  (쇼츠 · 릴스 영상 재료)
 *   node render.mjs --video p05   세로 프레임 → cards/p05/short.mp4 (ffmpeg 필요)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { HERE, CARDS_DIR, content, cardFiles, log } from './lib.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const storyId = args[args.indexOf('--story') + 1] && args.includes('--story') ? args[args.indexOf('--story') + 1] : '';
const videoId = args.includes('--video') ? args[args.indexOf('--video') + 1] : '';

function slidesOf(post, story) {
  const n = post.slides.length + 1;
  return post.slides.map((s, i) => ({ kind: i === 0 ? 'hook' : 'point', k: s[0], t: s[1], b: s[2], i: i + 1, n, story }))
    .concat([{ kind: 'cta', kw: post.kw, i: n, n, story }]);
}

export async function renderPost(browser, post, { story = false, force = false } = {}) {
  const files = cardFiles(post, story ? 'story' : 'feed');
  if (!force && files.every(f => fs.existsSync(f))) return files;
  fs.mkdirSync(path.dirname(files[0]), { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: story ? 1920 : 1350 }, deviceScaleFactor: 1 });
  const tpl = fs.readFileSync(path.join(HERE, 'card.html'), 'utf8');
  for (const [i, card] of slidesOf(post, story).entries()) {
    await page.setContent(tpl.replace('<script>', `<script>window.CARD=${JSON.stringify(card)};</script><script>`), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: files[i], type: 'jpeg', quality: 88 });
  }
  await page.close();
  log(`카드 ${post.id} ${story ? '세로' : '피드'} ${files.length}장`);
  return files;
}

/* 세로 프레임 → 쇼츠 · 릴스 mp4 (장마다 3.6초, 살짝 확대, 0.5초 크로스페이드, 음악은 bgm.mp3 가 있으면) */
export function makeVideo(post, frames, out) {
  const per = 3.6, fade = 0.5, n = frames.length;
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const inputs = frames.flatMap(f => ['-loop', '1', '-t', String(per), '-i', f]);
  const zoom = frames.map((_, i) => `[${i}:v]scale=1188:2112,zoompan=z='min(zoom+0.0006,1.06)':d=${Math.round(per * 30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,setsar=1,format=yuv420p[v${i}]`);
  let chain = [], last = 'v0', offset = per - fade;
  for (let i = 1; i < n; i++) { chain.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(2)}[x${i}]`); last = `x${i}`; offset += per - fade; }
  const total = (per * n - fade * (n - 1)).toFixed(2);
  const bgm = path.join(HERE, 'bgm.mp3');
  const audio = fs.existsSync(bgm) ? ['-stream_loop', '-1', '-i', bgm] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
  const a = n;   // 오디오 입력 번호
  execFileSync(ffmpeg, ['-y', ...inputs, ...audio, '-filter_complex', [...zoom, ...chain].join(';') + `;[${a}:a]volume=0.35,afade=t=out:st=${(total - 1.5).toFixed(2)}:d=1.5[a]`,
    '-map', `[${last}]`, '-map', '[a]', '-t', total, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  log(`영상 ${post.id} → ${path.relative(HERE, out)} (${total}초)`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const posts = content();
  const browser = await chromium.launch();
  try {
    if (storyId || videoId) {
      const post = posts.find(p => p.id === (storyId || videoId)); if (!post) throw new Error('글 없음: ' + (storyId || videoId));
      const frames = await renderPost(browser, post, { story: true, force });
      if (videoId) makeVideo(post, frames, path.join(CARDS_DIR, post.id, 'short.mp4'));
    } else {
      for (const p of posts) await renderPost(browser, p, { force });
    }
  } finally { await browser.close(); }
}
