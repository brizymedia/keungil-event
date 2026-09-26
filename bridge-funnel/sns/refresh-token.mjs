/* 장기 토큰 연장 (주 1회) — 스레드 · 인스타 토큰은 60일이면 만료된다. 만료 전에 연장해 새 값을 파일로 남기면
 * 워크플로가 `gh secret set` 으로 시크릿을 바꿔 넣는다. 토큰 값은 로그에 절대 찍지 않는다. */
import fs from 'node:fs';
import path from 'node:path';
import { CFG, api, log } from './lib.mjs';

const out = process.env.RUNNER_TEMP || '/tmp';
async function refresh(name, url, params, file) {
  try {
    const r = await api('GET', url, params);
    if (!r.access_token) throw new Error('응답에 토큰 없음');
    fs.writeFileSync(path.join(out, file), r.access_token);
    log(`✅ ${name} 토큰 연장 — 남은 기간 ${Math.round((r.expires_in || 0) / 86400)}일`);
  } catch (e) { console.error(`❌ ${name} 토큰 연장 실패: ${e.message} — 만료됐다면 README 의 「토큰 다시 받기」를 따라 새로 넣어 주세요`); process.exitCode = 1; }
}
if (CFG.THREADS_TOKEN) await refresh('스레드', 'https://graph.threads.net/refresh_access_token', { grant_type: 'th_refresh_token', access_token: CFG.THREADS_TOKEN }, 'THREADS_TOKEN');
if (CFG.IG_TOKEN) await refresh('인스타', 'https://graph.instagram.com/refresh_access_token', { grant_type: 'ig_refresh_token', access_token: CFG.IG_TOKEN }, 'IG_TOKEN');
