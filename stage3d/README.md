# 3D 무대 시안 만들기 (stage3d)

행사 유형과 인원만 고르면 무대·LED·트러스·조명·음향·객석·텐트가 3D 로 그려지는 페이지.
큰길이벤트기획 사이트 안에서 `stage3d/` 로 열린다. 외부 서버 없음 — GitHub Pages 그대로.

## 파일

```
stage3d/
  index.html            시안 만들기 페이지 (Three.js, jsdelivr CDN 에서 읽음)
  blender/stage_gen.py  같은 시안 JSON 을 블렌더 안에 세우고 고화질 렌더하는 스크립트
  blender/stage_video.py  그 장면에 카메라·조명 움직임을 넣어 MP4 영상으로 (무대영상.ps1 이 런처)
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
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P stage3d\blender\stage_gen.py -- 시안.json 결과.png --blend 결과.blend --samples 64 --cam audience
```
`--cam` audience · front · bird · side · stage. `--size 3840x2160` 로 4K. 한글은 맑은고딕(Windows)이 자동으로 잡힌다.

### 1-2) 고화질 **영상** (블렌더 설치 후 · 2026-09-13 추가)

카메라가 객석에서 들어오고(audience) → 크레인처럼 올라가고(crane) → 옆으로 돌고(side) → 하늘에서 내려다본다(bird).
무빙라이트가 좌우로 돌고, LED 가 숨쉬듯 밝아졌다 어두워지고, 안개 속에 빛줄기가 보이고, 불꽃이 흔들린다.

```powershell
cd stage3dlender
.\무대영상.ps1 시안.json                                   # 시안.mp4 · 1080p · 24fps · 12초 (RTX 3050 기준 약 25분)
.\무대영상.ps1 시안.json -Seconds 20 -Shots audience,led,side,stage,bird
.\무대영상.ps1 시안.json -Size 3840x2160 -Samples 32      # 4K (시간 4배)
.\무대영상.ps1 시안.json -NoFog                           # 안개 없이 — 훨씬 빠르지만 빛줄기가 반투명 원뿔로 나온다
```
장면 이름: `audience` 객석 진입 · `crane` 크레인 상승 · `side` 옆 회전 · `bird` 조감 · `stage` 무대 위에서 객석 · `led` LED 클로즈업.
직접 부를 때: `blender -b -P stage_video.py -- 시안.json 결과.mp4 --seconds 12 --fps 24 --size 1920x1080 --samples 24 --shots audience,crane,side,bird`.
`--frames 100-200` 으로 일부만 다시 그릴 수 있고, `--keep` 을 주면 PNG 프레임 폴더가 남는다. 같은 이름의 `.blend` 도 저장되니 블렌더에서 열어 손으로 고쳐도 된다.
ffmpeg 가 있으면 H.264(CRF 18)로 묶고, 없으면 블렌더 내장 인코더를 쓴다.

### 2) 블렌더 MCP (클로드가 블렌더를 직접 조작) — 2026-09-14 이 PC 에 설치 완료

[ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp). 설치된 것:
- `uv`(winget astral-sh.uv) → `uvx blender-mcp` 가 MCP 서버.
- 블렌더 애드온 `%APPDATA%\Blender Foundation\Blender\5.2\scripts\addons\blender_mcp.py` (활성화·저장됨). **블렌더를 켜기만 하면 9876 포트 서버가 자동으로 뜬다** (사이드바 N → MCP for Blender 탭에서 끄고 켤 수 있음).
- Claude Code 사용자 설정(`~/.claude.json` 의 `mcpServers.blender`) 에 `uvx blender-mcp` 등록. **Claude 데스크톱 앱을 한 번 껐다 켜야** 새 세션에서 `blender` 도구가 보인다.

쓰는 법: 블렌더를 열어 둔 채로 클로드에게 말한다.
- 「stage3d/blender/stage_gen.py 를 블렌더에서 exec 하고 이 시안(JSON)으로 build 해 줘」 → `execute_blender_code` 로 `exec(open(...).read()); build(spec, clear=False)`.
- 「LED 를 더 크게」「트러스에 조명 4대 추가」「카메라를 객석 뒤로」 — 말로 고치고 `get_viewport_screenshot` 으로 확인.
- 재질·HDRI 는 Poly Haven, 모델은 Sketchfab·Poly Pizza·Hyper3D(Rodin)·Hunyuan3D 도구가 붙어 있다 (각각 애드온 패널에서 켜야 함).

힉스필드(Higgsfield)와 오가기 — 이미 연결된 `scene_builder_3d_*` · `generate_3d` 도구와 짝을 이룬다:
- 힉스필드 → 블렌더: `scene_builder_3d_get_glb`/`get_blend` 로 받은 파일을 `execute_blender_code` 의 `bpy.ops.import_scene.gltf(filepath=...)` 로 불러온다. 2026-09-14 「큰길이벤트 3D 무대 시안 테스트」 GLB(0.9MB)를 이 PC 블렌더에 불러와 확인함.
- 블렌더 → 힉스필드: 블렌더에서 GLB 로 내보내(`bpy.ops.export_scene.gltf`) `scene_builder_3d_import_asset` 으로 올리거나, 렌더 PNG 를 `generate_video`(이미지→영상) 의 참조로 쓴다.
- 사진→3D 모델: 힉스필드 `generate_3d`(image_to_3d) 로 만든 GLB 를 같은 방법으로 블렌더에 얹는다 (크레딧 소모 — 먼저 `get_cost:true`).

### 3) 클라우드 블렌더 (설치 없이, Higgsfield 3D Jutsu MCP)

이미 연결돼 있는 `scene_builder_3d_*` 도구가 블렌더 5.2 를 서버에서 돌린다. 스크립트 전문 + `build(spec, render_path=target.path, clear=False)` 를 보내면 렌더 PNG 와 GLB 가 나온다.
2026-09-10 실험: 축제(20평 무대·LED 300·무빙 6·의자 120·텐트 4) — 물체 914개 세우는 데 0.2초, 640×360·4샘플 렌더 40초(CPU 서버). **5분 제한**이 있으니 그림자는 태양·면조명만 켜고 샘플 4~8, 1280×720 이하로. 서버에 한글 글꼴이 없어 **한글 제목은 네모로 나온다** — 한글이 필요하면 1) 또는 2). 장면 링크: https://higgsfield.ai/3d-jutsu/0d7793f2-a435-4111-a975-6acf76787115

## 더 붙일 수 있는 것

- 큰길이벤트.com 메뉴에 「3D 무대 시안」 추가 → `/stage3d/`. 홈 히어로 아래에 「내 행사 무대를 3D 로 미리 보기」 단추.
- 이벤트 코리아 큐에 **「10 · 3D 무대 시안」** 카드 → 같은 페이지로 링크(포털은 홍보, 실행은 큰길이벤트에서).
- 행사 기획서(`plan.html`) 결과 화면에 「이 기획서로 3D 무대 보기」 단추: `stage3d/#s=` 에 type·people·title 을 넣어 열면 된다(같은 유형 키를 쓴다).
- 견적서 메모에 시안 링크가 들어가므로 계약서까지 시안이 따라간다.

## 무대 구조물 5가지 (2026-09-14 형님이 현장 사진으로 정해 준 이름)

「무대 구조물」 고르기(`f-trussk`)의 값이다. 이름을 바꾸지 말 것 — 형님이 쓰는 현장 용어다.

| 값 | 이름 | 생김새 |
|---|---|---|
| `line` | 외줄 트러스 | 타워 두 본 사이에 가로 트러스 **한 줄**. 조명만 건다. 무대는 철골 · 차량 무대로 따로 선다 |
| `box` | 사각 트러스 (골대형) | 사각 단면 트러스 기둥 2본 + 가로대 1줄 |
| `hex` | 6발 트러스 | 육각 단면 트러스로 세운 골대형. 가로대는 맨 위 한 줄만 — 아래에 하나 더 걸면 LED 한가운데를 가로지른다(2026-09-14 뺌) |
| `hexroof` | 6발 트러스 + 루프 | 위에 지붕까지. 대형 축제 무대 |
| `layher` | 레이허 구조물 | 트러스 없이 비계(레이허)만으로 양쪽 타워를 쌓고 조명 바를 단다 |

`roof` 는 옛 이름으로 `hexroof` 로 읽는다(예전에 공유한 링크 호환). LED 뒤를 받치는 「LED 뒤 지지 틀」(`f-layher`)은 이것과 다른 별개 스위치다.

## 손봐야 할 곳

- 유형별 기본값: `index.html` 의 `TYPES` 와 `preset()`. 품목 크기: `STAGE` · `LED` · `TENT`.
- 견적 품목 매핑: `quoteRows()` — `quote.html` 품목 번호(a1~g3)를 쓴다. 품목이 바뀌면 여기와 `plan.html` 의 `장비()` 를 같이 고칠 것.
- 블렌더 쪽은 같은 이름의 표가 `stage_gen.py` 상단에 있다.
