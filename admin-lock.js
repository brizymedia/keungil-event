/*
 * 관리자 화면 잠금 — 견적서 · 전자계약서 · 거래명세서의 「?admin=1」 화면에만 건다.
 * 손님 화면(admin=1 없음 · 계약 서명 링크 · 손님용 견적서)은 그대로 열린다.
 *
 * 암호는 이 파일에 없다. 계약 서버에 {action:'boxList', pw} 를 보내 ok 가 오면 연다
 * (대표 암호 = 계약 서버 스크립트 속성 BOX_PW — 견적서 저장함 · 관리자 모드와 같은 암호).
 * 맞으면 이 기기에 기억한다 → 다음부터는 조용히 확인만 하고 바로 열린다.
 * 계약 서버 주소가 비어 있으면(서버 없는 곳) 잠그지 않는다.
 *
 * 쓰는 법: <head> 안에 <script src="admin-lock.js" data-server='…/exec' data-key='keungil-quote-box-pw' data-name='큰길이벤트기획'></script>
 */
(function () {
  var me = document.currentScript;
  var 서버 = (me && me.getAttribute('data-server')) || '';
  var 열쇠 = (me && me.getAttribute('data-key')) || 'keungil-quote-box-pw';
  var 일정열쇠 = 열쇠.replace(/quote-box-pw$/, 'sched-pw');
  var 회사 = (me && me.getAttribute('data-name')) || '';
  if (new URLSearchParams(location.search).get('admin') !== '1' || !서버) return;

  var 루트 = document.documentElement;
  루트.classList.add('admin-locked');
  var css = document.createElement('style');
  css.textContent =
    'html.admin-locked body>*:not(#admin-lock){display:none!important}' +
    '#admin-lock{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:#09090b;font-family:Pretendard,system-ui,"Malgun Gothic",sans-serif;color:#fff}' +
    '#admin-lock form{width:100%;max-width:360px;background:#16141C;border:1px solid rgba(245,158,11,.25);border-radius:18px;padding:28px 24px;text-align:center}' +
    '#admin-lock .ic{width:52px;height:52px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:#F59E0B;color:#09090b}' +
    '#admin-lock h1{font-size:1.25rem;margin:0}' +
    '#admin-lock p{color:#b9b3c2;font-size:.86rem;margin:.45rem 0 1.1rem;line-height:1.6;word-break:keep-all}' +
    '#admin-lock input{width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:.8rem .9rem;color:#fff;font:inherit;font-size:1rem;outline:none}' +
    '#admin-lock input:focus{border-color:#F59E0B}' +
    '#admin-lock button{width:100%;margin-top:.7rem;border:0;border-radius:10px;padding:.85rem;background:#F59E0B;color:#09090b;font:inherit;font-weight:800;cursor:pointer}' +
    '#admin-lock button[disabled]{opacity:.6;cursor:wait}' +
    '#admin-lock .err{min-height:1.3em;color:#FBBF24;font-size:.83rem;margin:.7rem 0 0}' +
    '#admin-lock a{color:#FBBF24;font-size:.8rem}';
  document.head.appendChild(css);

  function 읽기(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function 쓰기(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function 확인(v) {
    return fetch(서버, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'boxList', pw: v }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || j.ok !== true) { var e = new Error((j && j.error) || '암호'); e.pw = /암호/.test(e.message); throw e; } });
  }
  function 열기() {
    루트.classList.remove('admin-locked');
    var el = document.getElementById('admin-lock'); if (el) el.remove();
  }

  function 화면() {
    var box = document.createElement('div');
    box.id = 'admin-lock';
    box.innerHTML =
      '<form autocomplete="off"><div class="ic"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>' +
      '<h1>관리자 화면</h1><p>' + (회사 ? 회사 + ' ' : '') + '대표 전용 화면입니다.<br>대표 암호를 넣어 주세요.</p>' +
      '<input type="password" placeholder="대표 암호" aria-label="대표 암호" autocomplete="current-password">' +
      '<button type="submit">들어가기</button><p class="err" role="alert"></p>' +
      '<a href="' + location.pathname + '">← 손님 화면으로</a></form>';
    document.body.appendChild(box);
    var f = box.querySelector('form'), pw = box.querySelector('input'), go = box.querySelector('button'), err = box.querySelector('.err');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = pw.value.trim(); if (!v) { err.textContent = '암호를 넣어 주세요.'; pw.focus(); return; }
      go.disabled = true; go.textContent = '확인 중…'; err.textContent = '';
      확인(v).then(function () { 쓰기(열쇠, v); if (!읽기(일정열쇠)) 쓰기(일정열쇠, v); 열기(); })
        .catch(function (x) { err.textContent = x.pw ? '암호가 맞지 않습니다.' : '연결이 안 됩니다 — 잠시 뒤 다시 해 주세요.'; pw.select(); })
        .then(function () { go.disabled = false; go.textContent = '들어가기'; });
    });
    return { pw: pw, err: err };
  }

  function 시작() {
    var 저장 = 읽기(열쇠);
    var ui = 화면();
    if (저장) {
      ui.err.textContent = '확인 중…';
      확인(저장).then(열기).catch(function (x) {
        if (x.pw) { 쓰기(열쇠, ''); ui.err.textContent = '저장된 암호가 바뀌었습니다. 다시 넣어 주세요.'; }
        else { ui.err.textContent = '연결이 안 됩니다 — 잠시 뒤 새로고침해 주세요.'; }
        ui.pw.focus();
      });
    } else ui.pw.focus();
  }
  if (document.body) 시작(); else document.addEventListener('DOMContentLoaded', 시작);
})();
