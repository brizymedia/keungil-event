/* ============================================================
   지수양 공식 홍보 사이트 — 인터랙션
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ytSearch = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent('지수양 ' + q);
  const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  /* ── 링크 · 텍스트 주입 ─────────────────────────── */
  ['ytChannel', 'ytChannel2', 'ytChannel3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = CONFIG.youtube;
  });
  $('#year').textContent = new Date().getFullYear();

  const phoneEl = $('#bookPhone');
  phoneEl.textContent = CONFIG.phone;
  phoneEl.href = 'tel:' + CONFIG.phone.replace(/[^0-9+]/g, '');

  $('#copyPhone').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(CONFIG.phone);
      btn.textContent = '복사됨 ✓';
      toast('전화번호를 복사했습니다');
    } catch { btn.textContent = CONFIG.phone; }
    setTimeout(() => (btn.textContent = '번호 복사'), 1800);
  });

  /* ── 프로필 사진: assets/profile.jpg 가 있으면 교체 ── */
  (function () {
    const probe = new Image();
    probe.onload = () => {
      $('#profileImg').src = 'assets/profile.jpg';
      $('#profileFrame').classList.remove('is-fallback');
    };
    probe.src = 'assets/profile.jpg';
  })();

  /* ── 토스트 ─────────────────────────────────────── */
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  /* ── 원페이지 프로필 공유 (카톡 등) ──────────────── */
  const siteUrl = location.origin + location.pathname.replace(/index\.html$/, '');
  const shareText =
    `[가수 지수양 프로필]\n` +
    `카리스마 넘치는 창법의 트로트 여왕\n` +
    `대표곡 「사랑을 하는걸까」 (2025 정규 1집)\n\n` +
    `섭외 문의 ${CONFIG.phone}\n` +
    `${siteUrl}`;

  $('#shareSheet').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;

    // 1순위 — 프로필 이미지를 그대로 공유 (휴대폰: 카톡·문자 선택창)
    try {
      const res = await fetch('assets/profile-sheet.jpg');
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], '지수양-프로필.jpg', { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '가수 지수양 프로필', text: shareText });
          btn.disabled = false;
          return;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') { btn.disabled = false; return; }
    }

    // 2순위 — 링크만 공유
    if (navigator.share) {
      try {
        await navigator.share({ title: '가수 지수양 프로필', text: shareText, url: siteUrl });
        btn.disabled = false;
        return;
      } catch (err) {
        if (err.name === 'AbortError') { btn.disabled = false; return; }
      }
    }

    // 3순위 — PC: 문구 복사 + 이미지 새 창
    try {
      await navigator.clipboard.writeText(shareText);
      toast('카톡에 붙여넣을 문구를 복사했습니다');
    } catch {
      toast('아래 「이미지 저장」으로 받아서 보내주세요');
    }
    window.open('assets/profile-sheet.jpg', '_blank', 'noopener');
    btn.disabled = false;
  });

  /* ── 마퀴 ───────────────────────────────────────── */
  const mqWords = [
    '사랑을 하는걸까', '우연한 만남', '깍쟁이 내사랑', '달아 달아',
    '밤차', '나불도 연가', '마량에 가고싶다', '천년지기', '빈손', '지나야',
  ];
  const mqHtml = mqWords.map(w => `<span>${w}</span>`).join('');
  $('#marquee').innerHTML = mqHtml + mqHtml;

  /* ── 프로필 팩트 ───────────────────────────────── */
  const FACTS = [
    ['활동명', '지수양 (JI SUYANG)'],
    ['장르', '성인가요 · 트로트'],
    ['데뷔', '2018년 「달아 달아」'],
    ['정규 1집', '2025.09.09 「사랑을 하는걸까」'],
    ['활동 무대', '전국 축제 · 방송 · 노래교실'],
    ['거점', '전남 고흥'],
  ];
  $('#facts').innerHTML = FACTS.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  /* ── 대표곡 카드 ───────────────────────────────── */
  $('#titles').innerHTML = TITLES.map((t, i) => `
    <a class="tcard reveal" data-acc="${t.accent}" style="--d:${i * 90}ms"
       href="${ytSearch(t.title)}" target="_blank" rel="noopener">
      <div class="tcard__top">
        <span class="tcard__year">${t.year}</span>
        ${t.badge ? `<span class="tcard__badge">${t.badge}</span>` : ''}
      </div>
      <h3 class="tcard__title">${t.title}</h3>
      <p class="tcard__type">${t.type}</p>
      <p class="tcard__desc">${t.desc}</p>
      <p class="tcard__meta"><span>${t.meta}</span><span class="tcard__go">듣기 →</span></p>
    </a>`).join('');

  // 카드 위 커서 스포트라이트
  $$('.tcard').forEach(card => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });

  /* ── 수록곡 탐색기 ─────────────────────────────── */
  const tracksEl = $('#tracks');
  function renderTracks(q = '') {
    const kw = q.trim().toLowerCase();
    const html = TRACKS.map((t, i) => ({ t, i }))
      .filter(({ t }) => !kw || t.toLowerCase().includes(kw))
      .map(({ t, i }) => `
        <li class="${HOT_TRACKS.includes(t) ? 'is-hot' : ''} ${i === 0 ? 'is-title' : ''}" data-track="${t}">
          <button type="button">
            <span class="n">${String(i + 1).padStart(2, '0')}</span>
            <span class="t">${t}</span>
          </button>
        </li>`).join('');
    tracksEl.innerHTML = html || '';
    $('#trackNote').textContent = html
      ? '곡을 누르면 유튜브에서 해당 곡 무대를 찾아 드립니다.'
      : `「${q}」와(과) 일치하는 수록곡이 없습니다.`;
  }
  renderTracks();

  $('#trackSearch').addEventListener('input', (e) => renderTracks(e.target.value));

  tracksEl.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-track]');
    if (li) window.open(ytSearch(li.dataset.track), '_blank', 'noopener');
  });

  $('#randomTrack').addEventListener('click', () => {
    $('#trackSearch').value = '';
    renderTracks();
    const items = $$('#tracks li');
    const pick = items[Math.floor(Math.random() * items.length)];
    if (!pick) return;
    pick.classList.remove('is-flash');
    void pick.offsetWidth;
    pick.classList.add('is-flash');
    pick.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
    setTimeout(() => window.open(ytSearch(pick.dataset.track), '_blank', 'noopener'), 420);
  });

  /* ── 무대 영상 갤러리 ──────────────────────────── */
  const CATS = ['전체', ...new Set(VIDEOS.map(v => v.cat))];
  let curCat = '전체';

  $('#chips').innerHTML = CATS.map((c, i) => {
    const n = c === '전체' ? VIDEOS.length : VIDEOS.filter(v => v.cat === c).length;
    return `<button class="chip${i === 0 ? ' is-on' : ''}" data-cat="${c}">${c} <span style="opacity:.6">${n}</span></button>`;
  }).join('');

  const gridEl = $('#videoGrid');
  function renderVideos() {
    const list = VIDEOS.filter(v => curCat === '전체' || v.cat === curCat);
    gridEl.innerHTML = list.map((v, i) => `
      <article class="vcard" style="animation-delay:${Math.min(i, 12) * 45}ms"
               data-id="${v.id}" data-song="${v.song}" data-event="${v.event} · ${v.date}">
        <div class="vcard__thumb" style="--thumb:url(${thumb(v.id)})">
          <img src="${thumb(v.id)}" alt="${v.song} — ${v.event}" loading="lazy">
          <span class="vcard__cat">${v.cat}</span>
          <span class="vcard__play"><i><svg viewBox="0 0 24 24" width="15" height="15"><path d="M6 4l14 8-14 8z"/></svg></i></span>
        </div>
        <div class="vcard__body">
          <h3 class="vcard__song">${v.song}</h3>
          <p class="vcard__ev">${v.event}</p>
          <span class="vcard__date">${v.date}</span>
        </div>
      </article>`).join('');
    $('#gridEmpty').hidden = list.length > 0;
  }
  renderVideos();

  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    $$('.chip').forEach(c => c.classList.toggle('is-on', c === b));
    curCat = b.dataset.cat;
    renderVideos();
  });

  /* ── 라이트박스 ────────────────────────────────── */
  const lb = $('#lb'), lbFrame = $('#lbFrame');
  let lastFocus = null;

  function openLB(id, song, event) {
    lastFocus = document.activeElement;
    lbFrame.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0"
      title="${song}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
      allowfullscreen></iframe>`;
    $('#lbTitle').textContent = song;
    $('#lbEvent').textContent = event;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#lbClose').focus();
  }
  function closeLB() {
    lb.hidden = true;
    lbFrame.innerHTML = '';
    document.body.style.overflow = '';
    lastFocus?.focus();
  }

  gridEl.addEventListener('click', (e) => {
    const c = e.target.closest('.vcard');
    if (c) openLB(c.dataset.id, c.dataset.song, c.dataset.event);
  });
  $$('[data-play]').forEach(b => b.addEventListener('click', () =>
    openLB(b.dataset.play, b.dataset.title, b.dataset.event)));
  $('#lbClose').addEventListener('click', closeLB);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLB(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) closeLB(); });

  /* ── 경력 타임라인 ─────────────────────────────── */
  $('#timeline').innerHTML = CAREER.map((g, i) => `
    <div class="tl reveal" style="--d:${i * 70}ms">
      <div class="tl__y">${g.year}</div>
      <ul class="tl__list">
        ${g.items.map(it => `<li><span class="tl__t">${it.t}</span>${it.d ? `<span class="tl__d">${it.d}</span>` : ''}</li>`).join('')}
      </ul>
    </div>`).join('');

  $('#awards').innerHTML = AWARDS.map(a =>
    `<li><span class="y">${a.y || '—'}</span><span class="t">${a.t}</span></li>`).join('');

  $('#media').innerHTML = MEDIA.map(m =>
    `<div><dt>${m.k}</dt><dd>${m.v}</dd></div>`).join('');

  /* ── 후원: 리워드 · 계좌 ───────────────────────── */
  const RW_ICONS = {
    album: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/><path d="M12 3a9 9 0 016.4 2.7"/></svg>',
    film:  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.4"/><path d="M7 4.5v15M17 4.5v15M2.5 12h19"/></svg>',
  };
  $('#rewards').innerHTML = REWARDS.map((r, i) => `
    <article class="rw reveal" style="--d:${i * 100}ms">
      <div class="rw__top">
        <span class="rw__ico">${RW_ICONS[r.icon] || ''}</span>
        <div>
          <span class="rw__tag">${r.tag}</span>
          <h3 class="rw__title">${r.title}</h3>
        </div>
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

  /* ── 후원 신청서 ───────────────────────────────── */
  const F = {
    name: $('#fName'), phone: $('#fPhone'), email: $('#fEmail'),
    amount: $('#fAmount'), date: $('#fDate'), msg: $('#fMsg'), agree: $('#fAgree'),
  };

  function markBad(el, bad) {
    el.classList.toggle('is-bad', bad);
    if (bad) { el.focus(); el.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }); }
  }

  function collect() {
    const v = (el) => el.value.trim();

    if (!v(F.name)) { markBad(F.name, true); toast('성함을 입력해주세요'); return null; }
    markBad(F.name, false);

    if (v(F.phone).replace(/[^0-9]/g, '').length < 9) {
      markBad(F.phone, true); toast('연락처를 정확히 입력해주세요'); return null;
    }
    markBad(F.phone, false);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v(F.email))) {
      markBad(F.email, true); toast('이메일을 정확히 입력해주세요'); return null;
    }
    markBad(F.email, false);

    const agreeBox = F.agree.closest('.agree');
    if (!F.agree.checked) {
      agreeBox.classList.add('is-bad');
      toast('개인정보 제공에 동의해주세요');
      F.agree.focus();
      return null;
    }
    agreeBox.classList.remove('is-bad');

    let t = `[가수 지수양 후원 신청]\n`;
    t += `성함: ${v(F.name)}\n`;
    t += `연락처: ${v(F.phone)}\n`;
    t += `이메일: ${v(F.email)}\n`;
    if (v(F.amount)) t += `후원 금액: ${v(F.amount)}\n`;
    if (v(F.date))   t += `입금일: ${v(F.date)}\n`;
    if (v(F.msg))    t += `응원 한마디: ${v(F.msg)}\n`;
    t += `\n※ 고음질 앨범과 미공개 영상을 위 이메일로 받겠습니다.`;
    return t;
  }

  // 문자 (iOS는 &body, 그 외는 ?body)
  $('#sendSms').addEventListener('click', () => {
    const body = collect();
    if (!body) return;
    const num = CONFIG.phone.replace(/[^0-9+]/g, '');
    const sep = /iP(hone|ad|od)|Mac/.test(navigator.userAgent) ? '&' : '?';
    location.href = `sms:${num}${sep}body=${encodeURIComponent(body)}`;
  });

  // 카톡 등 공유
  $('#sendKakao').addEventListener('click', async () => {
    const body = collect();
    if (!body) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: '가수 지수양 후원 신청', text: body });
        return;
      } catch (err) { if (err.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(body);
      toast(`신청 내용을 복사했습니다 · 카톡으로 ${CONFIG.phone} 에 보내주세요`);
    } catch { toast('신청 내용 복사에 실패했습니다'); }
  });

  // 복사
  $('#copyForm').addEventListener('click', async () => {
    const body = collect();
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      toast('신청 내용을 복사했습니다');
    } catch { toast('복사에 실패했습니다'); }
  });

  // 입력하면 오류 표시 해제
  [F.name, F.phone, F.email].forEach(el =>
    el.addEventListener('input', () => el.classList.remove('is-bad')));
  F.agree.addEventListener('change', () =>
    F.agree.closest('.agree').classList.toggle('is-bad', !F.agree.checked));

  /* ── 스크롤 리빌 ───────────────────────────────── */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('is-in');
        if (en.target.classList.contains('tl')) en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, .tl').forEach(el => io.observe(el));

  /* ── 숫자 카운트업 ─────────────────────────────── */
  const cio = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, to = +el.dataset.to;
      cio.unobserve(el);
      if (REDUCED) { el.textContent = to; return; }
      const dur = 1400, t0 = performance.now();
      const step = (now) => {
        const p = Math.min((now - t0) / dur, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  $$('.count').forEach(el => cio.observe(el));

  /* ── 네비 · 진행바 · 패럴랙스 ─────────────────── */
  const nav = $('#nav'), bar = $('#navProgress'), heroImg = $('#heroImg'), totop = $('#totop');
  const links = $$('.nav__links a');
  const secs = links.map(a => $('#' + a.dataset.sec)).filter(Boolean);
  let lastY = 0, ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';

    nav.classList.toggle('is-hidden', y > lastY && y > 400 && lb.hidden);
    lastY = y;

    totop.classList.toggle('is-on', y > 700);

    if (heroImg && y < innerHeight * 1.2 && !REDUCED) {
      heroImg.style.transform = `scale(1.12) translateY(${y * 0.16}px)`;
    }

    let active = null;
    secs.forEach(s => { if (s.getBoundingClientRect().top <= 140) active = s.id; });
    links.forEach(a => a.classList.toggle('is-active', a.dataset.sec === active));
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  totop.addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));

  /* ── 모바일 메뉴 ───────────────────────────────── */
  const burger = $('#burger'), navLinks = $('#navLinks');
  burger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
  });
  links.forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }));

  /* ── 커서 글로우 ───────────────────────────────── */
  const glow = $('#cursorGlow');
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    let gx = 0, gy = 0, cx = 0, cy = 0;
    addEventListener('pointermove', (e) => { gx = e.clientX; gy = e.clientY; });
    (function loop() {
      cx += (gx - cx) * 0.12; cy += (gy - cy) * 0.12;
      glow.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ── 히어로 캔버스: 불꽃 + 금가루 ──────────────── */
  const cv = $('#fx');
  if (cv && !REDUCED) {
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = Math.min(devicePixelRatio || 1, 2);
    const sparks = [], dust = [];
    const GOLD = ['#fff3c9', '#f0cd77', '#c9992f'];
    const NEON = ['#ff2e93', '#35dcff', '#fff3c9'];

    function size() {
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    addEventListener('resize', size);

    for (let i = 0; i < 46; i++) {
      dust.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.5 + 0.4,
        vy: -(Math.random() * 0.28 + 0.06),
        vx: (Math.random() - 0.5) * 0.16,
        a: Math.random() * 0.5 + 0.15,
        p: Math.random() * Math.PI * 2,
      });
    }

    function burst(x, y) {
      const n = 28 + Math.floor(Math.random() * 20);
      const pal = Math.random() > 0.45 ? GOLD : NEON;
      const col = pal[Math.floor(Math.random() * pal.length)];
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const sp = Math.random() * 2.6 + 0.9;
        sparks.push({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          life: 1, decay: Math.random() * 0.012 + 0.008, col,
          r: Math.random() * 1.6 + 0.7,
        });
      }
    }

    let next = 900;
    let raf, running = true;

    function tick(dt) {
      ctx.clearRect(0, 0, W, H);

      // 금가루
      ctx.globalCompositeOperation = 'lighter';
      dust.forEach(d => {
        d.p += 0.015;
        d.y += d.vy; d.x += d.vx + Math.sin(d.p) * 0.18;
        if (d.y < -6) { d.y = H + 6; d.x = Math.random() * W; }
        ctx.beginPath();
        ctx.fillStyle = `rgba(240,205,119,${d.a})`;
        ctx.arc(d.x, d.y, d.r, 0, 7);
        ctx.fill();
      });

      // 불꽃
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy;
        s.vy += 0.022; s.vx *= 0.988; s.vy *= 0.988;
        s.life -= s.decay;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(s.life, 0) * 0.85;
        ctx.fillStyle = s.col;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * s.life, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      next -= dt;
      if (next <= 0 && sparks.length < 420) {
        burst(W * (0.12 + Math.random() * 0.76), H * (0.08 + Math.random() * 0.38));
        next = 1100 + Math.random() * 1800;
      }
    }

    let prev = performance.now();
    (function loop(now) {
      const dt = Math.min(now - prev, 50); prev = now;
      if (running) tick(dt);
      raf = requestAnimationFrame(loop);
    })(prev);

    // 화면 밖으로 나가면 정지
    new IntersectionObserver(([e]) => { running = e.isIntersecting; }, { threshold: 0 })
      .observe(cv);

    // 클릭하면 그 자리에서 폭죽
    $('.hero').addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      burst(e.clientX - r.left, e.clientY - r.top);
    });
  }
})();
