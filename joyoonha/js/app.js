/* ============================================================
   조윤하 아나운서 프로필 (데모) — 인터랙션
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ── 토스트 ── */
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  }

  $('#year').textContent = new Date().getFullYear();

  /* ── 번호 복사 ── */
  $$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(btn.dataset.copy); toast('전화번호를 복사했습니다'); }
    catch { toast(btn.dataset.copy); }
  }));

  /* ── 티커 ── */
  const words = [
    'International MC', '정부 공식행사', 'Korean · English · Japanese', 'VIP Docent',
    'Conference Host', '국제 심포지엄', 'News Anchor', '순차통역', 'Ceremony', '음악회 MC',
  ];
  const html = words.map(w => `<span>${esc(w)}</span>`).join('');
  $('#ticker').innerHTML = html + html;

  /* ── 등장 애니메이션 ── */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* ── 네비 ── */
  const nav = $('#nav'), prog = $('#navProgress'), links = $('#links'), burger = $('#burger'), totop = $('#totop');
  const secs = $$('section[id]');
  let lastY = 0;
  function onScroll() {
    const y = window.scrollY;
    const h = document.documentElement.scrollHeight - innerHeight;
    prog.style.width = (h > 0 ? y / h * 100 : 0) + '%';
    nav.classList.toggle('is-scrolled', y > 10);
    nav.classList.toggle('is-hidden', y > 320 && y > lastY && !links.classList.contains('is-open'));
    totop.classList.toggle('is-on', y > 700);
    lastY = y;

    let cur = '';
    secs.forEach(s => { if (y >= s.offsetTop - 140) cur = s.id; });
    $$('a', links).forEach(a => a.classList.toggle('is-active', a.dataset.sec === cur));
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  burger.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open);
  });
  $$('a', links).forEach(a => a.addEventListener('click', () => {
    links.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false');
  }));
  totop.addEventListener('click', () => scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));

  /* ── 프로필 공유 ── */
  const siteUrl = location.origin + location.pathname.replace(/index\.html$/, '');
  const shareText =
    '[조윤하 아나운서 프로필]\n' +
    'CBS 앵커 출신 10년차 아나운서 · 한·영·일 국제행사 MC\n' +
    '섭외 문의 010-7342-0744 · yoonhacho.mc@gmail.com\n' + siteUrl;
  $('#share').addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: '조윤하 아나운서 프로필', text: shareText, url: siteUrl }); return; }
      catch (err) { if (err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(shareText); toast('프로필 링크를 복사했습니다'); }
    catch { toast(siteUrl); }
  });
})();
