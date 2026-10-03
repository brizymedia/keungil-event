# -*- coding: utf-8 -*-
"""
업무 문서함(office.html)에 「관리자 모드」 잠금 화면을 씌운다.

  - 암호는 페이지에 적지 않는다. 계약 서버(앱스 스크립트)의 대표 암호(스크립트 속성 BOX_PW)로 확인한다.
    → 서버에 {action:'boxList', pw} 를 보내 ok 가 오면 연다. 직원 암호(CREW_PW)로는 안 열린다.
  - 맞으면 그 기기에 기억한다(견적서 저장함 · 행사 일정과 같은 자리) → 저장함도 같은 암호로 자동 연결된다.
  - 계약 서버 주소가 비어 있으면(배포 전) 열 수 없다고 안내한다.

port_docs.py 가 office() 다음에 apply() 를 부른다. 이미 씌운 페이지에 다시 불러도 한 번만 들어간다.
이 파일은 고객사 레포마다 같은 내용으로 둔다(바로기획 tools/admin_gate.py 가 원본).
"""
import io, os, re


def apply(path, site_id, name, contract_url, colors):
    s = io.open(path, encoding='utf-8').read()
    s = re.sub(r'<!--GATE-->.*?<!--/GATE-->\n?', '', s, flags=re.S)
    s = s.replace('<body class="locked">', '<body>')
    C = colors
    css = f'''<!--GATE--><style>
body.locked>*:not(#gate){{display:none!important}}
#gate{{display:none}}
body.locked #gate{{display:grid;min-height:100vh;place-items:center;padding:24px}}
#gate .gbox{{width:100%;max-width:380px;background:{C['card']};border:1px solid {C['line']};border-radius:18px;padding:30px 26px;text-align:center}}
#gate .gic{{width:54px;height:54px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;background:{C['accent']};color:{C['ink']}}}
#gate .gic svg{{width:26px;height:26px}}
#gate h1{{font-size:1.35rem;margin:0}}
#gate p{{color:#aab2c3;font-size:.86rem;margin:.45rem 0 1.2rem}}
#gate input{{width:100%;box-sizing:border-box;background:rgba(0,0,0,.25);border:1px solid {C['line']};border-radius:10px;padding:.8rem .9rem;color:#fff;font:inherit;font-size:1rem;outline:none}}
#gate input:focus{{border-color:{C['accent']}}}
#gate button{{width:100%;margin-top:.7rem;border:0;border-radius:10px;padding:.85rem;background:{C['accent']};color:{C['ink']};font:inherit;font-weight:800;cursor:pointer}}
#gate button[disabled]{{opacity:.6;cursor:wait}}
#gate .gerr{{min-height:1.3em;color:#FF8A8A;font-size:.83rem;margin:.7rem 0 0}}
#gate .gfoot{{margin-top:1.1rem;font-size:.76rem;color:#7d879b}}
#gate a{{color:{C['accent2']}}}
.gate-out{{margin-left:.6rem;border:1px solid {C['line']};background:none;color:#c3c9d6;border-radius:999px;padding:.3rem .8rem;font:inherit;font-size:.75rem;cursor:pointer}}
</style><!--/GATE-->
'''
    gate = f'''<!--GATE--><div id="gate"><form class="gbox" id="gateForm" autocomplete="off">
  <div class="gic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
  <h1>관리자 모드</h1>
  <p>{name} 대표 전용 업무 문서함입니다.<br>대표 암호를 넣어 주세요.</p>
  <input type="password" id="gatePw" placeholder="대표 암호" autocomplete="current-password" aria-label="대표 암호">
  <button type="submit" id="gateGo">들어가기</button>
  <p class="gerr" id="gateErr" role="alert"></p>
  <p class="gfoot">암호를 잊으셨으면 큰길브리지 1533-7295 로 연락 주세요.<br><a href="index.html">← 홈페이지로</a></p>
</form></div><!--/GATE-->
'''
    js = f'''<!--GATE--><script>
(function(){{
  var 서버 = '{contract_url}';
  var 열쇠 = '{site_id}-quote-box-pw', 일정열쇠 = '{site_id}-sched-pw';
  var b = document.body, form = document.getElementById('gateForm'), pw = document.getElementById('gatePw'),
      go = document.getElementById('gateGo'), err = document.getElementById('gateErr');
  function 읽기(k){{ try {{ return localStorage.getItem(k) || ''; }} catch (e) {{ return ''; }} }}
  function 쓰기(k, v){{ try {{ if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); }} catch (e) {{}} }}
  function 열기(){{ b.classList.remove('locked'); try {{ sessionStorage.setItem('{site_id}-office', '1'); }} catch (e) {{}} }}
  function 잠그기(){{ 쓰기(열쇠, ''); try {{ sessionStorage.removeItem('{site_id}-office'); }} catch (e) {{}} b.classList.add('locked'); pw.value = ''; err.textContent = ''; pw.focus(); }}
  function 확인(v){{
    return fetch(서버, {{ method: 'POST', headers: {{ 'Content-Type': 'text/plain;charset=utf-8' }}, body: JSON.stringify({{ action: 'boxList', pw: v }}) }})
      .then(function (r) {{ return r.json(); }}).then(function (j) {{ if (!j || j.ok !== true) throw new Error((j && j.error) || '암호가 맞지 않습니다'); }});
  }}
  /* 잠그기 단추 — 머리글 오른쪽 */
  var top = document.querySelector('.top div');
  if (top) {{ var out = document.createElement('button'); out.type = 'button'; out.className = 'gate-out'; out.textContent = '잠그기'; out.onclick = 잠그기; top.appendChild(out); }}
  if (!서버) {{ go.disabled = true; pw.disabled = true; err.textContent = '아직 서버 연결 전입니다 — 큰길브리지가 연결하면 열립니다.'; return; }}
  form.addEventListener('submit', function (e) {{
    e.preventDefault();
    var v = pw.value.trim(); if (!v) {{ err.textContent = '암호를 넣어 주세요.'; pw.focus(); return; }}
    go.disabled = true; go.textContent = '확인 중…'; err.textContent = '';
    확인(v).then(function () {{ 쓰기(열쇠, v); if (!읽기(일정열쇠)) 쓰기(일정열쇠, v); 열기(); }})
      .catch(function (x) {{ err.textContent = /맞지|암호/.test(x.message) ? '암호가 맞지 않습니다.' : '연결이 안 됩니다 — 잠시 뒤 다시 해 주세요.'; pw.select(); }})
      .then(function () {{ go.disabled = false; go.textContent = '들어가기'; }});
  }});
  /* 이 기기에 기억된 암호가 있으면 조용히 확인하고 연다 */
  var 저장 = 읽기(열쇠);
  if (저장) {{
    var 이번 = false; try {{ 이번 = sessionStorage.getItem('{site_id}-office') === '1'; }} catch (e) {{}}
    if (이번) 열기();
    확인(저장).then(열기).catch(function () {{ 잠그기(); }});
  }} else pw.focus();
}})();
</script><!--/GATE-->
'''
    s = s.replace('</head>', css + '</head>', 1)
    s = re.sub(r'<body([^>]*)>', lambda m: '<body class="locked"' + m.group(1).replace(' class="locked"', '') + '>\n' + gate, s, count=1)
    s = s.replace('</body>', js + '</body>', 1)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print(os.path.basename(path), '관리자 모드 잠금:', '서버 연결됨' if contract_url else '서버 배포 전(열 수 없음)')
