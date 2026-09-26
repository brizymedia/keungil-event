/**
 * 큰길브리지 — 자동 영업 서버 (Google Apps Script)
 * ────────────────────────────────────────────────────────────
 * free/ · welcome/ · go/ · pay/ 화면이 부르는 백엔드 하나.
 *
 *   POST {action:'lead', ...}      무료 자료 신청 → 리드 저장 · 자료 메일 · 사장님 알림 · (선택) 문자
 *   POST {action:'event', ...}     퍼널 단계 기록 (랜딩 조회 · 데모 조회 · 견적 · 서명 …)
 *   POST {action:'contract', ...}  자동 견적으로 계약서가 만들어짐 → 리드와 연결 · 사장님 알림
 *   POST {action:'status', c, stage}           이미 결제됐는지
 *   POST {action:'confirm', paymentKey, orderId, amount, c, stage}
 *                                  토스 결제 승인 — 계약 서버에서 계약을 다시 읽어 금액을 대조한 뒤에만 승인
 *   POST {action:'bank', ...}      무통장 입금 확인 요청 → 사장님 메일에 「입금 확인」 한 번 누르면 끝
 *   POST {action:'prospects', key, items}  SNS 봇(listen.mjs)이 찾은 잠재 고객 글 → 사장님 메일 (BOT_KEY 필요)
 *   GET  ?ping=1                   살아 있는지 · 버전
 *   GET  ?unsub=ID&t=…             소식 수신 거부 (메일 하단 링크)
 *   GET  ?bankok=행&k=…            사장님 전용: 무통장 입금 확인 처리
 *
 * 매시간 자동 (설치() 를 한 번 실행하면 걸린다)
 *   - 후속 메일: 신청 1일 · 3일 · 6일 뒤 (소식 수신 동의한 분만, 계약하면 멈춤)
 *   - 계약서 만들고 24시간 서명 안 함 → 서명 안내 메일
 *   - 서명하고 24시간 결제 안 함 → 결제 안내 메일
 *   - 가상계좌 입금 대기 → 입금되면 자동 완료 처리
 * 매일 아침 8시: 사장님께 어제 현황 요약 메일
 *
 * 설치는 같은 폴더 README.md 참고. 시크릿 키는 코드가 아니라 「스크립트 속성」에 넣는다.
 */

/** ── 설정 ─────────────────────────────────────────── */
var BRAND          = '큰길브리지';
var OWNER_EMAIL    = 'gilauto325@gmail.com';        // 알림 받을 주소
var TEL            = '1533-7295';
var SITE           = 'https://www.ai-make.co.kr';   // 데모 · 계약서 · 명함 · 자료 제출서가 있는 곳
var FUNNEL         = 'https://xn--wk0bn7yi8h24iszc.com/bridge-funnel';   // free/ go/ pay/ ebook/ 이 올라간 곳 — ai-make 로 옮기면 'https://www.ai-make.co.kr' 로
var CONTRACT_API   = 'https://script.google.com/macros/s/AKfycbzB5cpUDleZnChRIRFWELgJ2uAbxa5fe2iBE9upWqUl92BgTPA4KrDWtTp5UZJ31Ezc/exec';
var SHEET_TITLE    = '큰길브리지 자동영업 대장';
var VERSION        = '2026-09-26a';
var PROMO          = '';   // 후속 메일에 넣을 혜택 한 줄 (예: '이번 달 계약 시 도메인 1년 무료'). 비우면 혜택 문구 없이 보낸다
/* 스크립트 속성 (⚙ 프로젝트 설정 → 스크립트 속성)
 *   TOSS_SECRET_KEY   토스페이먼츠 결제위젯 시크릿 키 (test_gsk_… / live_gsk_…) — 필수(온라인 결제)
 *   SOLAPI_KEY / SOLAPI_SECRET / SMS_FROM   (선택) 솔라피 문자 발송 — 없으면 문자는 건너뛴다
 *   OWNER_PHONE       (선택) 사장님 휴대폰 — 새 리드 · 결제를 문자로도 받는다
 *   WEBAPP_URL        배포한 웹 앱 주소(…/exec) — 메일 속 「수신 거부」 「입금 확인」 링크에 쓴다. 배포 후 꼭 넣을 것
 *   SHEET_ID · ADMIN_KEY · SIGN_SECRET · BOT_KEY  — 설치() 가 자동으로 만든다. 지우지 말 것
 */
/** ─────────────────────────────────────────────────── */

var P = PropertiesService.getScriptProperties();

/* ══ 진입점 ══════════════════════════════════════════ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.unsub) return html_(수신거부_(p.unsub, p.t));
  if (p.bankok) return html_(입금확인처리_(p.bankok, p.k));
  return json_({ ok: true, service: 'keungil-bridge-funnel', version: VERSION, toss: !!P.getProperty('TOSS_SECRET_KEY'), time: new Date().toISOString() });
}

function doPost(e) {
  var b = {};
  try { b = JSON.parse((e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: '잘못된 요청 형식입니다' }); }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    switch (b.action) {
      case 'ping':     return json_({ ok: true, version: VERSION });
      case 'lead':     return json_(리드_(b));
      case 'event':    return json_(활동_(b));
      case 'contract': return json_(계약알림_(b));
      case 'status':   return json_(결제상태_(b));
      case 'confirm':  return json_(결제승인_(b));
      case 'bank':     return json_(입금요청_(b));
      case 'prospects': return json_(잠재고객_(b));
      default:         return json_({ ok: false, error: '알 수 없는 요청입니다' });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


/* ══ 1. 리드 (무료 자료 신청) ═════════════════════════ */
var 리드머리 = ['접수시각', 'ID', '상호', '성함', '휴대폰', '이메일', '업종', '지역', '기존 홈페이지', '소식 수신', '유입 경로',
               '데모', '단계', '계약ID', '계약금액', '결제', '최근 활동', '후속메일', '수신거부'];
var C_ = {}; 리드머리.forEach(function (h, i) { C_[h] = i + 1; });

function 리드_(b) {
  var email = 다듬기_(b.email, 120), tel = 다듬기_(b.tel, 30), org = 다듬기_(b.org, 80), name = 다듬기_(b.name, 40);
  if (!org || !name || !isEmail_(email) || String(tel).replace(/[^0-9]/g, '').length < 9) throw new Error('입력값을 확인해 주세요');
  /* 같은 메일로 10분 안에 또 오면 새로 만들지 않고 기존 ID 를 돌려준다 (두 번 누름 · 봇) */
  var cache = CacheService.getScriptCache(), ck = 'lead_' + email.toLowerCase();
  var 있던 = cache.get(ck); if (있던) return { ok: true, id: 있던, dup: true };

  var id = 새ID_('L');
  var demo = /^https:\/\/www\.ai-make\.co\.kr\/demo\//.test(String(b.demo || '')) ? String(b.demo) : '';
  시트_('리드').appendRow([지금_(), id, org, name, tel, email, 다듬기_(b.bizName || b.biz, 30), 다듬기_(b.area, 40), 다듬기_(b.has, 20),
    b.mkt ? 'Y' : 'N', 다듬기_(b.src, 120), demo, '자료 신청', '', '', '', 지금_(), '', '']);
  cache.put(ck, id, 600);
  활동기록_(id, 'lead_submit', b.page, b.src, org);

  /* 신청자에게 — 자료 3종 (요청한 자료라 광고 메일이 아니다) */
  var 이름 = name + ' 사장님';
  메일_(email, '[' + BRAND + '] 요청하신 무료 자료 3종입니다', 틀_(
    '<h2 style="margin:0 0 12px">' + esc_(이름) + ', 자료 보내 드립니다</h2>' +
    '<p>「AI가 추천하는 가게의 7가지 조건」 전자책과 무료 전자명함, 그리고 <b>' + esc_(org) + '</b> 이름으로 만든 홈페이지 데모입니다.</p>' +
    단추_(FUNNEL + '/ebook/ai-search-7.pdf', '📘 전자책 PDF 받기', true) +
    단추_(SITE + '/card/', '📇 무료 전자명함 만들기') +
    (demo ? 단추_(demo, '🖥 ' + org + ' 홈페이지 데모 보기') : '') +
    '<p style="margin-top:22px">전자책 12쪽의 <b>20문항 체크리스트</b>부터 해 보세요. 10분이면 우리 가게가 AI 검색에 얼마나 준비돼 있는지 보입니다.</p>' +
    '<p>데모가 마음에 드시면 옵션을 골라 바로 견적을 보실 수 있습니다 — 상담 전화 없이 계약 · 결제까지 온라인으로 됩니다.</p>' +
    단추_(FUNNEL + '/go/?l=' + id + '&utm_source=email&utm_campaign=welcome', '자동 견적 보기 →'),
    id, false));

  /* 사장님께 — 새 리드 */
  메일_(OWNER_EMAIL, '🟡 새 리드 · ' + org + ' (' + (b.bizName || '') + ' · ' + (b.area || '지역 미기재') + ')', 틀_(
    '<h2 style="margin:0 0 12px">새 리드가 들어왔습니다</h2>' +
    표_([['상호', org], ['성함', name], ['휴대폰', tel], ['이메일', email], ['업종', b.bizName || b.biz], ['지역', b.area],
        ['기존 홈페이지', b.has], ['소식 수신', b.mkt ? '동의' : '거부'], ['유입', b.src], ['ID', id]]) +
    (demo ? 단추_(demo, '고객이 받은 데모 보기', true) : '') +
    단추_('tel:' + String(tel).replace(/[^0-9]/g, ''), '📞 바로 전화') +
    '<p style="color:#888;font-size:13px">자료 메일은 자동 발송됐습니다. 데모를 열어 보면 데모 알림 서버가 따로 알려 드립니다. 1 · 3 · 6일 뒤 후속 메일도 자동입니다.</p>', '', true));

  문자_(tel, '[' + BRAND + '] ' + name + '님, 요청하신 전자책 · 데모를 메일로 보냈습니다. 데모 바로 보기: ' + (demo ? 짧게_(demo) : FUNNEL + '/welcome/'));
  사장님문자_('[새 리드] ' + org + ' ' + name + ' ' + tel + ' (' + (b.src || '') + ')');
  return { ok: true, id: id };
}


/* ══ 2. 활동 기록 ════════════════════════════════════ */
var 단계이름 = { landing_view: '랜딩 조회', lead_submit: '자료 신청', welcome_view: '자료 페이지', demo_view: '데모 조회', click_pdf: '전자책 받음',
  click_card: '명함 만들기', click_demo: '데모 크게 봄', click_go: '견적으로 이동', quote_view: '견적 조회', quote_plan: '요금제 변경', quote_done: '견적 완료',
  contract_created: '계약서 작성', contract_signed: '서명 완료', pay_view: '결제 화면', pay_click: '결제 시도', paid: '결제 완료', bank_claim: '입금 확인 요청' };
var 단계순서 = ['자료 신청', '자료 페이지', '데모 조회', '견적 조회', '견적 완료', '계약서 작성', '서명 완료', '결제 화면', '결제 시도', '입금 확인 요청', '결제 완료'];

function 활동_(b) {
  var step = String(b.step || '').slice(0, 40);
  if (!단계이름[step]) return { ok: true, skip: true };
  /* 익명 조회는 하루치 숫자만 센다 (시트가 조회로 넘치지 않게) */
  if (!b.lead && (step === 'landing_view' || step === 'quote_view')) { 세기_(step); return { ok: true }; }
  var 상세 = [b.plan, b.total, b.amount, b.contract, b.stage].filter(function (v) { return v !== undefined && v !== ''; }).join(' · ');
  활동기록_(다듬기_(b.lead, 20), step, b.page, b.src, 상세);
  if (b.lead) 리드단계_(b.lead, 단계이름[step]);
  return { ok: true };
}
function 활동기록_(lead, step, page, src, 상세) {
  시트_('활동').appendRow([지금_(), lead || '', 단계이름[step] || step, 다듬기_(page, 80), 다듬기_(src, 100), 다듬기_(상세, 200)]);
}
function 세기_(step) {
  var k = 'cnt_' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd') + '_' + step;
  P.setProperty(k, String(Number(P.getProperty(k) || 0) + 1));
}
/* 단계는 앞으로만 간다 (데모를 다시 봤다고 「결제 완료」가 「데모 조회」로 돌아가면 안 된다) */
function 리드단계_(id, 새단계, 추가) {
  var r = 리드찾기_(id); if (!r) return;
  var sh = 시트_('리드'), row = sh.getRange(r, 1, 1, 리드머리.length).getValues()[0];
  var 지금단계 = row[C_['단계'] - 1];
  if (단계순서.indexOf(새단계) > 단계순서.indexOf(지금단계)) sh.getRange(r, C_['단계']).setValue(새단계);
  sh.getRange(r, C_['최근 활동']).setValue(지금_());
  Object.keys(추가 || {}).forEach(function (k) { sh.getRange(r, C_[k]).setValue(추가[k]); });
}
function 리드찾기_(id) {
  if (!id) return 0;
  var sh = 시트_('리드'), n = sh.getLastRow(); if (n < 2) return 0;
  var ids = sh.getRange(2, C_['ID'], n - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) if (ids[i][0] === id) return i + 2;
  return 0;
}


/* ══ 3. 계약서 작성 알림 ═════════════════════════════ */
var 계약머리 = ['시각', '계약ID', '계약번호', '상호', '성함', '휴대폰', '이메일', '요금제', '합계', '계약금', '리드ID', '유입', '계약서', '상태', '안내메일'];
function 계약알림_(b) {
  var id = String(b.id || '').replace(/[^A-Z0-9]/g, '');
  if (!id) throw new Error('계약 ID 가 없습니다');
  var 원본 = 계약읽기_(id);   // 진짜 계약 서버에 있는 계약인지 확인 (아무나 알림을 꾸미지 못하게)
  if (!원본) throw new Error('계약서를 찾을 수 없습니다');
  var c = 원본.contract, m = 금액_(c);
  var url = SITE + '/contract.html?c=' + id + '&s=' + 배포ID_(CONTRACT_API);
  if (계약행_(id)) return { ok: true, dup: true };
  시트_('계약').appendRow([지금_(), id, c.meta && c.meta.no || '', c.cl.org || '', c.cl.name || c.cl.rep || '', c.cl.tel || '', c.cl.email || '',
    (c.pj && (c.pj.planName || c.pj.plan)) || '', m.total, m.dep, 다듬기_(b.lead, 20), 다듬기_(b.src, 100), url, '서명 대기', '']);
  if (b.lead) 리드단계_(b.lead, '계약서 작성', { '계약ID': id, '계약금액': m.total });

  /* 고객에게 — 계약서 주소 (창을 닫아도 다시 들어올 수 있게) */
  if (isEmail_(c.cl.email)) 메일_(c.cl.email, '[' + BRAND + '] 홈페이지 제작 계약서 — 서명 부탁드립니다 (' + (c.meta && c.meta.no || id) + ')', 틀_(
    '<h2 style="margin:0 0 12px">계약서가 준비됐습니다</h2>' +
    표_([['계약번호', c.meta && c.meta.no || id], ['내용', (c.pj.planName || '') + ' · ' + (c.pj.title || '')], ['합계 (부가세 포함)', 원_(m.total)], ['계약금', 원_(m.dep)]]) +
    단추_(url, '계약서 보고 서명하기', true) +
    '<p>서명하시면 서명본 PDF가 이 주소로 오고, 바로 계약금 결제 화면으로 이어집니다.</p>' +
    단추_(FUNNEL + '/pay/?c=' + id, '서명 후 결제하기'), '', true));

  메일_(OWNER_EMAIL, '🟠 자동 계약서 작성 · ' + (c.cl.org || '') + ' · ' + 원_(m.total), 틀_(
    '<h2 style="margin:0 0 12px">고객이 자동 견적으로 계약서를 만들었습니다</h2>' +
    표_([['상호', c.cl.org], ['대표/담당', c.cl.name || c.cl.rep], ['휴대폰', c.cl.tel], ['이메일', c.cl.email], ['요금제', c.pj.planName],
        ['항목', (c.items || []).map(function (it) { return it.n + ' ' + 원_(it.p); }).join('<br>')], ['합계', 원_(m.total)], ['계약금', 원_(m.dep)], ['오픈 희망', c.sch && c.sch.open]]) +
    단추_(url, '계약서 보기', true) +
    '<p style="color:#888;font-size:13px">서명되면 계약 서버가 서명본 PDF를 보내 드리고, 결제되면 이 서버가 다시 알려 드립니다. 24시간 안에 서명 · 결제가 없으면 고객에게 자동으로 한 번 더 안내합니다.</p>', '', true));
  사장님문자_('[자동계약] ' + (c.cl.org || '') + ' ' + 원_(m.total) + ' 계약서 작성');
  return { ok: true };
}


/* ══ 4. 결제 ═════════════════════════════════════════ */
var 결제머리 = ['시각', '계약ID', '계약번호', '상호', '단계', '금액', '방법', '상태', '주문번호', 'paymentKey', '영수증', '입금자', '리드ID', '처리'];

function 결제상태_(b) {
  var cid = String(b.c || '').replace(/[^A-Z0-9]/g, ''), stage = b.stage === 'bal' ? 'bal' : 'dep';
  var r = 결제찾기_(function (row) { return row[1] === cid && row[4] === 단계말_(stage) && row[7] === '완료'; });
  if (!r) return { ok: true, paid: false };
  return { ok: true, paid: true, amount: r.row[5], method: r.row[6], at: 날짜글_(r.row[0], true) };
}

function 결제승인_(b) {
  var key = P.getProperty('TOSS_SECRET_KEY');
  if (!key) throw new Error('결제 서버에 토스 시크릿 키가 설정되지 않았습니다');
  var paymentKey = String(b.paymentKey || ''), orderId = String(b.orderId || ''), amount = Number(b.amount);
  /* 주문번호 = KB_{계약ID}_{dep|bal}_{시각} — 여기서 계약과 단계를 읽는다 (화면이 보낸 c · stage 는 믿지 않는다) */
  var m = orderId.match(/^KB_([A-Z0-9]{6,12})_(dep|bal)_[A-Z0-9]+$/);
  if (!m || !paymentKey) throw new Error('주문 정보가 올바르지 않습니다');
  var cid = m[1], stage = m[2];

  /* 같은 주문을 두 번 승인하지 않는다 (새로고침) */
  var 전 = 결제찾기_(function (row) { return row[8] === orderId && row[7] === '완료'; });
  if (전) return { ok: true, already: true, receipt: 전.row[10] };

  var 원본 = 계약읽기_(cid);
  if (!원본) throw new Error('계약서를 찾을 수 없습니다');
  if (원본.status !== 'signed') throw new Error('서명되지 않은 계약입니다');
  var 금 = 금액_(원본.contract);
  var 맞는금액 = stage === 'bal' ? 금.bal : (금.d === 0 ? 금.total : 금.dep);
  if (amount !== 맞는금액) throw new Error('결제 금액이 계약과 다릅니다 (계약 ' + 맞는금액 + ' / 요청 ' + amount + ')');
  if (결제상태_({ c: cid, stage: stage }).paid) throw new Error('이미 결제가 완료된 계약입니다 — 중복 결제는 자동 취소 요청해 주세요');

  var res = UrlFetchApp.fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(key + ':'), 'Idempotency-Key': orderId },
    payload: JSON.stringify({ paymentKey: paymentKey, orderId: orderId, amount: amount })
  });
  var t = {}; try { t = JSON.parse(res.getContentText()); } catch (_) {}
  if (res.getResponseCode() !== 200) {
    if (t.code === 'ALREADY_PROCESSED_PAYMENT') t = 토스조회_(paymentKey) || t;
    else throw new Error((t && t.message) || ('결제 승인 실패 (' + res.getResponseCode() + ')'));
  }
  var 방법 = 결제수단_(t), 영수증 = (t.receipt && t.receipt.url) || '';
  var c = 원본.contract;
  if (t.status === 'WAITING_FOR_DEPOSIT') {
    /* 가상계좌 — 계좌가 발급됐을 뿐 아직 돈은 안 들어왔다. 매시간 확인에서 입금되면 완료로 바꾼다 */
    시트_('결제').appendRow([지금_(), cid, c.meta && c.meta.no || '', c.cl.org || '', 단계말_(stage), amount, 방법, '입금 대기', orderId, paymentKey, 영수증, '', 다듬기_(b.lead, 20), '']);
    var va = t.virtualAccount || {};
    if (isEmail_(c.cl.email)) 메일_(c.cl.email, '[' + BRAND + '] 입금 계좌 안내 (' + 원_(amount) + ')', 틀_(
      '<h2 style="margin:0 0 12px">아래 계좌로 입금해 주세요</h2>' + 표_([['은행', va.bankCode || va.bank || ''], ['계좌번호', va.accountNumber], ['금액', 원_(amount)], ['입금 기한', va.dueDate]]) +
      '<p>입금되면 자동으로 확인되고 제작이 시작됩니다.</p>', '', true));
    return { ok: true, waiting: true, receipt: 영수증 };
  }
  if (t.status !== 'DONE') throw new Error('결제가 완료되지 않았습니다 (' + (t.status || '알 수 없음') + ')');
  결제완료_(cid, c, stage, amount, 방법, orderId, paymentKey, 영수증, '', b.lead);
  return { ok: true, receipt: 영수증 };
}

function 결제완료_(cid, c, stage, amount, 방법, orderId, paymentKey, 영수증, 입금자, lead, 행) {
  if (행) {
    var sh = 시트_('결제');
    sh.getRange(행, 8).setValue('완료'); sh.getRange(행, 14).setValue(지금_());
    if (영수증) sh.getRange(행, 11).setValue(영수증);
  } else {
    시트_('결제').appendRow([지금_(), cid, c.meta && c.meta.no || '', c.cl.org || '', 단계말_(stage), amount, 방법, '완료', orderId, paymentKey, 영수증, 입금자 || '', 다듬기_(lead, 20), 지금_()]);
  }
  var cr = 계약행_(cid); if (cr) 시트_('계약').getRange(cr, 14).setValue(stage === 'bal' ? '잔금 완료' : '착수 대기(계약금 완료)');
  var leadId = lead || (cr ? 시트_('계약').getRange(cr, 11).getValue() : '');
  if (leadId) 리드단계_(leadId, '결제 완료', { '결제': 단계말_(stage) + ' ' + 원_(amount) + ' (' + 방법 + ')' });

  var 이름 = (c.cl.name || c.cl.rep || '') + ' 대표님';
  if (isEmail_(c.cl.email)) 메일_(c.cl.email, '[' + BRAND + '] ' + 단계말_(stage) + ' 결제 확인 — 제작을 시작합니다', 틀_(
    '<h2 style="margin:0 0 12px">' + esc_(이름) + ', 감사합니다</h2>' +
    표_([['계약번호', c.meta && c.meta.no || cid], ['결제', 단계말_(stage) + ' ' + 원_(amount)], ['방법', 방법]]) +
    (영수증 ? 단추_(영수증, '영수증 보기') : '') +
    (stage === 'dep' ? '<p><b>이제 한 가지만 해 주세요.</b> 로고 · 사진 · 소개글 · 가격표를 아래 「자료 제출서」로 보내 주시면 바로 시안 작업에 들어갑니다. 휴대폰으로 찍은 사진이면 충분합니다.</p>' +
      단추_(SITE + '/start/', '📂 자료 제출서 보내기', true) : '<p>잔금까지 모두 확인됐습니다. 오픈 후 관리도 계속 도와드리겠습니다.</p>') +
    '<p>영업일 2일 이내에 담당자가 연락드립니다. 급한 일은 ' + TEL + '.</p>', '', true));
  메일_(OWNER_EMAIL, '🟢 결제 완료 · ' + (c.cl.org || '') + ' · ' + 단계말_(stage) + ' ' + 원_(amount), 틀_(
    '<h2 style="margin:0 0 12px">결제가 들어왔습니다</h2>' +
    표_([['상호', c.cl.org], ['계약번호', c.meta && c.meta.no], ['단계', 단계말_(stage)], ['금액', 원_(amount)], ['방법', 방법], ['입금자', 입금자], ['연락처', c.cl.tel + ' · ' + c.cl.email]]) +
    (영수증 ? 단추_(영수증, '영수증') : '') + 단추_(SITE + '/contract.html?c=' + cid + '&s=' + 배포ID_(CONTRACT_API), '계약서', true) +
    '<p style="color:#888;font-size:13px">고객에게 자료 제출서 안내가 자동으로 갔습니다. 카드 · 간편결제는 토스가 세금계산서 대상이 아니니, 법인 고객이 세금계산서를 원하면 따로 발행하세요.</p>', '', true));
  문자_(c.cl.tel, '[' + BRAND + '] ' + 단계말_(stage) + ' ' + 원_(amount) + ' 결제가 확인됐습니다. 자료 제출서: ' + SITE + '/start/');
  사장님문자_('[결제] ' + (c.cl.org || '') + ' ' + 단계말_(stage) + ' ' + 원_(amount) + ' ' + 방법);
}

function 입금요청_(b) {
  var cid = String(b.c || '').replace(/[^A-Z0-9]/g, ''), stage = b.stage === 'bal' ? 'bal' : 'dep';
  var 원본 = 계약읽기_(cid); if (!원본) throw new Error('계약서를 찾을 수 없습니다');
  var c = 원본.contract, 금 = 금액_(c), amount = stage === 'bal' ? 금.bal : (금.d === 0 ? 금.total : 금.dep);
  var sh = 시트_('결제');
  sh.appendRow([지금_(), cid, c.meta && c.meta.no || '', c.cl.org || '', 단계말_(stage), amount, '무통장', '입금 확인 요청', '', '', '', 다듬기_(b.depositor, 30), 다듬기_(b.lead, 20), '']);
  var 행 = sh.getLastRow();
  if (b.lead) 리드단계_(b.lead, '입금 확인 요청');
  var 확인 = 웹주소_() + '?bankok=' + 행 + '&k=' + 관리키_();
  메일_(OWNER_EMAIL, '🔵 입금 확인 요청 · ' + (c.cl.org || '') + ' · ' + 원_(amount) + ' (입금자 ' + (b.depositor || '') + ')', 틀_(
    '<h2 style="margin:0 0 12px">무통장 입금 확인을 요청했습니다</h2>' +
    표_([['상호', c.cl.org], ['계약번호', c.meta && c.meta.no], ['단계', 단계말_(stage)], ['금액', 원_(amount)], ['입금자명', b.depositor], ['연락처', c.cl.tel]]) +
    '<p>통장에서 입금을 확인하셨으면 아래 단추를 한 번 누르세요. 고객에게 결제 확인 · 자료 제출서 안내가 자동으로 갑니다.</p>' +
    단추_(확인, '✅ 입금 확인 처리', true), '', true));
  사장님문자_('[입금요청] ' + (c.cl.org || '') + ' ' + 원_(amount) + ' 입금자 ' + (b.depositor || ''));
  return { ok: true };
}

function 입금확인처리_(행, k) {
  if (!k || k !== 관리키_()) return '<h2>권한이 없습니다</h2>';
  행 = Number(행); var sh = 시트_('결제');
  if (!(행 >= 2 && 행 <= sh.getLastRow())) return '<h2>기록을 찾을 수 없습니다</h2>';
  var row = sh.getRange(행, 1, 1, 결제머리.length).getValues()[0];
  if (row[7] === '완료') return '<h2>이미 처리된 입금입니다</h2><p>' + esc_(row[3]) + ' · ' + 원_(row[5]) + '</p>';
  var 원본 = 계약읽기_(row[1]); if (!원본) return '<h2>계약서를 찾을 수 없습니다</h2>';
  결제완료_(row[1], 원본.contract, row[4] === '잔금' ? 'bal' : 'dep', Number(row[5]), '무통장', '', '', '', row[11], row[12], 행);
  return '<h2>✅ 입금 확인 처리 완료</h2><p>' + esc_(row[3]) + ' · ' + esc_(row[4]) + ' ' + 원_(row[5]) + '<br>고객에게 결제 확인 · 자료 제출서 안내 메일이 발송됐습니다.</p>';
}


/* ══ 4-2. 잠재 고객 글 (스레드 검색 봇) ═══════════════ */
function 잠재고객_(b) {
  if (!b.key || b.key !== 봇키_()) throw new Error('권한이 없습니다');
  var items = (b.items || []).slice(0, 40);
  if (!items.length) return { ok: true };
  메일_(OWNER_EMAIL, '🔎 스레드 잠재 고객 글 ' + items.length + '개 — 직접 말 걸어 보세요', 틀_(
    '<h2 style="margin:0 0 12px">홈페이지를 찾는 사람들</h2><p style="color:#666">자동으로 답글을 달지 않았습니다. 글을 읽고 도움이 되는 답을 직접 달아 주세요 — 광고보다 조언이 전환이 잘 됩니다.</p>' +
    items.map(function (it) { return '<div style="border:1px solid #eee;border-radius:10px;padding:12px 14px;margin:10px 0"><div style="font-size:12px;color:#999">「' + esc_(it.q) + '」 · @' + esc_(it.user) + ' · ' + esc_(String(it.at).slice(0, 16)) + '</div><div style="margin:6px 0">' + esc_(it.text) + '</div><a href="' + esc_(it.url) + '">스레드에서 열기 →</a></div>'; }).join(''), '', true));
  return { ok: true, n: items.length };
}


/* ══ 5. 매시간 — 후속 메일 · 미서명 · 미결제 · 가상계좌 ═════ */
function 매시간() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return;
  /* 광고 · 안내 메일은 낮(08~21시)에만 — 정보통신망법상 야간 광고 전송 제한 */
  var 시 = Number(Utilities.formatDate(new Date(), 'Asia/Seoul', 'H')), 낮 = 시 >= 8 && 시 < 21;
  try { if (낮) { 후속메일_(); 계약재안내_(); } 가상계좌확인_(); } finally { lock.releaseLock(); }
}

/* 후속 메일 3통 — 소식 수신 동의(Y) · 수신거부 아님 · 아직 계약서 안 만든 분만. 정보통신망법: 제목에 (광고), 본문에 수신거부 */
var 후속 = [
  { 일: 1, 제목: '(광고) 챗GPT에 우리 가게를 물어보셨나요?', 본문: function (r) {
    return '<p>' + esc_(r.성함) + ' 사장님, 어제 받으신 전자책의 「오늘 할 일」 첫 번째 — 해 보셨나요?</p>' +
      '<p style="background:#FFF8E6;border-radius:10px;padding:14px 16px"><b>「' + esc_(r.지역 || '우리 지역') + ' ' + esc_(r.업종 || '우리 업종') + ' 추천해 줘」</b></p>' +
      '<p>이 한 줄을 챗GPT나 네이버에 넣어 보세요. ' + esc_(r.상호) + '가 안 나온다면, AI가 읽을 「근거 문장」이 아직 없다는 뜻입니다. 전자책 5쪽의 공식으로 한 문장만 써 두셔도 시작입니다.</p>' +
      (r.데모 ? 단추_(r.데모, esc_(r.상호) + ' 데모 다시 보기', true) : '');
  } },
  { 일: 3, 제목: '(광고) 데모 그대로 만들면 얼마일까요? — 1분 견적', 본문: function (r) {
    return '<p>' + esc_(r.성함) + ' 사장님, ' + esc_(r.상호) + ' 데모는 보셨나요?</p>' +
      '<p>큰길브리지는 <b>상담 전화 없이</b> 견적 → 전자계약 → 결제까지 온라인으로 끝납니다. 옵션을 누르면 금액이 바로 계산되고, 마음에 들면 그 자리에서 계약서가 만들어집니다.</p>' +
      표_([['베이직', '원페이지 · 모바일 · 전화 · 카톡 · 지도 — 10만원'], ['고급형 (추천)', '5페이지 · 문의 폼 · 네이버 · 구글 검색 등록 — 50만원'], ['회사형', '페이지 무제한 · 관리자 · 매월 블로그 기사 — 100만원']]) +
      (PROMO ? '<p style="background:#FFF8E6;border-radius:10px;padding:12px 14px">🎁 ' + esc_(PROMO) + '</p>' : '') +
      단추_(FUNNEL + '/go/?l=' + r.ID + '&utm_source=email&utm_campaign=d3', '1분 자동 견적 보기', true) +
      '<p style="color:#888;font-size:13px">부가세 별도 · 계약금 50% 결제 후 착수</p>';
  } },
  { 일: 6, 제목: '(광고) 마지막으로 하나만 여쭤볼게요', 본문: function (r) {
    return '<p>' + esc_(r.성함) + ' 사장님, 자료를 받으신 지 일주일이 됐습니다.</p>' +
      '<p>홈페이지를 망설이시는 이유가 <b>비용</b>이라면 베이직(10만원)으로 시작해 나중에 페이지를 늘리셔도 되고, <b>시간</b>이라면 자료는 휴대폰 사진 몇 장이면 충분합니다. 나머지는 저희가 합니다.</p>' +
      '<p>궁금한 게 있으시면 이 메일에 답장하시거나 ' + TEL + ' 로 전화 주세요. 이 메일이 마지막 안내입니다.</p>' +
      단추_(FUNNEL + '/go/?l=' + r.ID + '&utm_source=email&utm_campaign=d6', '견적 보기', true) +
      (r.데모 ? 단추_(r.데모, '데모 다시 보기') : '');
  } }
];

function 후속메일_() {
  var sh = 시트_('리드'), n = sh.getLastRow(); if (n < 2) return;
  var rows = sh.getRange(2, 1, n - 1, 리드머리.length).getValues(), 지금 = Date.now(), 보냄 = 0;
  for (var i = 0; i < rows.length && 보냄 < 40; i++) {
    var r = 행객체_(rows[i]);
    if (r['소식 수신'] !== 'Y' || r['수신거부'] || r['계약ID']) continue;
    var 경과일 = (지금 - 시각_(r['접수시각'])) / 864e5, 한것 = String(r['후속메일'] || '');
    for (var j = 0; j < 후속.length; j++) {
      var f = 후속[j], 표시 = 'D' + f.일;
      if (한것.indexOf(표시) >= 0 || 경과일 < f.일 || 경과일 > f.일 + 2) continue;   // 이틀 넘게 밀린 건 건너뛴다 (한꺼번에 몰아 보내지 않게)
      if (!isEmail_(r['이메일'])) break;
      메일_(r['이메일'], f.제목, 틀_(f.본문({ ID: r.ID, 성함: r['성함'], 상호: r['상호'], 지역: r['지역'], 업종: r['업종'], 데모: r['데모'] }), r.ID, false));
      한것 += (한것 ? ',' : '') + 표시;
      sh.getRange(i + 2, C_['후속메일']).setValue(한것);
      보냄++;
      break;   // 한 번 돌 때 한 사람에게 한 통만
    }
  }
}

function 계약재안내_() {
  var sh = 시트_('계약'), n = sh.getLastRow(); if (n < 2) return;
  var rows = sh.getRange(2, 1, n - 1, 계약머리.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], 상태 = r[13], 안내 = String(r[14] || ''), 경과 = (Date.now() - 시각_(r[0])) / 36e5;
    if (경과 < 24 || 경과 > 24 * 10) continue;
    if (상태 !== '서명 대기' && 상태 !== '결제 대기') continue;
    var 원본 = 계약읽기_(r[1]); if (!원본) continue;
    var c = 원본.contract, 금 = 금액_(c);
    if (원본.status === 'signed' && 상태 === '서명 대기') { sh.getRange(i + 2, 14).setValue('결제 대기'); 상태 = '결제 대기'; if (r[10]) 리드단계_(r[10], '서명 완료'); }
    if (상태 === '결제 대기' && 결제상태_({ c: r[1], stage: 'dep' }).paid) continue;
    var 표시 = 상태 === '서명 대기' ? 'S1' : 'P1';
    if (안내.indexOf(표시) >= 0 || !isEmail_(c.cl.email)) continue;
    if (표시 === 'S1') 메일_(c.cl.email, '[' + BRAND + '] 계약서 서명이 아직 남아 있습니다', 틀_(
      '<p>' + esc_(c.cl.name || c.cl.rep || '') + ' 대표님, 어제 만드신 홈페이지 제작 계약서(' + esc_(c.meta && c.meta.no || r[1]) + ')가 서명 전입니다.</p>' +
      '<p>내용을 바꾸고 싶으시면 이 메일에 답장만 주세요. 그대로 진행하시려면 아래에서 서명하시면 됩니다.</p>' + 단추_(r[12], '계약서 서명하기', true), '', true));
    else 메일_(c.cl.email, '[' + BRAND + '] 계약금 결제 안내 (' + 원_(금.d === 0 ? 금.total : 금.dep) + ')', 틀_(
      '<p>' + esc_(c.cl.name || c.cl.rep || '') + ' 대표님, 계약서 서명 감사합니다. 계약금이 확인되면 바로 제작에 들어갑니다.</p>' +
      단추_(FUNNEL + '/pay/?c=' + r[1], '계약금 결제하기 (카드 · 계좌이체 · 무통장)', true), '', true));
    sh.getRange(i + 2, 15).setValue(안내 + (안내 ? ',' : '') + 표시);
  }
}

function 가상계좌확인_() {
  var key = P.getProperty('TOSS_SECRET_KEY'); if (!key) return;
  var sh = 시트_('결제'), n = sh.getLastRow(); if (n < 2) return;
  var rows = sh.getRange(2, 1, n - 1, 결제머리.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]; if (r[7] !== '입금 대기' || !r[9]) continue;
    var t = 토스조회_(r[9]); if (!t) continue;
    if (t.status === 'DONE') { var 원본 = 계약읽기_(r[1]); if (원본) 결제완료_(r[1], 원본.contract, r[4] === '잔금' ? 'bal' : 'dep', Number(r[5]), r[6], r[8], r[9], (t.receipt && t.receipt.url) || '', '', r[12], i + 2); }
    else if (t.status === 'CANCELED' || t.status === 'EXPIRED' || t.status === 'ABORTED') sh.getRange(i + 2, 8).setValue('만료 · 취소');
  }
}


/* ══ 6. 매일 아침 요약 ═══════════════════════════════ */
function 매일아침() {
  var 어제 = new Date(Date.now() - 864e5), 날 = Utilities.formatDate(어제, 'Asia/Seoul', 'yyyy-MM-dd'), 키날 = 날.replace(/-/g, '');
  var 셈 = function (이름, 조건) { var sh = 시트_(이름), n = sh.getLastRow(); if (n < 2) return []; return sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues().filter(function (r) { return 날짜글_(r[0]) === 날 && (!조건 || 조건(r)); }); };
  var 리드 = 셈('리드'), 계약 = 셈('계약'), 결제 = 셈('결제', function (r) { return r[7] === '완료'; });
  var 매출 = 결제.reduce(function (a, r) { return a + Number(r[5] || 0); }, 0);
  var 랜딩 = Number(P.getProperty('cnt_' + 키날 + '_landing_view') || 0);
  var 유입 = {}; 리드.forEach(function (r) { var s = String(r[10] || 'direct').split('|')[0].replace('source=', ''); 유입[s] = (유입[s] || 0) + 1; });
  if (!리드.length && !계약.length && !결제.length && !랜딩) return;
  메일_(OWNER_EMAIL, '📊 ' + 날 + ' 자동영업 현황 — 리드 ' + 리드.length + ' · 계약 ' + 계약.length + ' · 결제 ' + 원_(매출), 틀_(
    '<h2 style="margin:0 0 12px">' + 날 + ' 현황</h2>' +
    표_([['랜딩 조회 (익명)', 랜딩 + '회'], ['무료 자료 신청 (리드)', 리드.length + '명' + (랜딩 ? ' · 전환율 ' + Math.round(리드.length / 랜딩 * 1000) / 10 + '%' : '')],
        ['유입 경로', Object.keys(유입).map(function (k) { return k + ' ' + 유입[k]; }).join(' · ') || '-'], ['자동 계약서 작성', 계약.length + '건'], ['결제 완료', 결제.length + '건 · ' + 원_(매출)]]) +
    (리드.length ? '<h3>새 리드</h3>' + 표_(리드.map(function (r) { return [r[2] + ' · ' + r[3], r[6] + ' · ' + r[7] + ' · ' + r[4]]; })) : '') +
    '<p><a href="' + 대장_().getUrl() + '">대장 시트 열기</a></p>', '', true));
}


/* ══ 7. 수신 거부 ════════════════════════════════════ */
function 수신거부_(id, t) {
  if (!id || t !== 서명_(id)) return '<h2>링크가 올바르지 않습니다</h2><p>' + TEL + ' 로 연락 주시면 바로 처리해 드립니다.</p>';
  var r = 리드찾기_(id);
  if (r) { 시트_('리드').getRange(r, C_['수신거부']).setValue(지금_()); 시트_('리드').getRange(r, C_['소식 수신']).setValue('N'); }
  return '<h2>수신 거부 처리되었습니다</h2><p>앞으로 ' + BRAND + '의 광고성 소식을 보내지 않습니다.<br>처리일: ' + 지금_() + '</p>';
}


/* ══ 설치 · 점검 (편집기에서 직접 실행) ════════════════ */
function 설치() {
  대장_();
  관리키_(); 서명비밀_(); 봇키_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['매시간', '매일아침'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('매시간').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('매일아침').timeBased().atHour(8).everyDays(1).inTimezone('Asia/Seoul').create();
  console.log('완료 — 대장: ' + 대장_().getUrl());
  console.log('SNS 봇 열쇠(BRIDGE_FUNNEL_KEY 로 GitHub 시크릿에 넣기): ' + 봇키_());
  console.log('토스 시크릿 키: ' + (P.getProperty('TOSS_SECRET_KEY') ? '있음' : '없음 (온라인 결제를 쓰려면 스크립트 속성에 TOSS_SECRET_KEY 추가)'));
}
function 점검() {
  console.log('버전 ' + VERSION + ' · 대장 ' + 대장_().getUrl());
  console.log('계약 서버: ' + UrlFetchApp.fetch(CONTRACT_API, { muteHttpExceptions: true }).getContentText().slice(0, 120));
  console.log('트리거: ' + ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }).join(', '));
  console.log('남은 메일 한도(오늘): ' + MailApp.getRemainingDailyQuota());
}
function 시험리드() {
  console.log(JSON.stringify(리드_({ org: '시험가게', name: '홍길동', tel: '010-0000-0000', email: OWNER_EMAIL, biz: 'cafe', bizName: '카페 · 식당', area: '전남 순천', has: '없음', mkt: false, src: 'test', demo: '' })));
}


/* ══ 도구 ════════════════════════════════════════════ */
function 계약읽기_(id) {
  try {
    var r = JSON.parse(UrlFetchApp.fetch(CONTRACT_API + '?id=' + encodeURIComponent(id), { muteHttpExceptions: true, followRedirects: true }).getContentText());
    return r && r.ok ? r : null;
  } catch (e) { return null; }
}
/* contract.html · 계약 서버 calcTotal_ 과 같은 계산 */
function 금액_(c) {
  var num = function (v) { return +String(v == null ? '' : v).replace(/[^0-9.-]/g, '') || 0; };
  var sub = 0; (c.items || []).forEach(function (it) { sub += num(it.q) * num(it.p); });
  var total = sub + ((c.fin && c.fin.vat) === 'excl' ? Math.round(sub * 0.1) : 0);
  var d = Number((c.fin && c.fin.deposit) || 0), dep = Math.round(total * d / 100);
  return { total: total, d: d, dep: dep, bal: total - dep };
}
function 토스조회_(paymentKey) {
  var key = P.getProperty('TOSS_SECRET_KEY'); if (!key) return null;
  var res = UrlFetchApp.fetch('https://api.tosspayments.com/v1/payments/' + encodeURIComponent(paymentKey), { muteHttpExceptions: true, headers: { Authorization: 'Basic ' + Utilities.base64Encode(key + ':') } });
  if (res.getResponseCode() !== 200) return null;
  try { return JSON.parse(res.getContentText()); } catch (e) { return null; }
}
function 결제수단_(t) {
  var m = t.method || '';
  if (t.easyPay && t.easyPay.provider) return m + '(' + t.easyPay.provider + ')';
  if (t.card && t.card.issuerCode) return m + '(' + (t.card.cardType || '') + ')';
  return m || '온라인';
}
function 단계말_(s) { return s === 'bal' ? '잔금' : '계약금'; }
function 결제찾기_(f) {
  var sh = 시트_('결제'), n = sh.getLastRow(); if (n < 2) return null;
  var rows = sh.getRange(2, 1, n - 1, 결제머리.length).getValues();
  for (var i = rows.length - 1; i >= 0; i--) if (f(rows[i])) return { row: rows[i], i: i + 2 };
  return null;
}
function 계약행_(id) {
  var sh = 시트_('계약'), n = sh.getLastRow(); if (n < 2) return 0;
  var ids = sh.getRange(2, 2, n - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) if (ids[i][0] === id) return i + 2;
  return 0;
}
function 행객체_(row) { var o = {}; 리드머리.forEach(function (h, i) { o[h] = row[i]; }); o.ID = row[1]; return o; }

function 대장_() {
  var id = P.getProperty('SHEET_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(SHEET_TITLE); P.setProperty('SHEET_ID', ss.getId()); }
  return ss;
}
function 시트_(이름) {
  var ss = 대장_(), sh = ss.getSheetByName(이름);
  if (sh) return sh;
  var 머리 = { '리드': 리드머리, '계약': 계약머리, '결제': 결제머리, '활동': ['시각', '리드ID', '단계', '페이지', '유입', '상세'] }[이름];
  sh = ss.insertSheet(이름);
  sh.appendRow(머리);
  sh.getRange(1, 1, 1, 머리.length).setFontWeight('bold').setBackground({ '리드': '#FBF0D5', '계약': '#FDE2CF', '결제': '#D5F2E8', '활동': '#E8EAF0' }[이름]);
  sh.setFrozenRows(1);
  var 기본 = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (기본 && ss.getSheets().length > 1) ss.deleteSheet(기본);
  return sh;
}

function 메일_(to, subject, html) {
  if (!isEmail_(to)) return;
  if (MailApp.getRemainingDailyQuota() < 3) { console.warn('메일 한도 부족 — 건너뜀: ' + subject); return; }
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: BRAND, replyTo: OWNER_EMAIL });
}
/* 메일 틀 — 광고 메일이면 하단에 수신 거부 링크 */
function 틀_(본문, leadId, 알림용) {
  var 거부 = (!알림용 && leadId) ? '<br><a href="' + 웹주소_() + '?unsub=' + leadId + '&t=' + 서명_(leadId) + '" style="color:#999">수신 거부</a>' : '';
  return '<div style="font-family:-apple-system,\'Malgun Gothic\',sans-serif;max-width:560px;margin:0 auto;padding:24px 20px;color:#1B1F27;line-height:1.7;font-size:15px">' +
    '<div style="font-weight:800;font-size:17px;margin-bottom:18px"><span style="color:#B98A22">●</span> ' + BRAND + '</div>' + 본문 +
    '<hr style="border:0;border-top:1px solid #eee;margin:28px 0 14px">' +
    '<p style="font-size:12px;color:#999;line-height:1.7;margin:0">(주)브리지미디어 · 큰길브리지 · 대표 김효민 · 사업자등록번호 813-81-02252<br>전남광주통합특별시 광양시 광양읍 강변동길 1, 2층 · ' + TEL + ' · ' + OWNER_EMAIL + 거부 + '</p></div>';
}
function 단추_(url, 글, 강조) {
  var s = 강조 ? 'background:#E8B84B;color:#07090F;border:1px solid #E8B84B' : 'background:#fff;color:#8A6512;border:1px solid #E8B84B';
  return '<p style="margin:10px 0"><a href="' + esc_(url) + '" style="display:inline-block;' + s + ';text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">' + 글 + '</a></p>';
}
function 표_(rows) {
  return '<table style="border-collapse:collapse;width:100%;font-size:14px;margin:8px 0 14px">' + rows.filter(function (r) { return r[1] !== undefined && r[1] !== ''; }).map(function (r) {
    return '<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;color:#777;width:34%;vertical-align:top">' + esc_(r[0]) + '</td><td style="padding:8px 10px;border-bottom:1px solid #eee">' + (String(r[1]).indexOf('<br>') >= 0 ? r[1] : esc_(r[1])) + '</td></tr>';
  }).join('') + '</table>';
}

/* 문자 — 솔라피(선택). 키가 없으면 조용히 건너뛴다 */
function 문자_(to, text) {
  var key = P.getProperty('SOLAPI_KEY'), secret = P.getProperty('SOLAPI_SECRET'), from = P.getProperty('SMS_FROM');
  to = String(to || '').replace(/[^0-9]/g, '');
  if (!key || !secret || !from || !/^01[0-9]{8,9}$/.test(to)) return;
  try {
    var date = new Date().toISOString(), salt = Utilities.getUuid().replace(/-/g, '');
    var sig = Utilities.computeHmacSha256Signature(date + salt, secret).map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
    UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'HMAC-SHA256 apiKey=' + key + ', date=' + date + ', salt=' + salt + ', signature=' + sig },
      payload: JSON.stringify({ message: { to: to, from: from, text: text } }) });
  } catch (e) { console.warn('문자 실패: ' + e); }
}
function 사장님문자_(text) { var p = P.getProperty('OWNER_PHONE'); if (p) 문자_(p, text); }
function 짧게_(u) { return String(u).length > 90 ? FUNNEL + '/welcome/' : u; }

function 봇키_() { var k = P.getProperty('BOT_KEY'); if (!k) { k = Utilities.getUuid().replace(/-/g, ''); P.setProperty('BOT_KEY', k); } return k; }
function 관리키_() { var k = P.getProperty('ADMIN_KEY'); if (!k) { k = Utilities.getUuid().replace(/-/g, ''); P.setProperty('ADMIN_KEY', k); } return k; }
function 서명비밀_() { var k = P.getProperty('SIGN_SECRET'); if (!k) { k = Utilities.getUuid(); P.setProperty('SIGN_SECRET', k); } return k; }
function 서명_(s) { return Utilities.computeHmacSha256Signature(String(s), 서명비밀_()).slice(0, 8).map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join(''); }
function 새ID_(p) { var ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = p; for (var i = 0; i < 7; i++) s += ch.charAt(Math.floor(Math.random() * ch.length)); return s; }
function 배포ID_(u) { var p = String(u || '').split('/macros/s/')[1]; return p ? p.split('/')[0] : ''; }
function 지금_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'); }
function 웹주소_() { return P.getProperty('WEBAPP_URL') || ScriptApp.getService().getUrl(); }
function 날짜글_(v, 시간도) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 시간도 ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd') : String(v).slice(0, 시간도 ? 16 : 10); }
function 시각_(v) { if (v instanceof Date) return v.getTime(); var t = Date.parse(String(v).replace(' ', 'T') + '+09:00'); return isNaN(t) ? Date.now() : t; }
function 원_(n) { return (Number(n) || 0).toLocaleString('ko-KR') + '원'; }
function 다듬기_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/^[=+\-@]/, "'$&").trim().slice(0, n || 200); }
function isEmail_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '')); }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function html_(body) {
  return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:-apple-system,\'Malgun Gothic\',sans-serif;max-width:480px;margin:60px auto;padding:0 20px;text-align:center;line-height:1.7">' + body + '<p style="margin-top:30px;color:#999;font-size:13px">' + BRAND + ' · ' + TEL + '</p></div>').setTitle(BRAND);
}
