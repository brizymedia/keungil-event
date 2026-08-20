/**
 * 홈페이지사진 폴더 → 갤러리용 사진 일괄 준비
 *
 * 각 하위 폴더를 하나의 갤러리 항목(카테고리)으로 보고
 *   - 긴 변 1400px 로 축소
 *   - 오른쪽 위에 「큰길이벤트기획」 워터마크
 *   - photos/<slug>/001.jpg … 로 저장
 *   - photos/photos.json 생성 (카테고리 정보 포함)
 *
 * 실행:  node scripts/prepare-gallery-photos.mjs <소스폴더> <출력폴더>
 */
import { readdirSync, mkdirSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC = process.argv[2] || 'C:/Users/gilau/Desktop/큰길이벤트기획/홈페이지사진';
const OUT = process.argv[3] || 'C:/Users/gilau/AppData/Local/Temp/kg-photos';
const FONT = 'C\\:/Windows/Fonts/malgunbd.ttf';
const MAXW = 1400;

/** 폴더명 → 갤러리 항목 정의 (순서 = 갤러리 노출 순서) */
const CATEGORIES = [
  { dir: '지역축제공연행사',        slug: 'festival',      name: '지역축제 & 공연행사',
    desc: '수만 명이 함께 숨 쉬는 축제 현장입니다. 무대·트러스 설치부터 라인어레이 음향, 무빙헤드 조명, LED 영상까지 큰길이벤트기획이 종합 대행했습니다.' },
  { dir: '컨퍼런스포럼기념식',      slug: 'conference',    name: '컨퍼런스 · 포럼 · 기념식',
    desc: '기관·기업 컨퍼런스와 포럼, 기념식 현장입니다. 회의 음향과 LED 영상, 의전 세팅과 진행까지 한 팀이 맡아 운영했습니다.' },
  { dir: '시상식이취임식',          slug: 'ceremony',      name: '시상식 & 이취임식',
    desc: '시상식과 이·취임식 현장입니다. 식순 기획, 무대 연출, 현수막과 LED 영상, 음향·조명 세팅을 큰길이벤트기획이 준비했습니다.' },
  { dir: '기공식오픈식브랜드론칭',  slug: 'groundbreaking', name: '기공식 · 오픈식 · 브랜드 론칭',
    desc: '기공식과 준공식, 오픈식과 브랜드 론칭 현장입니다. 시삽·제막 의전 세팅부터 무대와 음향까지 준비했습니다.' },
  { dir: '체육행사명랑운동회',      slug: 'sports',        name: '체육대회 & 명랑운동회',
    desc: '총동문 체육대회부터 마을 명랑운동회까지. 무대와 음향, 경품과 진행 MC를 함께 준비한 현장입니다.' },
  { dir: '학교행사축제',            slug: 'school',        name: '학교 행사 & 축제',
    desc: '초·중·고교와 대학의 축제, 발표회, 기념행사 현장입니다. 무대·음향·조명·영상을 학교 여건에 맞춰 구성했습니다.' },
  { dir: '버스킹음악회',            slug: 'busking',       name: '버스킹 & 음악회',
    desc: '거리 버스킹과 야외 음악회 현장입니다. 소규모 공연에 맞는 음향과 조명, 무대를 준비하고 공연팀 섭외까지 진행했습니다.' },
  { dir: '영화촬영',                slug: 'film',          name: '영화 · 영상 촬영 지원',
    desc: '영화·영상 촬영 현장 지원입니다. 촬영용 조명과 발전 차량, 인력과 장비를 현장 조건에 맞춰 지원했습니다.' },
  { dir: '카메라중계라이브스트리밍', slug: 'broadcast',     name: '카메라 중계 & 라이브 스트리밍',
    desc: '다중 카메라 현장 중계와 유튜브·줌 실시간 송출 현장입니다.' },
  { dir: '장비대여MC가수섭외',      slug: 'rental',        name: '장비 대여 & MC·가수 섭외',
    desc: '음향·LED 영상·조명·무대 장비 대여와 MC·가수 섭외 현장입니다.' },
];

const IMG = new Set(['.jpg', '.jpeg', '.png', '.webp']);

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const photos = [];
const cats = [];
let total = 0, failed = 0;

for (const cat of CATEGORIES) {
  const dir = join(SRC, cat.dir);
  if (!existsSync(dir)) { console.log(`- ${cat.dir}: 폴더 없음, 건너뜀`); continue; }

  const files = readdirSync(dir)
    .filter((f) => IMG.has(extname(f).toLowerCase()))
    .filter((f) => { try { return statSync(join(dir, f)).isFile(); } catch { return false; } })
    .sort((a, b) => a.localeCompare(b, 'ko'));

  if (!files.length) { console.log(`- ${cat.name}: 사진 없음, 건너뜀`); continue; }

  const outDir = join(OUT, cat.slug);
  mkdirSync(outDir, { recursive: true });

  let n = 0;
  for (const f of files) {
    const src = join(dir, f);
    const name = String(++n).padStart(3, '0') + '.jpg';
    const dst = join(outDir, name);
    // 축소 + 워터마크 (원본이 1400 보다 작으면 확대하지 않음)
    const vf = [
      `scale='min(${MAXW},iw)':-2`,
      `drawtext=fontfile='${FONT}':text='큰길이벤트기획'`
        + `:fontcolor=white@0.72:fontsize=h*0.052:borderw=3:bordercolor=black@0.55`
        + `:x=w-tw-(h*0.04):y=h*0.04`,
    ].join(',');
    try {
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', vf, '-q:v', '4', dst], { stdio: 'pipe' });
      photos.push({ path: `photos/${cat.slug}/${name}`, cat: cat.slug, event: cat.name });
      total++;
    } catch (e) {
      failed++; n--;
      console.error(`  ! 실패: ${cat.dir}/${f}`);
    }
  }
  cats.push({ slug: cat.slug, name: cat.name, desc: cat.desc, count: n });
  console.log(`- ${cat.name} (${cat.slug}): ${n}장`);
}

mkdirSync(join(OUT, '_meta'), { recursive: true });
writeFileSync(join(OUT, 'photos.json'),
  JSON.stringify({ updated: new Date().toISOString(), categories: cats, photos }, null, 1), 'utf8');

console.log(`\n완료: ${total}장 처리${failed ? `, ${failed}장 실패` : ''} · 카테고리 ${cats.length}개`);
console.log(`출력: ${OUT}`);
