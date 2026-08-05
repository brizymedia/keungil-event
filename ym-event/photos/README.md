# YM토탈이벤트 현장 사진 폴더

홈페이지 **현장 스케치(갤러리)** 섹션에서 쓰는 사진을 이 폴더에 넣습니다.

## 사진 넣는 법

1. 사진 파일을 이 폴더(`ym-event/photos/`)에 업로드합니다.
   - 권장 형식: `.jpg`
   - 권장 크기: 가로 1600px 내외 (한 장당 500KB 이하면 페이지가 빠릅니다)
   - 파일 이름은 영문·숫자로 (예: `nokdong-fireworks-2025.jpg`)

2. `ym-event/index.html` 에서 `GALLERY` 주석을 찾아 아래 부분을 고칩니다.

   ```html
   <figure class="gal-item">
     <img src="photos/nokdong-fireworks-2025.jpg" alt="녹동바다불꽃축제" loading="lazy">
     <figcaption>제24회 녹동바다불꽃축제 · 전체 행사대행</figcaption>
   </figure>
   ```

   - `src` → 넣은 사진 파일 이름
   - `alt`, `figcaption` → 해당 행사 이름

3. 사진을 더 늘리려면 `<figure>` 블록을 통째로 복사해서 붙여넣으면 됩니다.

## 크기 배치

첫 번째 사진은 크게(2칸×2줄), 마지막 사진은 가로로 길게(2칸) 나옵니다.
`style="grid-column:span 2;grid-row:span 2;"` 부분을 지우거나 옮기면 배치가 바뀝니다.
모바일에서는 배치와 상관없이 한 장씩 세로로 표시됩니다.

## 참고

현재는 임시로 레포지토리 최상단에 있는 기존 행사 사진(`../festival-nokdong.jpg` 등)을
쓰고 있습니다. 실제 YM토탈이벤트 사진으로 교체해 주세요.
