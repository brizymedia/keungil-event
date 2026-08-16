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

  /* 사진 갤러리 — 파일이 없는 항목은 조용히 숨긴다.
     assets/ 에 사진을 넣기만 하면 자동으로 나타나므로, 나중에 혼자 추가하기 쉽다. */
  const gal = $('#gal');
  gal.innerHTML = GALLERY.map((g, i) => `
    <button class="ph reveal" style="--d:${Math.min(i, 6) * 60}ms" data-img="${g.src}" data-cap="${g.cap}"
            hidden aria-label="${g.cap} 사진 크게 보기">
      <img src="${g.src}" alt="가수 마리 — ${g.cap}" loading="lazy"
           style="object-position:${g.pos || '50% 22%'}">
      <span>${g.cap}</span>
    </button>`).join('');
  $$('.ph', gal).forEach(b => {
    const img = b.querySelector('img');
    const show = () => { b.hidden = false; };
    if (img.complete) { img.naturalWidth ? show() : b.remove(); }
    else { img.addEventListener('load', show); img.addEventListener('error', () => b.remove()); }
  });
  gal.addEventListener('click', (e) => {
    const b = e.target.closest('.ph');
    if (b) openImg(b.dataset.img, b.dataset.cap);
  });

  /* 라이트박스 — 영상과 사진을 모두 띄운다 */
  const lb = $('#lb'), lbF = $('#lbF');
  let last = null;
  function openImg(src, cap) {
    last = document.activeElement;
    lbF.innerHTML = `<img src="${src}" alt="가수 마리 — ${cap}" class="lb__img">`;
    $('#lbC').textContent = cap;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#lbX').focus();
  }
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

  /* ── 후원: 리워드 · 계좌 ── */
  const RW_ICONS = {
    disc: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/><path d="M12 3a9 9 0 016.4 2.7"/></svg>',
    film: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.4"/><path d="M7 4.5v15M17 4.5v15M2.5 12h19"/></svg>',
  };
  $('#rewards').innerHTML = REWARDS.map((r, i) => `
    <article class="rw reveal" style="--d:${i * 90}ms">
      <div class="rw__top">
        <span class="rw__ico">${RW_ICONS[r.icon] || ''}</span>
        <div><span class="rw__tag">${r.tag}</span><h3 class="rw__title">${r.title}</h3></div>
      </div>
      <p class="rw__desc">${r.desc}</p>
      <p class="rw__meta">${r.meta}</p>
    </article>`).join('');

  const BANK = CONFIG.bank;
  $('#acc').innerHTML = `
    <div><dt>은행</dt><dd>${BANK.name}</dd></div>
    <div><dt>계좌번호</dt><dd class="num">${BANK.number}</dd></div>
    <div><dt>예금주</dt><dd>${BANK.holder}</dd></div>`;
  $('#copyAcc').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${BANK.name} ${BANK.number} (예금주 ${BANK.holder})`);
      toast('계좌번호를 복사했습니다');
    } catch { toast(`${BANK.name} ${BANK.number}`); }
  });

  /* ── 후원하기 버튼 → 펼치기 ── */
  const supBtn = $('#openSup'), supPanel = $('#supPanel'), supTxt = $('#openSupTxt');
  function openSup() {
    if (!supPanel.hidden) return;
    supPanel.hidden = false;
    // 숨겨진 동안에는 IntersectionObserver 가 발화하지 않으므로 직접 켜준다
    $$('.reveal', supPanel).forEach(el => el.classList.add('in'));
    supPanel.classList.add('open');
    supBtn.classList.add('open');
    supBtn.setAttribute('aria-expanded', 'true');
    supTxt.textContent = '접기';
    requestAnimationFrame(() => supPanel.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }));
  }
  function closeSup() {
    supPanel.classList.remove('open');
    supPanel.hidden = true;
    supBtn.classList.remove('open');
    supBtn.setAttribute('aria-expanded', 'false');
    supTxt.textContent = '후원하기';
    supBtn.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
  }
  supBtn.addEventListener('click', () => (supPanel.hidden ? openSup() : closeSup()));
  if (location.hash === '#support-form') openSup();

  /* ── 신청서 ── */
  const F = { name: $('#fName'), phone: $('#fPhone'), email: $('#fEmail'),
              amount: $('#fAmount'), date: $('#fDate'), msg: $('#fMsg'), agree: $('#fAgree') };
  const val = (el) => el.value.trim();

  function bad(el, msg) {
    el.classList.add('bad');
    el.focus();
    el.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
    toast(msg);
    return null;
  }

  // 문자 본문이 너무 길면 잘리거나 안 열린다. 필수 항목은 남기고 응원글만 줄인다.
  function collect(limit = 700) {
    if (!val(F.name)) return bad(F.name, '성함을 입력해주세요');
    F.name.classList.remove('bad');
    if (val(F.phone).replace(/[^0-9]/g, '').length < 9) return bad(F.phone, '연락처를 정확히 입력해주세요');
    F.phone.classList.remove('bad');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(F.email))) return bad(F.email, '이메일을 정확히 입력해주세요');
    F.email.classList.remove('bad');
    const box = F.agree.closest('.agree');
    if (!F.agree.checked) { box.classList.add('bad'); F.agree.focus(); toast('개인정보 제공에 동의해주세요'); return null; }
    box.classList.remove('bad');

    let core = `[가수 마리 후원 신청]\n성함: ${val(F.name)}\n연락처: ${val(F.phone)}\n이메일: ${val(F.email)}`;
    if (val(F.amount)) core += `\n후원 금액: ${val(F.amount)}`;
    if (val(F.date)) core += `\n입금일: ${val(F.date)}`;
    const tail = '\n\n※ 고음질 음원과 미공개 영상을 위 이메일로 받겠습니다.';
    if (val(F.msg)) {
      const room = limit - core.length - tail.length - 12;
      if (room > 20) {
        const m = val(F.msg);
        core += `\n응원 한마디: ${m.slice(0, room)}${m.length > room ? '…' : ''}`;
      }
    }
    return core + tail;
  }

  $('#sendSms').addEventListener('click', () => {
    const body = collect();
    if (!body) return;
    // iPadOS 13+ 는 UA에 iPad를 안 쓰고 Mac인 척하므로 터치 포인트로 함께 판별한다
    const apple = /iP(hone|od|ad)/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    location.href = `sms:${CONFIG.phone.replace(/[^0-9+]/g, '')}${apple ? '&' : '?'}body=${encodeURIComponent(body)}`;
  });

  $('#sendKakao').addEventListener('click', async () => {
    const body = collect();
    if (!body) return;
    if (navigator.share) {
      try { await navigator.share({ title: '가수 마리 후원 신청', text: body }); return; }
      catch (err) { if (err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(body); toast(`내용을 복사했습니다 · 카톡으로 ${CONFIG.phone} 에 보내주세요`); }
    catch { toast('복사에 실패했습니다'); }
  });

  $('#copyForm').addEventListener('click', async () => {
    const body = collect();
    if (!body) return;
    try { await navigator.clipboard.writeText(body); toast('신청 내용을 복사했습니다'); }
    catch { toast('복사에 실패했습니다'); }
  });

  [F.name, F.phone, F.email].forEach(el =>
    el.addEventListener('input', () => el.classList.remove('bad')));
  F.agree.addEventListener('change', () =>
    F.agree.closest('.agree').classList.toggle('bad', !F.agree.checked));

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
