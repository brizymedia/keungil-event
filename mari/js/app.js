/* ============================================================
   가수 마리 — 인터랙션
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const yt = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent('가수 마리 ' + q);

  /* 토스트 */
  const toastEl = $('#toast');
  let tt;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(tt);
    tt = setTimeout(() => toastEl.classList.remove('on'), 2600);
  }

  /* 기본 주입 */
  $('#yr').textContent = new Date().getFullYear();
  const phone = $('#phone');
  phone.textContent = CONFIG.phone;
  phone.href = 'tel:' + CONFIG.phone.replace(/[^0-9+]/g, '');
  $('#other').href = CONFIG.otherSite;
  $('#vThumb').src = `https://i.ytimg.com/vi/${CONFIG.featuredVideo}/maxresdefault.jpg`;
  $('#vThumb').alt = `${CONFIG.featuredTitle} — ${CONFIG.featuredEvent}`;
  $('#vTitle').textContent = CONFIG.featuredTitle;
  $('#vEvent').textContent = CONFIG.featuredEvent;

  // maxresdefault 가 없는 영상이면 hqdefault 로 내려간다
  $('#vThumb').addEventListener('error', function () {
    if (!this.dataset.fb) {
      this.dataset.fb = '1';
      this.src = `https://i.ytimg.com/vi/${CONFIG.featuredVideo}/hqdefault.jpg`;
    }
  });

  $('#copyPhone').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(CONFIG.phone); toast('전화번호를 복사했습니다'); }
    catch { toast(CONFIG.phone); }
  });

  /* 티커 */
  const words = SONGS.map(s => s.t).concat(['행사 · 축제', '초청 공연', '방송 출연']);
  const html = words.map(w => `<span>${w}</span>`).join('');
  $('#ticker').innerHTML = html + html;

  /* 기본 정보 */
  $('#facts').innerHTML = FACTS.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  /* 음반 */
  $('#albums').innerHTML = ALBUMS.map((a, i) => `
    <article class="alb reveal" style="--d:${i * 80}ms">
      <div class="alb__y">${a.year}</div>
      <div>
        <h3 class="alb__t">${a.title}${a.badge ? `<span class="alb__badge">${a.badge}</span>` : ''}</h3>
        <span class="alb__ty">${a.type}</span>
        <p class="alb__d">${a.desc}</p>
      </div>
      <div class="alb__m">${a.date}<br>${a.meta}</div>
    </article>`).join('');

  /* 수록곡 */
  $('#songs').innerHTML = SONGS.map(s => `
    <li class="${s.hot ? 'hot' : ''}">
      <button type="button" data-song="${s.t}"><span class="y">${s.y}</span><span class="n">${s.t}</span></button>
    </li>`).join('');
  $('#songs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-song]');
    if (b) window.open(yt(b.dataset.song), '_blank', 'noopener');
  });

  /* 설 수 있는 무대 */
  $('#kinds').innerHTML = STAGES.map(s => `<div><dt>${s.k}</dt><dd>${s.v}</dd></div>`).join('');

  /* 라이트박스 */
  const lb = $('#lb'), lbF = $('#lbF');
  let last = null;
  function open() {
    last = document.activeElement;
    lbF.innerHTML = `<iframe src="https://www.youtube.com/embed/${CONFIG.featuredVideo}?autoplay=1&rel=0"
      title="${CONFIG.featuredTitle}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
      allowfullscreen></iframe>`;
    $('#lbC').textContent = `${CONFIG.featuredTitle} — ${CONFIG.featuredEvent}`;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#lbX').focus();
  }
  function close() {
    lb.hidden = true; lbF.innerHTML = '';
    document.body.style.overflow = '';
    last?.focus();
  }
  $$('[data-play]').forEach(b => b.addEventListener('click', open));
  $('#lbX').addEventListener('click', close);
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) close(); });

  /* 한장 프로필 공유 — 휴대폰은 공유창, PC는 문구 복사 */
  const siteUrl = location.origin + location.pathname.replace(/index\.html$/, '');
  const shareText =
    `[가수 마리 프로필]\n무대를 흔드는 라켄롤 보컬\n대표곡 「사랑의 라켄롤」\n\n` +
    `섭외 문의 ${CONFIG.phone}\n${siteUrl}`;

  $('#shareSheet').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const res = await fetch('assets/profile-sheet.jpg');
      if (res.ok) {
        const file = new File([await res.blob()], '가수마리-프로필.jpg', { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '가수 마리 프로필', text: shareText });
          btn.disabled = false; return;
        }
      }
    } catch (err) {
      // 사용자가 공유창을 닫은 것이므로 폴백으로 내려가지 않는다
      if (err.name === 'AbortError') { btn.disabled = false; return; }
    }
    if (navigator.share) {
      try { await navigator.share({ title: '가수 마리 프로필', text: shareText, url: siteUrl }); btn.disabled = false; return; }
      catch (err) { if (err.name === 'AbortError') { btn.disabled = false; return; } }
    }
    try { await navigator.clipboard.writeText(shareText); toast('카톡에 붙여넣을 문구를 복사했습니다'); }
    catch { toast('아래 「이미지 저장」으로 받아서 보내주세요'); }
    window.open('assets/profile-sheet.jpg', '_blank', 'noopener');
    btn.disabled = false;
  });

  /* 스크롤 리빌 */
  const io = new IntersectionObserver((en) => {
    en.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* 네비 · 진행바 */
  const nav = $('#nav'), bar = $('#navBar'), totop = $('#totop');
  const links = $$('.links a');
  const secs = links.map(a => $('#' + a.dataset.sec)).filter(Boolean);
  let lastY = 0, tick = false;
  function onScroll() {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    nav.classList.toggle('hide', y > lastY && y > 380 && lb.hidden);
    lastY = y;
    totop.classList.toggle('on', y > 640);
    let cur = null;
    secs.forEach(s => { if (s.getBoundingClientRect().top <= 130) cur = s.id; });
    links.forEach(a => a.classList.toggle('on', a.dataset.sec === cur));
    tick = false;
  }
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  totop.addEventListener('click', () => scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));

  /* 모바일 메뉴 */
  const burger = $('#burger'), linkBox = $('#links');
  burger.addEventListener('click', () => {
    const o = linkBox.classList.toggle('open');
    burger.classList.toggle('on', o);
    burger.setAttribute('aria-expanded', o);
  });
  links.forEach(a => a.addEventListener('click', () => {
    linkBox.classList.remove('open'); burger.classList.remove('on');
    burger.setAttribute('aria-expanded', 'false');
  }));
})();
