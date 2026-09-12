# 3D 무대 시안 만들기 (stage3d)

행사 유형과 인원만 고르면 무대·LED·트러스·조명·음향·객석·텐트가 3D 로 그려지는 페이지.
큰길이벤트기획 사이트 안에서 `stage3d/` 로 열린다. 외부 서버 없음 — GitHub Pages 그대로.

## 파일

```
stage3d/
  index.html            시안 만들기 페이지 (Three.js, jsdelivr CDN 에서 읽음)
  blender/stage_gen.py  같은 시안 JSON 을 블렌더 안에 세우고 고화질 렌더하는 스크립트
  README.md             이 문서
```

## 손님 흐름

1. 행사 유형 9개 중 하나 → 인원 → 실내/야외. 규모에 맞는 기본값이 잡힌다(이벤트 코리아 기획서와 같은 규칙).
2. 무대 크기·높이, 백드롭, LED(200/300/400인치), 조명 트러스·무빙, 음향, 텐트, 의자, 포토존, 발전차 등을 켜고 끈다.
3. 낮/밤, 다섯 시점(관객석·정면·위·옆·무대 위).
4. 저장 · 다음 단계
   - **이 시안으로 견적서 만들기** → `큰길이벤트.com/quote.html?admin=1#q=` 에 품목이 채워져 열린다(메모에 시안 링크).
   - **그림 저장(PNG)** 1920×1080, 하단에 시안 요약 + 「큰길이벤트기획 3D 무대 시안」 띠.
   - **공유 링크 복사** — 주소 `#s=` 안에 시안 전체가 들어 있어 카톡으로 보내면 같은 화면.
   - **3D 파일(GLB)** — 블렌더·파워포인트(삽입 → 3D 모델)·아이폰 AR 에서 열린다.
   - **시안 파일(JSON)** — 고화질 렌더 의뢰용. 「불러오기」로 다시 연다.
   - **AR로 보기** — 안드로이드 크롬에서 카메라 화면에 실제 크기로(model-viewer · WebXR). 아이폰은 GLB 저장 후 파일 앱.
5. **현장 사진 위에 얹어 보기** — 광장·운동장 사진을 올리면 바닥·하늘 대신 사진이 깔리고 무대만 그려진다. 각도를 맞춘 뒤 「그림 저장」하면 사진+무대가 한 장.
6. **고화질 렌더 의뢰** — 이름·연락처·요청을 적으면 FormSubmit(사이트 문의 폼과 같은 경로, gilauto325@gmail.com)으로 시안 링크·요약·JSON 이 함께 온다. 전송이 막히면 메일 앱으로 넘어간다. 비용·기간은 회신 때 안내(가격 표시 없음).

## 어디에 붙어 있나 (2026-09-13)

- 큰길이벤트.com: 메뉴 「3D 무대」(PC 메뉴는 gap-5·nowrap 으로 줄여 9개가 한 줄), 폰 메뉴 「3D 무대 시안」, 홈 히어로 세 번째 단추 「내 행사 무대 3D로 미리 보기」, 사이트맵(`scripts/build-gallery.mjs` 의 pages).
- 이벤트 코리아: 위 메뉴 「3D 무대」 + 큐 **10 · 3D 무대** 카드(`img/stage3d.webp`) → 큰길이벤트.com/stage3d/.
- 행사 기획서 `plan.html`: 「🎪 이 기획서로 3D 무대 보기」(손님 화면에서도 보임) — 유형·인원·실내외·필요한 것(무대/LED/조명/특수효과/텐트/포토존/발전차)을 `#s=` 로 넘긴다. 일부만 넘어와도 나머지는 프리셋으로 채운다.

## 고화질 렌더 (블렌더)

시안 JSON 하나로 블렌더가 같은 장면을 세운다. 세 가지 방법:

### 1) 이 PC 에 블렌더 설치 후 명령줄 (가장 간단)

```powershell
winget install BlenderFoundation.Blender
& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b -P stage3d\blender\stage_gen.py -- 시안.json 결과.png --blend 결과.blend --samples 64 --cam audience
```
`--cam` audience · front · bird · side · stage. `--size 3840x2160` 로 4K. 한글은 맑은고딕(Windows)이 자동으로 잡힌다.

### 2) 블렌더 MCP (클로드가 블렌더를 직접 조작)

[ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) 설치 순서:
1. 블렌더 설치(위) + `pip install uv` 또는 `winget install astral-sh.uv`
2. 블렌더 → 편집 → 환경설정 → 애드온 → `addon.py` 설치 → 사이드바(N) BlenderMCP → **Connect to Claude**
3. Claude 설정에 MCP 서버 추가:
   ```json
   { "mcpServers": { "blender": { "command": "uvx", "args": ["blender-mcp"] } } }
   ```
4. 대화에서: 「stage3d/blender/stage_gen.py 를 블렌더에서 exec 하고 이 시안으로 build 해 줘」
   → 클로드가 `execute_blender_code` 로 `exec(open(...).read()); build(spec, render_path=...)` 를 넣는다.
   그 다음 「LED 를 더 크게」「트러스에 조명 4대 추가」처럼 말로 고친다. Poly Haven 재질·Hyper3D 모델 생성도 이 MCP 가 지원.

### 3) 클라우드 블렌더 (설치 없이, Higgsfield 3D Jutsu MCP)

이미 연결돼 있는 `scene_builder_3d_*` 도구가 블렌더 5.2 를 서버에서 돌린다. 스크립트 전문 + `build(spec, render_path=target.path, clear=False)` 를 보내면 렌더 PNG 와 GLB 가 나온다.
2026-09-10 실험: 축제(20평 무대·LED 300·무빙 6·의자 120·텐트 4) — 물체 914개 세우는 데 0.2초, 640×360·4샘플 렌더 40초(CPU 서버). **5분 제한**이 있으니 그림자는 태양·면조명만 켜고 샘플 4~8, 1280×720 이하로. 서버에 한글 글꼴이 없어 **한글 제목은 네모로 나온다** — 한글이 필요하면 1) 또는 2). 장면 링크: https://higgsfield.ai/3d-jutsu/0d7793f2-a435-4111-a975-6acf76787115

## 더 붙일 수 있는 것

- 큰길이벤트.com 메뉴에 「3D 무대 시안」 추가 → `/stage3d/`. 홈 히어로 아래에 「내 행사 무대를 3D 로 미리 보기」 단추.
- 이벤트 코리아 큐에 **「10 · 3D 무대 시안」** 카드 → 같은 페이지로 링크(포털은 홍보, 실행은 큰길이벤트에서).
- 행사 기획서(`plan.html`) 결과 화면에 「이 기획서로 3D 무대 보기」 단추: `stage3d/#s=` 에 type·people·title 을 넣어 열면 된다(같은 유형 키를 쓴다).
- 견적서 메모에 시안 링크가 들어가므로 계약서까지 시안이 따라간다.

## 손봐야 할 곳

- 유형별 기본값: `index.html` 의 `TYPES` 와 `preset()`. 품목 크기: `STAGE` · `LED` · `TENT`.
- 견적 품목 매핑: `quoteRows()` — `quote.html` 품목 번호(a1~g3)를 쓴다. 품목이 바뀌면 여기와 `plan.html` 의 `장비()` 를 같이 고칠 것.
- 블렌더 쪽은 같은 이름의 표가 `stage_gen.py` 상단에 있다.
