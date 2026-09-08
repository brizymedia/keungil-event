/* ============================================================
   섭외 신청 (MVP 샘플) — 달력 · 신청서 · 접수 확인
   실제 버전에서는 BUSY/HOLD 를 Apps Script(캘린더 free/busy)에서 받아오고,
   submit 에서 Apps Script 웹앱으로 POST 합니다.
   ============================================================ */
(function () {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  /* ── 데모 일정: 오늘 기준으로 만든다 ── */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rel = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return key(d); };
  const BUSY = new Set([rel(2), rel(3), rel(9), rel(14), rel(15), rel(21), rel(27), rel(33), rel(40), rel(41), rel(48)]);
  const HOLD = new Set([rel(6), rel(12), rel(23), rel(36), rel(52)]);

  /* ── 토스트 ── */
  const toastEl = $('#toast'); let toastT;
  const toast = (m) => { toastEl.textContent = m; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2400); };

  $('#year').textContent = today.getFullYear();

  /* ── 달력 ── */
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = null;
  const grid = $('#calGrid'), title = $('#calTitle');

  function render() {
    const y = view.getFullYear(), m = view.getMonth();
    title.innerHTML = `${y}.${pad(m + 1)}<small>${['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'][m]}</small>`;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    let html = DOW.map(d => `<div class="cal__dow">${d}</div>`).join('');
    for (let i = 0; i < first; i++) html += `<div class="day is-empty"></div>`;
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m, d); const k = key(date);
      const cls = ['day'];
      let label = '가능';
      if (date < today) { cls.push('is-past'); label = ''; }
      else if (BUSY.has(k)) { cls.push('is-busy'); label = ''; }
      else if (HOLD.has(k)) { cls.push('is-hold'); label = '상담 중'; }
      if (date.getDay() === 0) cls.push('is-sun');
      if (k === key(today)) cls.push('is-today');
      if (selected === k) cls.push('is-sel');
      html += `<button type="button" class="${cls.join(' ')}" data-k="${k}" ${cls.includes('is-past') || cls.includes('is-busy') ? 'disabled' : ''}><b>${d}</b>${label ? `<small>${label}</small>` : ''}</button>`;
    }
    grid.innerHTML = html;
  }
  render();

  $('#calPrev').addEventListener('click', () => { view.setMonth(view.getMonth() - 1); render(); });
  $('#calNext').addEventListener('click', () => { view.setMonth(view.getMonth() + 1); render(); });

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.day[data-k]');
    if (!b || b.disabled) return;
    selected = b.dataset.k;
    render();
    const [yy, mm, dd] = selected.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd);
    const txt = `${yy}년 ${mm}월 ${dd}일 (${DOW[d.getDay()]})`;
    $('#dateText').innerHTML = `<b>${yy}.${pad(mm)}.${pad(dd)}</b> <span>${DOW[d.getDay()]}요일${HOLD.has(selected) ? ' · 상담 중인 날 — 시간대에 따라 가능' : ''}</span>`;
    $('#dateBox').classList.add('is-set');
    $('#sDate').textContent = txt;
    setStep(2);
    if (innerWidth < 920) $('#formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ── 단계 표시 ── */
  function setStep(n) {
    $$('.step').forEach(s => {
      const k = Number(s.dataset.step);
      s.classList.toggle('is-on', k === n);
      s.classList.toggle('is-done', k < n);
    });
  }

  /* ── 요약 실시간 반영 ── */
  const fm = $('#fm');
  function syncSummary() {
    $('#sEvent').textContent = [$('#fEvent').value, $('#fType').value].filter(Boolean).join(' · ');
    $('#sPlace').textContent = [$('#fPlace').value, $('#fStart').value && `${$('#fStart').value}–${$('#fEnd').value}`].filter(Boolean).join(' · ');
    $('#sLang').textContent = $$('input[name=lang]:checked').map(i => i.value).join(' · ');
    $('#sContact').textContent = [$('#fName').value, $('#fOrg').value, $('#fPhone').value].filter(Boolean).join(' · ');
  }
  fm.addEventListener('input', syncSummary);
  fm.addEventListener('change', syncSummary);
  syncSummary();

  /* ── 제출 (데모: 전송 없이 접수 화면만) ── */
  fm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selected) { toast('먼저 달력에서 행사 날짜를 골라주세요'); $('#calPanel').scrollIntoView({ behavior: 'smooth' }); return; }
    if (!fm.checkValidity()) { fm.reportValidity(); return; }
    if (!$$('input[name=lang]:checked').length) { toast('진행 언어를 하나 이상 골라주세요'); return; }

    const no = 'YH-' + selected.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    $('#doneNo').textContent = '접수번호 ' + no;
    $('#doneText').innerHTML = `<b>${$('#fOrg').value}</b> ${$('#fName').value}님, <b>${$('#sDate').textContent}</b> 「${$('#fEvent').value}」 섭외 신청을 받았습니다.`;
    fm.hidden = true;
    $('#done').hidden = false;
    $('#formPanel').querySelector('.panel__k').textContent = 'Step 3 · Confirmed';
    $('#formPanel').querySelector('h2').textContent = '접수 확인';
    $('#formPanel').querySelector('.panel__lead').textContent = '아래 내용으로 접수되었습니다.';
    setStep(3);
    $('#formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('샘플 화면입니다. 실제로는 전송되지 않았습니다');
  });

  $('#again').addEventListener('click', () => {
    fm.hidden = false; $('#done').hidden = true;
    $('#formPanel').querySelector('.panel__k').textContent = 'Step 2 · Request';
    $('#formPanel').querySelector('h2').textContent = '행사 정보';
    $('#formPanel').querySelector('.panel__lead').textContent = '정확한 견적을 위해 아는 범위에서만 적어주셔도 됩니다.';
    selected = null; render();
    $('#dateBox').classList.remove('is-set'); $('#dateText').textContent = '왼쪽 달력에서 행사 날짜를 골라주세요';
    $('#sDate').textContent = '';
    setStep(1);
    $('#calPanel').scrollIntoView({ behavior: 'smooth' });
  });

  /* ── 샘플 상태 미리보기: booking.html?demo=filled | done ── */
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo === 'filled' || demo === 'done') {
    const pick = rel(17); const [yy, mm] = pick.split('-').map(Number);
    view = new Date(yy, mm - 1, 1); render();
    grid.querySelector(`.day[data-k="${pick}"]`)?.click();
    $('#fEvent').value = '2026 스마트제조 혁신 컨퍼런스';
    $('#fType').value = '국제 컨퍼런스 · 심포지엄';
    $('#fPlace').value = '서울 코엑스 그랜드볼룸';
    $('#fStart').value = '13:30'; $('#fEnd').value = '17:00';
    $$('input[name=lang]').forEach(i => { i.checked = ['한국어', '영어', '순차통역'].includes(i.value); });
    $('#fSize').value = '300~1,000명'; $('#fBudget').value = '200만 원 이상';
    $('#fName').value = '김민지 과장'; $('#fOrg').value = '한국공작기계산업협회';
    $('#fPhone').value = '010-1234-5678'; $('#fMail').value = 'minji.kim@koami.or.kr';
    $('#fMemo').value = '해외 연사 3명 순차통역 필요. 리허설 12:00. 대본은 행사 1주 전 전달 예정.';
    $('#fAgree').checked = true;
    syncSummary();
    if (demo === 'done') fm.requestSubmit();
  }

  /* ── 모바일 메뉴 ── */
  const links = $('#links'), burger = $('#burger');
  burger.addEventListener('click', () => { const o = links.classList.toggle('is-open'); burger.setAttribute('aria-expanded', o); });
})();
