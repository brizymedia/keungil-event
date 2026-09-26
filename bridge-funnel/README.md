# 큰길브리지 자동 영업 퍼널 — SNS 홍보부터 계약 · 결제까지

전략(왜 이렇게 하는지, 채널별 운영, 목표 숫자)은 **[STRATEGY.md](STRATEGY.md)**. 이 문서는 **설치와 연결**입니다.

```
 스레드 · 인스타 · 유튜브 (자동 게시 · 댓글 키워드 자동 DM)            ← sns/ + .github/workflows/bridge-sns.yml
        │  모든 링크에 utm (어느 채널 · 어느 글에서 왔는지)
        ▼
 free/     무료 자료 3종 신청 — 전자책 · 전자명함 · 내 가게 데모       ← 연락처 수집 (개인정보 동의)
        ▼
 welcome/  전자책 PDF · 명함 만들기 · 「○○가게」 데모 즉시 열람       ← 기존 demo/ 생성기 재사용
        ▼  (자동 메일: 자료 → 1일 · 3일 · 6일 후속)
 go/       자동 견적 → 계약 정보 → 계약서 자동 작성 → 전자서명         ← 기존 contract.html + 전자계약 서버 재사용
        ▼  (서명되는 순간 자동으로 다음 화면)
 pay/      계약금 결제 — 카드 · 계좌이체 · 간편결제(토스) / 무통장       ← 자동영업 서버가 금액 대조 후 승인
        ▼
 자료 제출서(start/) 안내 메일 → 제작 착수
```

| 파일 | 하는 일 |
|---|---|
| `config.js` | **설정 한 곳** — 요금표 · 계좌 · 서버 주소 · 토스 키 |
| `free/index.html` | 리드마그넷 랜딩 (AI 검색 시대에 왜 홈페이지인가 + 신청 폼) |
| `ebook/index.html`, `ebook/ai-search-7.pdf` | 전자책 「AI가 추천하는 가게의 7가지 조건」 (13쪽) |
| `welcome/index.html` | 자료 받기 + 내 가게 데모 미리보기 |
| `go/index.html` | 자동 견적 → 계약서 자동 작성 → 서명 대기 |
| `pay/index.html` | 계약금 · 잔금 결제 (토스 결제위젯 / 무통장) |
| `apps-script/큰길브리지-자동영업서버.gs` | 리드 대장 · 자동 메일 · 후속 메일 · 결제 승인 · 입금 확인 · 매일 현황 |
| `sns/` | 원고 · 카드 이미지 · 게시 · 댓글 응대 · 잠재 고객 찾기 스크립트 |
| `../.github/workflows/bridge-sns.yml` | SNS 자동 일정표 |

지금 상태로도 **화면은 전부 동작**합니다(서버를 안 깔아도 신청은 기존 문의 서버로, 결제는 무통장으로 받음).
아래 1~4를 차례로 하면 전 과정이 자동이 됩니다.

---

## 0. 페이지 주소

이 저장소(main)에 합쳐지면 바로 열립니다.
- 무료 자료: `https://큰길이벤트기획.com/bridge-funnel/free/`
- 자동 견적: `https://큰길이벤트기획.com/bridge-funnel/go/`

**권장: 큰길브리지 본 사이트(ai-make 저장소)로 옮기기.** `bridge-funnel/` 안의 `config.js · funnel.css · free/ · welcome/ · go/ · pay/ · ebook/` 를 ai-make 저장소 **맨 위(루트)** 에 그대로 복사하면 `www.ai-make.co.kr/free/` 로 열립니다(경로가 그렇게 맞춰져 있음). 옮긴 뒤:
1. GitHub 저장소 변수 `BRIDGE_LANDING` = `https://www.ai-make.co.kr/free/`
2. 자동영업 서버의 `FUNNEL` = `'https://www.ai-make.co.kr'`
3. ai-make 첫 화면 · 인스타 프로필 링크를 `/free/` 로

(이벤트 도메인에 있는 동안은 `config.js` 가 자동으로 `noindex` 를 붙여 검색 중복을 막습니다.)

---

## 1. 자동 영업 서버 설치 (Google Apps Script, 10분)

1. https://script.google.com → **새 프로젝트** → 이름 `큰길브리지 자동영업`
2. `Code.gs` 내용을 지우고 **`apps-script/큰길브리지-자동영업서버.gs`** 를 통째로 붙여넣기 → 저장
3. 위쪽 함수 목록에서 **`설치`** 선택 → ▶ 실행 → 권한 허용 (드라이브 · 시트 · 메일 · 외부 요청)
   - 실행 로그에 **대장 시트 주소**와 **SNS 봇 열쇠**가 찍힙니다. 열쇠는 5단계에서 씁니다.
4. **배포 → 새 배포 → 웹 앱** · 실행: **나** · 액세스: **모든 사용자** → 배포 → 웹 앱 URL 복사
5. ⚙ 프로젝트 설정 → **스크립트 속성**
   | 이름 | 값 |
   |---|---|
   | `WEBAPP_URL` | 방금 복사한 웹 앱 URL (메일 속 「수신 거부」 「입금 확인」 링크용) |
   | `TOSS_SECRET_KEY` | 토스 시크릿 키 (2단계) |
   | `SOLAPI_KEY` · `SOLAPI_SECRET` · `SMS_FROM` | (선택) 문자 발송 — 솔라피 가입 · 발신번호 등록 후 |
   | `OWNER_PHONE` | (선택) 사장님 휴대폰 — 새 리드 · 결제를 문자로도 |
6. `config.js` 의 `FUNNEL_API: ''` 에 웹 앱 URL 넣기 → 커밋
7. 확인: 함수 **`점검`** 실행(계약 서버 연결 · 트리거 · 메일 한도) → 함수 **`시험리드`** 실행 → 사장님 메일로 자료 메일 · 새 리드 알림이 오면 성공

코드를 고친 뒤에는 **배포 → 배포 관리 → 연필 → 새 버전** (새 배포를 만들면 주소가 바뀝니다).

**대장 시트 (드라이브 「큰길브리지 자동영업 대장」)**
- `리드` — 신청자 · 유입 경로 · 단계(자료 신청 → 데모 조회 → 견적 → 서명 → 결제) · 후속 메일 발송 기록
- `계약` — 자동 견적으로 만들어진 계약서, 상태(서명 대기 → 결제 대기 → 착수 대기)
- `결제` — 온라인 · 무통장 결제, 영수증
- `활동` — 퍼널 단계별 기록 (익명 랜딩 조회는 날짜별 숫자만)

---

## 2. 토스페이먼츠 (카드 · 계좌이체 · 간편결제)

1. https://www.tosspayments.com 가입 → **결제위젯** 연동 신청 → 가맹점 심사 (사업자 서류, 홈페이지에 사업자 정보 · 환불 규정 표시 — `pay/` 하단에 이미 있음)
2. 개발자센터 → API 키 → **결제위젯 연동 키**
   - 클라이언트 키(`live_gck_…`) → `config.js` 의 `TOSS_CLIENT_KEY`
   - 시크릿 키(`live_gsk_…`) → 서버 스크립트 속성 `TOSS_SECRET_KEY` **(절대 config.js · 깃허브에 넣지 말 것)**
3. 심사 전에는 문서용 테스트 키가 들어 있어 **실제 돈이 나가지 않는** 시험 결제가 됩니다(결제 화면에 「테스트 결제」 표시). 서버 속성에도 테스트 시크릿 키를 넣어야 승인까지 시험됩니다.
4. 결제 금액은 **서버가 계약 서버에서 계약서를 다시 읽어 계산한 금액과 같을 때만** 승인합니다. 화면에서 금액을 조작해도 승인되지 않습니다.

무통장: 고객이 「입금했습니다」를 누르면 사장님 메일에 **✅ 입금 확인 처리** 단추가 옵니다. 통장 확인 후 누르면 고객에게 결제 확인 · 자료 제출서 안내가 자동으로 갑니다.

---

## 3. SNS 자동화 연결

GitHub → 이 저장소 → **Settings → Secrets and variables → Actions**

### 스레드
1. https://developers.facebook.com → 앱 만들기 → 사용 사례 **「Threads API 액세스」**
2. 권한: `threads_basic` `threads_content_publish` `threads_manage_replies` `threads_read_replies` `threads_keyword_search`
3. 앱 역할 → Threads 테스터에 큰길브리지 스레드 계정 추가 → 스레드 앱에서 초대 수락
4. 그래프 API 탐색기(Threads)에서 토큰 발급 → **장기 토큰(60일)으로 교환**
5. 시크릿: `THREADS_TOKEN` (장기 토큰), `THREADS_USER_ID` (숫자 ID, 모르면 `me`)

### 인스타그램 (비즈니스 · 크리에이터 계정)
1. 같은 메타 앱 → 제품 **「Instagram API (Instagram 로그인)」** 추가
2. 권한: `instagram_business_basic` `instagram_business_content_publish` `instagram_business_manage_comments` `instagram_business_manage_messages`
3. 계정 연결 → 액세스 토큰 생성(장기, 60일)
4. 시크릿: `IG_TOKEN`, `IG_USER_ID` (인스타 비즈니스 계정 ID)
5. 인스타 앱 → 설정 → 메시지 → **「연결된 도구 허용」 켜기** (DM 자동 답장에 필요)
- 앱이 「개발 모드」인 동안은 역할이 있는 계정의 댓글에만 DM이 됩니다. 모든 고객에게 쓰려면 메타 **앱 검수(권한 심사)** 를 받아 「라이브」로 바꾸세요.

### 유튜브 쇼츠
1. https://console.cloud.google.com → 새 프로젝트 → **YouTube Data API v3** 사용 설정
2. OAuth 동의 화면(외부) → 사용자 인증 정보 → **OAuth 클라이언트 ID (웹 애플리케이션)**, 리디렉션 URI 에 `https://developers.google.com/oauthplayground`
3. https://developers.google.com/oauthplayground → ⚙ 에서 「Use your own OAuth credentials」 → 범위 `https://www.googleapis.com/auth/youtube.upload` → 큰길브리지 채널 계정으로 승인 → **refresh token** 복사
4. 시크릿: `YT_CLIENT_ID` `YT_CLIENT_SECRET` `YT_REFRESH_TOKEN`
5. ⚠ 구글 **감사(audit)를 통과하기 전 API 업로드는 비공개로 잠깁니다.** 변수 `YT_PRIVACY` = `private` 로 두고 스튜디오에서 공개로 바꾸거나, YouTube API 감사 양식을 제출하세요.

### 그 밖의 시크릿 · 변수
| 종류 | 이름 | 값 |
|---|---|---|
| 시크릿 | `BRIDGE_FUNNEL_KEY` | 1단계 `설치` 로그의 「SNS 봇 열쇠」 (잠재 고객 메일용) |
| 시크릿 | `SECRETS_PAT` | (권장) 토큰 자동 연장용 — GitHub 세분화 토큰, 이 저장소 **Secrets: Read and write** |
| 시크릿 | `ANTHROPIC_API_KEY` | (선택) AI 댓글 응대 — https://console.anthropic.com |
| 변수 | `BRIDGE_FUNNEL_API` | 1단계 웹 앱 URL |
| 변수 | `BRIDGE_LANDING` | 무료 자료 주소 (ai-make 로 옮기면 `https://www.ai-make.co.kr/free/`) |
| 변수 | `AI_REPLY` | `1` 이면 키워드 없는 **질문형** 댓글에 Claude 가 2~3문장 답글 (한 번에 최대 5개) |
| 변수 | `SNS_PAUSED` | `1` 이면 전부 멈춤 |
| 변수 | `YT_PRIVACY` | `public` / `unlisted` / `private` |

### 시험
Actions → **큰길브리지 SNS 자동화** → Run workflow → 할 일 `threads`, 연습 ✅ → 로그에 올라갈 글이 찍히면 연결 준비 끝. 연습 ☐ 로 한 번 실제 게시해 보세요.

### 일정 (한국 시간)
| 시각 | 채널 |
|---|---|
| 매일 08:52 | 스레드 원고 (캐러셀 + 글 + 링크) |
| 매일 12:10 | 인스타 캐러셀 |
| 매일 20:07 | 스레드 짧은 질문형 글 |
| 화 · 목 · 토 19:13 | 인스타 릴스 (세로 영상 자동 생성) |
| 월 · 수 · 금 18:17 | 유튜브 쇼츠 |
| 30분마다 | 댓글 키워드 → 인스타 DM / 스레드 링크 답글 (+ AI 응대) |
| 매일 07:23 | 스레드 잠재 고객 글 → 사장님 메일 |
| 매주 월 03:37 | 스레드 · 인스타 토큰 연장 |

원고 30편 · 짧은 글 30편 = **약 한 달치**. 다 쓰면 로그에 「원고를 다 올렸습니다」가 뜹니다. `sns/content.json` 맨 아래에 이어 쓰면(형식은 기존 글 그대로) 커밋하는 순간 카드 이미지가 자동으로 만들어지고 다음 순서에 올라갑니다.

---

## 4. 운영 중 확인

- 매일 아침 8시 **「📊 자동영업 현황」** 메일 — 랜딩 조회 · 리드 · 유입 경로 · 계약 · 결제
- 대장 시트 `리드` 의 **단계** 칸으로 누가 어디서 멈췄는지 보고, 「견적 완료」에서 멈춘 분께는 직접 전화 한 통
- 요금이 바뀌면 `config.js` 의 `PLANS · OPTIONS` 와 ai-make 의 `quote.html · contract.html · index.html` 을 **같이** 고칠 것

## 로컬에서 카드 · 영상 만들어 보기
```bash
cd bridge-funnel/sns
npm install
npx playwright install chromium
node check.mjs            # 원고 검사
node render.mjs           # 카드 이미지 (cards/p01/1.jpg …)
node render.mjs --video p05   # 세로 영상 (ffmpeg 필요)
node post.mjs threads --dry   # 올라갈 글 미리 보기
```
