# threads-autopost — 스레드 예약 발행 도구

공식 **Threads API**만 사용하는 스레드 자동 발행 도구입니다.
로그인 정보를 넣는 매크로나 자동 좋아요·팔로우 기능은 없습니다. 그래서 계정이 정지될 걱정이 적습니다.

| 명령 | 하는 일 |
|---|---|
| `npm run whoami` | 토큰이 맞는지 확인 (내 아이디·사용자명 출력) |
| `npm run token:exchange` | 짧은 토큰(1시간)을 장기 토큰(60일)으로 교환 |
| `npm run token:refresh` | 장기 토큰을 60일 연장 (만료 전에 실행) |
| `npm run generate -- --topic "주제" --days 30` | Claude로 30일 × 하루 3개 원고 생성 → `posts.json` |
| `npm run list` | 발행 예정·완료 목록 |
| `npm run publish` | 발행 시각이 지난 글만 발행 (`--dry`는 미리보기) |
| `npm run replies -- --post <게시물ID>` | 키워드(예: "자료")를 쓴 답글에만 링크 답글 1회씩 |
| `npm run insights` | 최근 게시물 조회수·좋아요·답글·리포스트·답글률 |

## 5분 시작

```bash
npm install
cp .env.example .env         # THREADS_ACCESS_TOKEN 입력
npm run whoami               # ✓ 연결됨 — @내아이디
cp posts.example.json posts.json   # 원고 파일 (또는 npm run generate)
npm run publish -- --dry     # 미리보기
npm run publish              # 실제 발행
```

## 원고 파일 형식 (`posts.json`)

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | ✓ | 겹치지 않는 이름 (예: `2026-10-01-0810`) |
| `at` | ✓ | 발행 시각 (`2026-10-01T08:10:00+09:00`) |
| `text` | ✓ | 본문, 500자 이내 |
| `image` / `video` | | 공개 인터넷 주소(URL)여야 함 |
| `link` | | 링크 미리보기 카드 (텍스트 글에만) |
| `topic` | | 주제 태그 1개 |

발행 결과는 `published.json`에 기록되므로, 여러 번 실행해도 같은 글이 두 번 올라가지 않습니다.
한 번 실행에 최대 `MAX_PER_RUN`(기본 3)개, 글 사이 1분 간격으로 발행합니다.

## 자동 실행

- **GitHub Actions**: `threads-autopost.yml`을 **비공개 저장소**의 `.github/workflows/`에 넣고, Secrets에 `THREADS_ACCESS_TOKEN`을 등록합니다.
- **윈도우**: 작업 스케줄러 → 매일 08:15·12:45·20:35 → `cmd /c cd 도구폴더 && npm run publish`
- **맥/리눅스**: `crontab -e` → `15 8,12,20 * * * cd ~/threads-autopost && npm run publish`

## 안전 수칙

- 토큰은 비밀번호와 같습니다. `.env`와 GitHub Secrets에만 넣으세요. (`.gitignore`에 `.env`가 들어 있습니다.)
- 공식 API 한도는 24시간에 게시물 250개, 답글 1,000개입니다. 하지만 **하루 3~5개**를 권합니다.
- 자동 답글은 같은 사람에게 한 번만, 답글 사이 최소 20초 간격으로 보냅니다. 문구는 여러 개를 돌려 가며 씁니다.
- `generate`로 만든 원고는 **꼭 읽고 내 경험과 말투로 고친 뒤** 발행하세요.
- `generate`는 Claude의 서버 측 대체 모델 기능(`fallbacks: "default"`)을 켜 둡니다. 드물게 요청이 거절되면 다른 모델이 이어서 답합니다.
