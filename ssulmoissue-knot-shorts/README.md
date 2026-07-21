# 쓸모이슈 쇼츠 — 풀리지 않는 자루 매듭법

레퍼런스: https://youtube.com/shorts/_LfG1cMeB2s (자루 퀵릴리즈 매듭 튜토리얼)
동일한 4장면 구성(문제 제기 → 1차 매듭 → 잠금 → 퀵릴리즈)의 세로형(1080x1920) 쇼츠입니다.

## 완성본

- `ssulmoissue_knot_shorts.mp4` — 일러스트 버전 (36.5초, BGM + 한글 자막)

## 실사(AI 생성) 이미지 — Higgsfield 워크스페이스에 생성 완료

브라우저에서 바로 열어 다운로드할 수 있습니다:

| 장면 | 내용 | 링크 |
|---|---|---|
| 1 | 일반 매듭이 풀리는 문제 | [scene1.png](https://d8j0ntlcm91z4.cloudfront.net/user_3EP2dDmrGzrXFRyZxAIUMyV8nbT/hf_20260721_031259_600ca01d-6755-4a69-b8bd-155f2d298d37.png) |
| 2 | 고리 만들어 1차 매듭 | [scene2.png](https://d8j0ntlcm91z4.cloudfront.net/user_3EP2dDmrGzrXFRyZxAIUMyV8nbT/hf_20260721_031310_f5dab10e-423e-4f43-8526-f4554223cdf1.png) |
| 3 | 두 바퀴 감아 자동 잠금 | [scene3.png](https://d8j0ntlcm91z4.cloudfront.net/user_3EP2dDmrGzrXFRyZxAIUMyV8nbT/hf_20260721_031315_3e030373-d20b-42a2-b30d-2dcb212e0ede.png) |
| 4 | 위로 당겨 퀵릴리즈 | [scene4.png](https://d8j0ntlcm91z4.cloudfront.net/user_3EP2dDmrGzrXFRyZxAIUMyV8nbT/hf_20260721_031320_d483a9ca-5c32-46a1-a3a9-34139273732d.png) |

장면 1 한국어 나레이션(남성 목소리)도 Higgsfield 워크스페이스 오디오 생성 내역에 있습니다.

## 빌드 방법

```bash
pip install Pillow numpy            # + ffmpeg 필요
python3 make_video.py               # 일러스트 버전 (오프라인)
python3 make_video.py --photoreal   # 실사 이미지 자동 다운로드 버전
pip install edge-tts
python3 make_video.py --photoreal --voice  # 실사 + 한국어 나레이션 (최종 추천)
```

`--voice`는 무료 edge-tts(ko-KR-InJoonNeural)로 나레이션을 만들고 장면 길이를
나레이션에 맞춰 자동 조정합니다. 대본·자막·장면 길이는 `scenes.json`에서 수정합니다.

## 나레이션 대본

1. 자루를 이렇게 묶으면, 손을 놓는 순간 스르륵 풀려버리죠? 정말 답답합니다.
2. 올바른 방법은 이렇습니다. 먼저 줄에 아래로 향하는 고리를 만들고, 짧은 줄 끝을 고리 아래에서 위로 통과시킨 다음, 본 줄에 한 바퀴 감아 다시 고리 안으로 넣어 당겨주세요. 이러면 첫 번째 매듭 완성입니다.
3. 이제 이 매듭을 손가락에 두 바퀴 감고, 줄 끝을 두 고리 사이로 통과시킨 뒤, 자리를 잡고 아래로 당기면 매듭이 즉시 조여지면서 자동으로 잠깁니다.
4. 풀고 싶을 땐 줄 끝을 살짝 위로 당기기만 하면 한 번에 스르륵 풀립니다. 도움이 되셨다면 구독과 좋아요 부탁드려요!
