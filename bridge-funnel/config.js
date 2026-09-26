/* ══════════════════════════════════════════════════════════════
   큰길브리지 자동 영업 퍼널 — 공용 설정 (한 곳만 고치면 모든 화면이 따라간다)

   흐름:  SNS(스레드 · 인스타 · 유튜브)
            → free/     무료 자료 신청 (전자책 · 전자명함 · 내 가게 데모)  ← 연락처 수집
            → welcome/  자료 받기 + 내 가게 데모 즉시 열람
            → go/       자동 견적 → 계약서 자동 작성 → 전자서명
            → pay/      계약금 자동 결제 (카드 · 계좌이체 · 간편결제 / 무통장)
            → 자료 제출서(start/) 로 제작 착수

   ※ 요금(PLANS · OPTIONS)은 ai-make 의 quote.html · contract.html 과 같아야 한다.
     한쪽만 고치면 계약서 금액이 어긋난다.
   ══════════════════════════════════════════════════════════════ */
window.BRIDGE = {
  BRAND: '큰길브리지',
  COMPANY: '(주)브리지미디어',
  CEO: '김효민',
  BIZNO: '813-81-02252',
  TEL: '1533-7295',
  EMAIL: 'gilauto325@gmail.com',
  ADDR: '전남광주통합특별시 광양시 광양읍 강변동길 1, 2층',

  /* 기존 큰길브리지 사이트 — 데모 · 계약서 · 명함 · 자료 제출서가 여기 있다 */
  SITE: 'https://www.ai-make.co.kr',

  /* 자동 영업 서버 (apps-script/큰길브리지-자동영업서버.gs 를 배포한 웹 앱 주소)
     비워 두면: 신청은 메일 앱으로, 결제 확인은 무통장 안내로 대신한다 (화면은 그대로 돈다) */
  FUNNEL_API: '',

  /* 이미 돌고 있는 문의 접수 서버 (index.html · order.html 이 쓰는 것).
     자동 영업 서버를 아직 안 깔았을 때도 신청이 메일 · 시트로 들어오도록 함께 보낸다 */
  INQUIRY_API: 'https://script.google.com/macros/s/AKfycbwvQ4UJRZklRX7bZB6C0s1yZgSvBAMCVccT580L_1BtiVDyh0DIxShCAvN9McZIB0b7FA/exec',

  /* 기존 전자계약 서버 배포 ID (contract.html 의 서버주소_기본 과 같은 것) */
  CONTRACT_DEPLOY: 'AKfycbzB5cpUDleZnChRIRFWELgJ2uAbxa5fe2iBE9upWqUl92BgTPA4KrDWtTp5UZJ31Ezc',

  /* 토스페이먼츠 결제위젯 클라이언트 키
     - 지금 값은 토스 공식 문서의 「테스트 키」 — 실제 돈이 나가지 않는다
     - 가맹점 심사가 끝나면 개발자센터 → API 키 → 결제위젯 연동 키(live_gck_…)로 바꾼다
     - 시크릿 키는 절대 여기 넣지 않는다 (서버의 스크립트 속성 TOSS_SECRET_KEY 에만) */
  TOSS_CLIENT_KEY: 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm',

  BANK: 'KB국민은행 788101-01-397776 (예금주: 주식회사 브리지미디어)',

  /* 계약 기본값 — 계약금 50% · 잔금 50% (오픈 후 7일 이내) · 부가세 별도 */
  DEPOSIT: '50',
  VAT: 'excl',

  PLANS: {
    basic: { name:'베이직', price:100000, monthly:10000, free:'', pitch:'원페이지로 빠르게 · 1인 사업자 · 소상공인',
      inc:['반응형 원페이지 (섹션 6개)','모바일 · PC 대응','전화 · 카톡 · 지도 버튼 연결',
           'SSL 보안 인증서','월 수정 2회'] },
    premium: { name:'고급형', price:500000, monthly:20000, free:'', pitch:'가장 많이 고르는 구성 · 검색 등록까지', best:true,
      inc:['베이직 전체 포함 + 5페이지 구성','맞춤 생성형 디자인 제안','스크롤 애니메이션 · 갤러리',
           '문의 · 예약 폼 + 알림 연동','자동 견적서 생성 및 발송','네이버 · 구글 검색등록',
           '블로그 · 인스타 홍보글 자동생성'] },
    enterprise: { name:'회사형', price:1000000, monthly:50000, free:'1개월', pitch:'법인 · 기관 · 브랜드 · 직접 관리',
      inc:['고급형 전체 포함 + 페이지 무제한 설계','브랜드 컨설팅 · 로고 리터치',
           '공지 · 게시판 · 자료실 관리자 페이지','직접 수정 가능한 CMS 세팅 + 교육',
           '1개월 무상 유지보수','AI 활용 실무 강의 4회','매월 자체 블로그 홍보기사 10회'] }
  },
  OPTIONS: [
    ['도메인 등록 + 연결', 30000], ['갤러리 + 인스타·블로그 자동 연동', 50000],
    ['네이버·구글 AI 검색 세팅', 50000], ['자동 계약서 작성·서명', 50000],
    ['온라인 예약·신청 시스템', 150000], ['쇼핑몰·결제 연동', 300000],
    ['AI 챗봇 상담', 200000], ['다국어(영·중·일)', 200000],
    ['모바일 명함 + 콜백 문자', 50000], ['AI 검색 최적화 작업 (블로그글 10개 추가)', 50000],
    ['3D 무대시안 만들기', 100000],
    ['로고 + 브랜드 키트', 150000], ['상세 촬영 대행', 250000],
    ['페이지 추가', 30000], ['숏폼 홍보영상', 100000], ['AI 1:1 강의', 100000]
  ],
  /* 업종 — 데모 생성기(demo/demo.js)의 업종 키와 같아야 데모가 업종에 맞게 그려진다 */
  BIZ: [
    ['cafe','카페 · 식당'], ['salon','미용실 · 뷰티'], ['clinic','병원 · 의원'], ['academy','학원 · 교육'],
    ['interior','인테리어 · 시공'], ['pension','펜션 · 숙박'], ['event','이벤트 · 행사'], ['rental','행사용품 렌탈'],
    ['singer','가수 · 공연'], ['mc','MC · 사회자'], ['daycare','주간보호 · 요양'], ['etc','기타 업종']
  ]
};

/* 본 사이트(ai-make.co.kr)가 아닌 곳에 올라가 있으면 검색 색인에서 빼 둔다 (중복 페이지 방지) */
if (!/(^|\.)ai-make\.co\.kr$/.test(location.hostname)) {
  var m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
}

/* ── 공용 도구 ── */
(function (B) {
  B.won = function (n) { return (Number(n) || 0).toLocaleString('ko-KR') + '원'; };
  B.esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  B.b64u = function (s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  B.unb64u = function (s) { var t = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; return decodeURIComponent(escape(atob(t))); };
  B.digits = function (s) { return String(s || '').replace(/[^0-9]/g, ''); };
  B.telOk = function (s) { return /^01[016789][0-9]{7,8}$/.test(B.digits(s)) || /^0[2-6][0-9]{7,9}$/.test(B.digits(s)); };
  B.emailOk = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); };
  B.contractApi = function () { return 'https://script.google.com/macros/s/' + B.CONTRACT_DEPLOY + '/exec'; };
  /* 유입 경로 — ?utm_source=threads 처럼 들어오면 이 브라우저에 30일 기억해 두고 신청서에 싣는다 */
  B.source = function () {
    var q = new URLSearchParams(location.search), k = 'kb_src', v = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (n) { if (q.get(n)) v += (v ? '|' : '') + n.slice(4) + '=' + q.get(n); });
    try {
      if (v) localStorage.setItem(k, JSON.stringify({ v: v, t: Date.now() }));
      else { var o = JSON.parse(localStorage.getItem(k) || 'null'); if (o && Date.now() - o.t < 2592e6) v = o.v; }
    } catch (e) {}
    if (!v && document.referrer) { try { v = 'ref=' + new URL(document.referrer).hostname; } catch (e) {} }
    return v || 'direct';
  };
  /* 자동 영업 서버 호출 — Apps Script 는 text/plain 으로 보내야 사전요청(CORS) 없이 받는다 */
  B.api = function (payload) {
    if (!B.FUNNEL_API) return Promise.reject(new Error('no-server'));
    return fetch(B.FUNNEL_API, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); });
  };
  /* 퍼널 단계 기록 (실패해도 화면은 계속) */
  B.track = function (step, extra) {
    if (!B.FUNNEL_API) return;
    var p = { action: 'event', step: step, lead: B.leadId(), src: B.source(), page: location.pathname, at: new Date().toISOString() };
    for (var k in (extra || {})) p[k] = extra[k];
    try { navigator.sendBeacon(B.FUNNEL_API, new Blob([JSON.stringify(p)], { type: 'text/plain;charset=utf-8' })); } catch (e) {}
  };
  B.leadId = function () {
    var q = new URLSearchParams(location.search).get('l');
    try { if (q) localStorage.setItem('kb_lead', q); return q || localStorage.getItem('kb_lead') || ''; } catch (e) { return q || ''; }
  };
  /* 신청자 정보 — 이 브라우저에만 둔다 (다음 단계 칸을 미리 채우는 용도) */
  B.me = function (o) {
    try {
      if (o) localStorage.setItem('kb_me', JSON.stringify(o));
      return JSON.parse(localStorage.getItem('kb_me') || '{}');
    } catch (e) { return o || {}; }
  };
  /* 기존 데모 생성기로 「내 가게 홈페이지 시안」 주소 만들기 */
  B.demoUrl = function (m) {
    var d = { biz: m.biz || 'etc', org: m.org || '', owner: m.name || '', tel: m.tel || '', email: m.email || '', addr: m.area || '', areas: m.area || '' };
    return B.SITE + '/demo/#d=' + B.b64u(JSON.stringify(d));
  };
})(window.BRIDGE);
