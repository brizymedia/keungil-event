import random, math
random.seed(7)
W=H=2000
out=[]
A=out.append

MAPLE="M0,-50 L8,-30 L20,-36 L16,-14 L34,-22 L30,-10 L46,-6 L28,8 L32,18 L10,14 L4,30 L2,30 L2,52 L-2,52 L-2,30 L-4,30 L-10,14 L-32,18 L-28,8 L-46,-6 L-30,-10 L-34,-22 L-16,-14 L-20,-36 L-8,-30 Z"
def maple(x,y,s,r,c):
    A(f'<path d="{MAPLE}" transform="translate({x},{y}) rotate({r}) scale({s})" fill="{c}" stroke="rgba(120,30,0,.25)" stroke-width="{1.5/s:.2f}"/>')
def ginkgo(x,y,s,r,c="#ffd21f"):
    A(f'<path d="M0,40 L0,8 C-30,0 -44,-26 -34,-40 C-20,-30 -8,-36 0,-30 C8,-36 20,-30 34,-40 C44,-26 30,0 0,8" transform="translate({x},{y}) rotate({r}) scale({s})" fill="{c}" stroke="#e0a000" stroke-width="{2/s:.2f}"/>')
def cosmos(x,y,s,c,c2):
    g=[f'<g transform="translate({x},{y}) scale({s})">']
    for i in range(8):
        a=i*45+random.uniform(-5,5)
        g.append(f'<path d="M0,0 C10,-8 14,-34 10,-46 L5,-41 L0,-48 L-5,-41 L-10,-46 C-14,-34 -10,-8 0,0Z" fill="{c}" stroke="{c2}" stroke-width="1.2" transform="rotate({a})"/>')
        g.append(f'<path d="M0,-6 L0,-36" stroke="{c2}" stroke-width="1" opacity=".5" transform="rotate({a})"/>')
    g.append('<circle r="9" fill="#ffcc1a" stroke="#e39b00" stroke-width="2"/>')
    for i in range(10):
        a=i*36; g.append(f'<circle cx="{6*math.cos(math.radians(a)):.1f}" cy="{6*math.sin(math.radians(a)):.1f}" r="1.8" fill="#d97a00"/>')
    g.append('</g>'); A(''.join(g))
def stem(x1,y1,x2,y2):
    cx=(x1+x2)/2+random.uniform(-30,30)
    A(f'<path d="M{x1},{y1} Q{cx},{(y1+y2)/2} {x2},{y2}" stroke="#5f9a3a" stroke-width="5" fill="none" stroke-linecap="round"/>')
    mx,my=(x1+x2)/2,(y1+y2)/2
    A(f'<path d="M{mx},{my} q{random.choice([-1,1])*28},-10 {random.choice([-1,1])*40},-34" stroke="#6aa842" stroke-width="3" fill="none"/>')
def round_tree(x,y,w,h,g1,g2,trunk=True):
    if trunk:
        A(f'<path d="M{x-9},{y} L{x-6},{y-h*0.55} L{x+6},{y-h*0.55} L{x+9},{y}Z" fill="#8a4b1f"/>')
        A(f'<path d="M{x},{y-h*0.4} L{x+w*0.22},{y-h*0.62} M{x},{y-h*0.45} L{x-w*0.2},{y-h*0.68}" stroke="#8a4b1f" stroke-width="7" stroke-linecap="round"/>')
    gid=f"t{len(out)}"
    A(f'<defs><radialGradient id="{gid}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="{g1}"/><stop offset="1" stop-color="{g2}"/></radialGradient></defs>')
    A(f'<ellipse cx="{x}" cy="{y-h*0.68}" rx="{w/2}" ry="{h*0.36}" fill="url(#{gid})" stroke="rgba(150,60,0,.35)" stroke-width="3"/>')
    for i in range(5):
        A(f'<ellipse cx="{x+random.uniform(-w*.25,w*.25):.0f}" cy="{y-h*0.68+random.uniform(-h*.2,h*.2):.0f}" rx="{w*.12:.0f}" ry="{w*.07:.0f}" fill="rgba(255,255,255,.18)" transform="rotate({random.uniform(-30,30):.0f} {x} {y-h*.68})"/>')
def leaf_tree(x,y,w,h,g1,g2):
    gid=f"l{len(out)}"
    A(f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{g1}"/><stop offset="1" stop-color="{g2}"/></linearGradient></defs>')
    A(f'<path d="M{x},{y-h} C{x+w*0.75},{y-h*0.65} {x+w*0.6},{y-h*0.18} {x},{y-h*0.12} C{x-w*0.6},{y-h*0.18} {x-w*0.75},{y-h*0.65} {x},{y-h}Z" fill="url(#{gid})" stroke="rgba(150,60,0,.4)" stroke-width="3"/>')
    A(f'<path d="M{x},{y} L{x},{y-h*0.85}" stroke="#8a4b1f" stroke-width="8" stroke-linecap="round"/>')
    for i in range(1,5):
        yy=y-h*0.2-i*h*0.13
        A(f'<path d="M{x},{yy} L{x+w*0.28},{yy-h*0.1} M{x},{yy} L{x-w*0.28},{yy-h*0.1}" stroke="#8a4b1f" stroke-width="4" stroke-linecap="round" opacity=".8"/>')
def cloud(x,y,s,o=1):
    A(f'<g transform="translate({x},{y}) scale({s})" opacity="{o}" fill="#fff"><ellipse cx="0" cy="0" rx="120" ry="40"/><circle cx="-50" cy="-20" r="45"/><circle cx="10" cy="-40" r="60"/><circle cx="70" cy="-15" r="42"/></g>')

# ---------- defs / sky ----------
A('''<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f9fe8"/><stop offset=".45" stop-color="#8fd0f7"/><stop offset=".8" stop-color="#e3f5ff"/><stop offset="1" stop-color="#fff8e6"/></linearGradient>
<linearGradient id="gY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffb9a"/><stop offset=".5" stop-color="#ffe23a"/><stop offset="1" stop-color="#ffb800"/></linearGradient>
<linearGradient id="gO" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset=".5" stop-color="#ffb21e"/><stop offset="1" stop-color="#ff7a00"/></linearGradient>
<linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe17a"/><stop offset="1" stop-color="#f5a623"/></linearGradient>
<linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#e8711c"/></linearGradient>
<linearGradient id="h3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8ec8c"/><stop offset="1" stop-color="#a9cf55"/></linearGradient>
<radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#5a2a00" flood-opacity=".35"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
</defs>
<rect width="2000" height="2000" fill="url(#sky)"/>
<circle cx="1000" cy="1050" r="700" fill="url(#sun)" opacity=".55"/>''')
# clouds
for (x,y,s,o) in [(260,180,1.3,.9),(1720,150,1.5,.9),(1000,90,1.1,.6),(420,880,1.6,.85),(1600,840,1.8,.85),(1000,1050,2.4,.6),(200,1150,1.4,.7),(1820,1180,1.3,.7),(700,1300,1.6,.55),(1350,1320,1.5,.55)]:
    cloud(x,y,s,o)

# hills
A('<path d="M0,1500 C300,1380 600,1430 900,1520 C1200,1610 1500,1400 2000,1460 L2000,2000 L0,2000Z" fill="url(#h3)"/>')
A('<path d="M0,1600 C250,1520 520,1560 760,1650 C1000,1740 1300,1560 1600,1590 C1800,1610 1900,1560 2000,1540 L2000,2000 L0,2000Z" fill="url(#h1)"/>')
A('<path d="M0,1760 C300,1690 600,1740 1000,1800 C1400,1860 1700,1720 2000,1700 L2000,2000 L0,2000Z" fill="url(#h2)"/>')

# side trees (left)
leaf_tree(150,1640,260,620,"#ffcc33","#f07b12")
round_tree(330,1560,250,520,"#ffb347","#e2561a")
round_tree(70,1420,200,420,"#ffe066","#f2a20c")
leaf_tree(470,1620,170,380,"#ffe27a","#f2a20c")
round_tree(600,1640,140,260,"#ff9f43","#d9480f")
# right
round_tree(1830,1600,280,600,"#ffcf40","#f08a00")
leaf_tree(1640,1640,230,540,"#ffb347","#e2561a")
round_tree(1960,1400,200,420,"#ff9f43","#cf3d0c")
leaf_tree(1500,1650,160,340,"#ffe27a","#ef8a10")
round_tree(1390,1680,130,240,"#ffd34d","#e8890c")

# ginkgo clusters top corners
for i in range(70):
    a=random.uniform(0,math.pi/2); r=random.uniform(0,300)
    ginkgo(2000-r*math.cos(a)+random.uniform(-20,20), r*math.sin(a)*0.8, random.uniform(.5,.9), random.uniform(0,360), random.choice(["#ffd21f","#ffe14d","#ffc400","#f7b500"]))
for i in range(55):
    a=random.uniform(0,math.pi/2); r=random.uniform(0,260)
    maple(r*math.cos(a), r*math.sin(a)*0.8, random.uniform(.5,.95), random.uniform(0,360), random.choice(["#ff6a13","#f04a0c","#ff9b1a","#e8350c","#ffb31a"]))

# cosmos field bottom left & right
for side in (0,1):
    for i in range(26):
        x = random.uniform(20,560) if side==0 else random.uniform(1440,1980)
        y = random.uniform(1560,1960)
        stem(x,2010,x+random.uniform(-20,20),y)
        cosmos(x,y,random.uniform(.9,1.6),*random.choice([("#ff8fbf","#e0558f"),("#ffc2dc","#e57aa8"),("#ffffff","#f0a5c4"),("#f05ba0","#c0306f"),("#ffd6e8","#e98ab3")]))
# small cosmos along bottom middle
for i in range(16):
    x=random.uniform(600,1400); y=random.uniform(1880,1990)
    stem(x,2010,x,y)
    cosmos(x,y,random.uniform(.6,.95),*random.choice([("#ff8fbf","#e0558f"),("#ffffff","#f0a5c4"),("#ffc2dc","#e57aa8")]))
# fallen leaves on ground
for i in range(40):
    x=random.uniform(0,2000); y=random.uniform(1780,1990)
    if 640<x<1360 and random.random()<.5: continue
    maple(x,y,random.uniform(.35,.6),random.uniform(0,360),random.choice(["#ff6a13","#ff9b1a","#e8350c","#ffb31a","#c8460c"]))

# floating leaves in sky (sparse, avoid text)
for (x,y,s,r,c) in [(210,560,.9,-20,"#ff6a13"),(1790,560,.9,25,"#ff9b1a"),(140,880,.7,40,"#e8350c"),(1860,900,.75,-35,"#ffb31a"),(330,1060,.55,10,"#ff9b1a"),(1700,1060,.6,60,"#ff6a13"),(560,1210,.45,-50,"#e8350c"),(1460,1230,.5,15,"#ffb31a")]:
    maple(x,y,s,r,c)
for (x,y,s,r) in [(1700,700,.7,30),(300,720,.6,-30),(1560,1100,.5,70),(450,1150,.45,10)]:
    ginkgo(x,y,s,r)
# sparkles
def star(x,y,s,c="#fff"):
    A(f'<path d="M0,-20 C3,-4 4,-3 20,0 C4,3 3,4 0,20 C-3,4 -4,3 -20,0 C-4,-3 -3,-4 0,-20Z" transform="translate({x},{y}) scale({s})" fill="{c}"/>')
for (x,y,s) in [(380,330,1.4),(1640,320,1.3),(160,700,1),(1860,720,1.1),(620,960,.9),(1390,980,1),(260,1300,.8),(1760,1330,.9)]:
    star(x,y,s,"#fffbe0")

# ---------- TEXT ----------
def title_line(y, parts, size, ls=0):
    # parts: list of (text, gradient)
    spans=''.join(f'<tspan fill="url(#{g})">{t}</tspan>' for t,g in parts)
    plain=''.join(t for t,g in parts)
    common=f'x="1000" y="{y}" text-anchor="middle" font-family="Jua" font-size="{size}" letter-spacing="{ls}"'
    A(f'<text {common} fill="#fff" stroke="#fff" stroke-width="{size*0.30:.0f}" stroke-linejoin="round" filter="url(#sh)">{plain}</text>')
    A(f'<text {common} fill="#5b2a0c" stroke="#5b2a0c" stroke-width="{size*0.14:.0f}" stroke-linejoin="round">{plain}</text>')
    A(f'<text {common} stroke="#fff6c9" stroke-width="3" stroke-linejoin="round" paint-order="stroke">{spans}</text>')
    # glossy highlight
    A(f'<text {common} fill="#fff" opacity=".0">{plain}</text>')

# subtitle


sub='x="1000" y="330" text-anchor="middle" font-family="Gaegu" font-weight="700" font-size="100" letter-spacing="-5"'
A(f'<text {sub} fill="#fff" stroke="#fff" stroke-width="22" stroke-linejoin="round">꿈과 웃음 가득한 우리들의 Special Stage!</text>')
A(f'<text {sub} fill="#a3159a" stroke="#7a0d73" stroke-width="2.5">꿈과 웃음 가득한 우리들의 <tspan fill="#d61f6b" stroke="#a3124f">Special Stage!</tspan></text>')

title_line(560, [("끼와 ","gY"),("열정의 ","gO"),("대폭발","gY")], 205, 4)
title_line(810, [("동면초등학교","gO"),(" 창자랑 ","gY"),("발표회","gO")], 172, 0)

maple(165,290,.85,-15,"#e8350c")
cosmos(1810,285,1.1,"#ff6fb0","#d23f83")
# info pill
A('<rect x="330" y="880" width="1340" height="104" rx="52" fill="#ffffff" fill-opacity=".88" stroke="#ff9b1a" stroke-width="6"/>')
A('<text x="1000" y="950" text-anchor="middle" font-family="Noto Sans KR" font-weight="800" font-size="56" fill="#3b2a1a">2026. 11. 25.(화) 9:30~ <tspan fill="#ff7a00">  |  </tspan>동면초등학교 체육관</text>')

# PHOTO ZONE badge bottom center
A('<g transform="translate(1000,1905)">')
A('<rect x="-330" y="-62" width="660" height="110" rx="55" fill="#ff7a00" stroke="#fff" stroke-width="8" filter="url(#sh)"/>')
A('<text x="0" y="22" text-anchor="middle" font-family="Jua" font-size="74" fill="#fff" letter-spacing="6">📸 PHOTO ZONE</text>')
A('</g>')
A('<text x="1000" y="1995" text-anchor="middle" font-family="Noto Sans KR" font-weight="700" font-size="30" fill="#6b3a12" opacity=".0"></text>')
# credit
A('<text x="1960" y="1030" text-anchor="end" font-family="Noto Sans KR" font-weight="700" font-size="0"></text>')
A('<text x="1000" y="1040" text-anchor="middle" font-family="Noto Sans KR" font-weight="700" font-size="34" fill="#2f5d86">학예회 주제 문구 공모 당선자  3학년 조담희</text>')

svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="2000mm" height="2000mm">'+''.join(out)+'</svg>'
html=f'''<!doctype html><html><head><meta charset="utf-8"><title>동면초 포토존</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Gaegu:wght@700&family=Noto+Sans+KR:wght@700;800&family=Noto+Color+Emoji&display=block" rel="stylesheet">
<style>@page{{size:2000mm 2000mm;margin:0}}html,body{{margin:0;padding:0}}svg{{display:block;width:100vw;height:100vh}}</style></head><body>{svg}</body></html>'''
open('/home/user/keungil-event/photozone-dongmyeon/photozone.html','w').write(html)
