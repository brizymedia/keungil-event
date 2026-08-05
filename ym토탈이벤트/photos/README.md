# YM토탈이벤트 현장 사진 폴더

홈페이지 **히어로(메인 배경)** 와 **현장 스케치(갤러리)** 에서 쓰는 사진입니다.
업로드하신 원본 25장을 웹용으로 최적화해 24장으로 정리했습니다. (28MB → 5.6MB)

## 파일 목록

| 파일 | 쓰임 | 행사 |
|---|---|---|
| `hero-nokdong-fireworks.jpg` | **메인 히어로 배경** | 제24회 녹동바다불꽃축제 무대 |
| `nokdong-drone-violin.jpg` | 갤러리 | 2026 고흥 녹동항 드론쇼 버스킹 · 특수효과 |
| `truss-rigging.jpg` | 갤러리 | 조명 트러스 시공 · 무빙라이트 설치 |
| `festival-night-crowd.jpg` | 갤러리 | 야간 축제 무대 · 관객석 |
| `gohung-farmers-violin.jpg` | 갤러리 | 제23회 고흥군 농업경영인 대회 · 전자바이올린 공연 |
| `nokdong-drone-booth.jpg` | 갤러리 | 녹동항 드론쇼 버스킹 · 현장 음향 |
| `rose-festa.jpg` | 갤러리 | 제5회 봉덕동 장미축제 LOVE ROSE FESTA |
| `namyeol-sunrise-stage.jpg` | 갤러리 | 2026 고흥 남열 해맞이 행사 · 무대 설치 |
| `namyeol-sunrise-open.jpg` | 갤러리 | 2026 고흥 남열 해맞이 행사 · 개막 |
| `led-wall-build.jpg` | 갤러리 | LED 전광판 설치 |
| `gohung-farmers-stage.jpg` | 갤러리 | 제23회 고흥군 농업경영인 대회 · 무대 조명 |
| `gohung-farmers-hall.jpg` | 갤러리 | 제23회 고흥군 농업경영인 대회 · 객석 |
| `hanmaum-groundbreaking.jpg` | 갤러리 | 한마음선원 목포지원 새 도량 기공법회 |
| `jeonnam-coop-launch.jpg` | 갤러리 | 전라남도이벤트협동조합 발대식 |
| `nokdong-lions.jpg` | 갤러리 | 녹동라이온스클럽 회장단 이·취임식 |
| `mg-parkgolf.jpg` | 갤러리 | 2026 MG새마을금고 파크골프 어울림 한마당 |
| `outdoor-console-sky.jpg` | 갤러리 | 야외 행사 음향 오퍼레이팅 |
| `nokdong-drone-street.jpg` | 갤러리 | 녹동항 드론쇼 버스킹 · 무대 음향 |
| `damyang-hall.jpg` | 갤러리 | 담양문화복지회관 실내 행사 · 음향 · 영상 |
| `banquet-hall.jpg` | 갤러리 | 실내 연회장 행사 음향 |
| `ceremony-indoor.jpg` | 갤러리 | 실내 기념식 음향 오퍼레이팅 |
| `lions-gym.jpg` | 갤러리 | 라이온스클럽 실내 행사 음향 |
| `night-rack-setup.jpg` | 갤러리 | 야간 행사 음향 · 조명 랙 세팅 |
| `street-booth-staff.jpg` | 갤러리 | 야외 행사 음향 부스 |

행사명이 사실과 다르면 알려주세요. `index.html`의 `GALLERY` 구역에서
해당 `<figcaption>` 문구만 고치면 됩니다.

## 사진 추가하는 법

1. 사진 파일을 이 폴더에 업로드합니다.
   - 권장: 가로 1400px 내외, 한 장당 300KB 이하 (페이지가 빨라집니다)
   - 파일 이름은 영문·숫자로 (예: `nokdong-fireworks-2027.jpg`)

2. `ym토탈이벤트/index.html` 에서 `GALLERY` 주석을 찾아 아래처럼 한 칸 추가합니다.

   ```html
   <figure class="gal-item">
     <img src="photos/파일이름.jpg" alt="행사 이름" loading="lazy">
     <figcaption>행사 이름</figcaption>
   </figure>
   ```

3. 크게 보이게 하려면 `<figure>` 에 스타일을 붙입니다.
   - 2칸×2줄 크게: `style="grid-column:span 2;grid-row:span 2;"`
   - 가로로 길게: `style="grid-column:span 2;"`
   - 모바일에서는 배치와 상관없이 한 장씩 세로로 표시됩니다.

## 메인 히어로 사진 바꾸는 법

`index.html` 에서 `photos/hero-nokdong-fireworks.jpg` 를 찾아
(히어로 `<img>` 와 `og:image` 두 곳) 원하는 파일 이름으로 바꾸면 됩니다.
히어로는 **가로로 넓은 사진**이 잘림이 적어 잘 어울립니다.

## 참고

원본 파일(`KakaoTalk_*.jpg`)은 최적화본으로 대체해 삭제했지만,
Git 기록에 그대로 남아 있어 언제든 되살릴 수 있습니다.
