# -*- coding: utf-8 -*-
"""
큰길이벤트기획 · 3D 무대 시안 → 블렌더 고화질 렌더

같은 시안 파일(stage3d 웹에서 「시안 파일 (JSON)」로 저장한 것)을 읽어
블렌더 안에 무대·트러스·LED·조명·음향·객석·텐트를 세우고 렌더한다.
물체는 bpy.ops 를 쓰지 않고 메시 데이터로 직접 만들며(빠르다), 같은 부품은 메시를 공유한다.

쓰는 법 (셋 중 아무거나):

  1) 블렌더 없이 명령줄로 (블렌더가 깔려 있으면):
     blender -b -P stage_gen.py -- 시안.json 결과.png [--blend 결과.blend] [--samples 64] [--size 1920x1080] [--cam audience|front|bird|side|stage]

  2) 블렌더 MCP(ahujasid/blender-mcp) 로 클로드가 직접:
     execute_blender_code 에  exec(open(r'경로/stage_gen.py', encoding='utf-8').read()); build(spec)  를 넣는다.
     spec 은 dict (JSON 을 그대로).

  3) 클라우드 블렌더(Higgsfield 3D Jutsu · scene_builder_3d_run_python):
     이 파일 내용을 code 로 보내고 마지막에  build(spec, render_path=target.path, clear=False)  를 붙인다.

시안 JSON 의 필드 (웹과 동일):
  type, title, people, io('out'|'in'), night, stage('d1'|'d6'|'d7'|'d8'|'none'), sh(높이 m),
  backdrop, led(''|'c1'|'c2'|'c3'|'c4'), color('#RRGGBB'), podium, fence, truss, moving(대),
  sound(''|'a1'|'a2'|'a3'), fog, spark, chairs(개), tentkind('d3'|'d10'|'d11'), tents(동), photo, gen
"""
import bpy, json, math, sys, os
from mathutils import Vector, Matrix

STAGE = {'d1': (7, 5), 'd6': (10, 6.6), 'd7': (12, 8), 'd8': (15, 10)}
LED   = {'c1': (4.43, 2.49), 'c2': (6.64, 3.74), 'c3': (8.86, 4.98), 'c4': (4, 3)}
TENT  = {'d3': (3, 3), 'd10': (3, 6), 'd11': (6, 6)}
TYPE_NAME = {'festival': '지역 축제', 'ceremony': '기념식 · 준공식', 'sports': '체육대회', 'conference': '컨퍼런스 · 세미나',
             'award': '시상식 · 이취임식', 'concert': '콘서트 · 공연', 'corporate': '기업 워크숍 · 송년회', 'expo': '박람회 · 전시', 'etc': '기타 행사'}

# ── 재료 ──────────────────────────────────────────────────────────────
_mats = {}
def mat(name, rgb, rough=0.6, metal=0.0, emit=None, emit_str=0.0, alpha=None):
    key = (name, rgb, rough, metal, emit, emit_str, alpha)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit is not None:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = emit_str
    if alpha is not None:
        p.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'          # 4.2+
        except Exception:
            try: m.blend_method = 'BLEND'                 # ≤4.1
            except Exception: pass
    _mats[key] = m
    return m

def hex_rgb(h):
    h = (h or '#F59E0B').lstrip('#')
    r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4   # sRGB → 리니어
    return (f(r), f(g), f(b))

BLACK = lambda: mat('무광검정', (0.02, 0.02, 0.022), 0.8)
DARK  = lambda: mat('짙은회색', (0.05, 0.05, 0.055), 0.9)
ALU   = lambda: mat('알루미늄', (0.6, 0.62, 0.65), 0.35, 0.85)
WHITE = lambda: mat('흰색', (0.85, 0.85, 0.85), 0.7)
BLUE  = lambda: mat('천막파랑', (0.02, 0.1, 0.55), 0.9)
CHAIR = lambda: mat('의자', (0.65, 0.65, 0.68), 0.6)
SKIN  = lambda: mat('사람', (0.08, 0.08, 0.09), 0.8)

# ── 메시 (ops 없이 직접 · 같은 부품은 공유) ─────────────────────────────
_col = None
_meshes = {}

def _ring(r, z, n):
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z) for i in range(n)]

def _g_cube():
    v = [(x, y, z) for x in (-.5, .5) for y in (-.5, .5) for z in (-.5, .5)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return v, f

def _g_plane():
    return [(-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0)], [(0, 1, 2, 3)]

def _g_cone(r1, r2, n):
    """z = -0.5 (r1) … +0.5 (r2). r2 == 0 이면 뾰족."""
    v = _ring(r1, -.5, n); f = []
    if r2 > 0:
        v += _ring(r2, .5, n)
        f += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        f.append(tuple(range(n - 1, -1, -1)))          # 아래 뚜껑 (법선 -Z)
        f.append(tuple(range(n, 2 * n)))               # 위 뚜껑 (법선 +Z)
    else:
        v.append((0, 0, .5)); top = n
        f += [(i, (i + 1) % n, top) for i in range(n)]
        f.append(tuple(range(n - 1, -1, -1)))
    return v, f

def _g_sphere(segs=10, rings=8):
    v = []; f = []
    for j in range(1, rings):
        ph = math.pi * j / rings
        v += _ring(math.sin(ph), math.cos(ph), segs)
    top = len(v); v.append((0, 0, 1)); bot = len(v); v.append((0, 0, -1))
    for j in range(rings - 2):
        for i in range(segs):
            a = j * segs + i; b = j * segs + (i + 1) % segs
            f.append((a, a + segs, b + segs, b))
    for i in range(segs):
        f.append((top, i, (i + 1) % segs)); f.append((bot, (rings - 2) * segs + (i + 1) % segs, (rings - 2) * segs + i))
    return v, f

def _mesh(key, builder, m, smooth=False):
    k = (key, m.name)
    if k in _meshes: return _meshes[k]
    v, f = builder()
    me = bpy.data.meshes.new(key); me.from_pydata(v, [], f); me.update()
    me.materials.append(m)
    if smooth:
        for p in me.polygons: p.use_smooth = True
    _meshes[k] = me
    return me

def _obj(name, data, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), parent=None):
    o = bpy.data.objects.new(name, data); o.location = loc; o.rotation_euler = rot; o.scale = scale
    if parent is not None: o.parent = parent
    _col.objects.link(o); return o

def box(name, w, d, h, x, y, z, m, rz=0.0):
    """블렌더 좌표: x 가로 · y 깊이(무대 뒤가 -y, 객석이 +y) · z 높이. 중심 (x,y,z)."""
    return _obj(name, _mesh('cube', _g_cube, m), (x, y, z), (0, 0, rz), (w, d, h))

def cylinder(name, r, h, x, y, z, m, rot=(0, 0, 0), verts=12, parent=None):
    return _obj(name, _mesh('cyl%d' % verts, lambda: _g_cone(1, 1, verts), m, smooth=verts >= 8), (x, y, z), rot, (r, r, h), parent)

def cone(name, r1, r2, h, x, y, z, m, rot=(0, 0, 0), verts=16):
    key = 'cone%d_%.3f_%.3f' % (verts, r1, r2)
    return _obj(name, _mesh(key, lambda: _g_cone(r1, r2, verts), m, smooth=verts >= 8), (x, y, z), rot, (1, 1, h))

def sphere(name, r, x, y, z, m):
    return _obj(name, _mesh('sphere', _g_sphere, m, smooth=True), (x, y, z), (0, 0, 0), (r, r, r))

FACE_AUDIENCE = (math.pi / 2, 0, math.pi)   # 세워서 객석(+Y) 쪽을 보게
def plane(name, w, h, x, y, z, m, rot=FACE_AUDIENCE):
    return _obj(name, _mesh('plane', _g_plane, m), (x, y, z), rot, (w, h, 1))

def truss(name, length, axis, x, y, z, size=0.3):
    """사각 트러스: 4 현재 + 0.5m 마다 살. axis: 'x' 가로 · 'y' 앞뒤 · 'z' 세로. 부모 빈 객체 하나에 묶는다."""
    g = _obj(name, None, (x, y, z))
    ALONG = {'x': (0, math.pi / 2, 0), 'y': (math.pi / 2, 0, 0), 'z': (0, 0, 0)}   # 원기둥 기본은 Z 방향
    idx = {'x': 0, 'y': 1, 'z': 2}
    u, v = {'x': ('y', 'z'), 'y': ('x', 'z'), 'z': ('x', 'y')}[axis]
    for a, b in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        loc = [0.0, 0.0, 0.0]; loc[idx[u]] = a * size / 2; loc[idx[v]] = b * size / 2
        cylinder(name + '_현재', 0.025, length, *loc, ALU(), rot=ALONG[axis], verts=6, parent=g)
    n = max(1, round(length / 0.5))
    for k in range(n):
        t = -length / 2 + (k + 0.5) * length / n
        for off_axis, along_axis in ((u, v), (v, u)):
            for sgn in (1, -1):
                loc = [0.0, 0.0, 0.0]; loc[idx[axis]] = t; loc[idx[off_axis]] = sgn * size / 2
                cylinder(name + '_살', 0.012, size, *loc, ALU(), rot=ALONG[along_axis], verts=5, parent=g)
    return g

_font_cache = [None, False]
def _korean_font():
    if _font_cache[1]: return _font_cache[0]
    _font_cache[1] = True
    for cand in (r'C:\Windows\Fonts\malgunbd.ttf', r'C:\Windows\Fonts\malgun.ttf', '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf',
                 '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', '/System/Library/Fonts/AppleSDGothicNeo.ttc',
                 '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(cand):
            try: _font_cache[0] = bpy.data.fonts.load(cand); break
            except Exception: pass
    return _font_cache[0]

def text_plane(name, text, w, h, x, y, z, base_rgb, fg_rgb, emit=0.0, sub=None, rz=0.0):
    """현수막 · LED · 포토존: 바탕판 + 3D 글자. rz 로 판과 글자를 같이 돌린다."""
    m = mat(name + '_바탕', base_rgb, 0.5, 0.0, base_rgb if emit else None, emit)
    p = plane(name, w, h, x, y, z, m, rot=(math.pi / 2, 0, math.pi + rz))
    fs = min(h * 0.55, w * 1.5 / max(4, len(text)))
    fgm = mat(name + '_글', fg_rgb, 0.4, 0.0, fg_rgb if emit else None, emit * 1.5)
    font = _korean_font()
    def add_text(t, size, dz):
        cu = bpy.data.curves.new(name + '_글자', 'FONT'); cu.body = t; cu.size = size
        cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = 0.01
        if font: cu.font = font
        cu.materials.append(fgm)
        off = (-0.01 * math.sin(rz), 0.01 * math.cos(rz), dz)    # 판보다 1cm 앞(객석 쪽)
        _obj(name + '_글자', cu, (x + off[0], y + off[1], z + off[2]), (math.pi / 2, 0, math.pi + rz))
    add_text(text, fs, fs * 0.15 if sub else 0)
    if sub: add_text(sub, fs * 0.33, -fs * 0.55)
    return p

def person(name, x, y):
    cylinder(name, 0.18, 1.0, x, y, 0.85, SKIN(), verts=10); sphere(name + '_머리', 0.12, x, y, 1.6, SKIN())

def _look_at(src, dst):
    direction = Vector(dst) - Vector(src)
    return direction.to_track_quat('-Z', 'Y').to_euler()

def light(name, kind, x, y, z, rgb, energy, target=None, spot=0.6, blend=0.5):
    d = bpy.data.lights.new(name, kind); d.color = rgb; d.energy = energy
    if kind == 'SPOT': d.spot_size = spot; d.spot_blend = blend; d.shadow_soft_size = 0.2
    if kind == 'AREA': d.size = 4.0
    o = _obj(name, d, (x, y, z))
    if target: o.rotation_euler = _look_at((x, y, z), target)   # 빛은 -Z 로 나간다
    return o

# ── 본체 ──────────────────────────────────────────────────────────────
def build(spec, render_path=None, blend_path=None, samples=48, size=(1920, 1080), cam='audience', clear=True, fast=False):
    """fast=True: 그림자는 태양·면조명만 (CPU 서버·클라우드 5분 제한용. 640×360·4샘플이면 약 40초)."""
    global _col, _mats, _meshes
    _mats = {}; _meshes = {}; _font_cache[1] = False
    if clear:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    _col = bpy.data.collections.new('무대시안'); scene.collection.children.link(_col)

    st = STAGE.get(spec.get('stage'))
    W, D = (st if st else (8, 0)); H = float(spec.get('sh', 0.9)) if st else 0.0
    night = bool(spec.get('night', True)); indoor = spec.get('io') == 'in'
    accent = hex_rgb(spec.get('color'))
    title = (spec.get('title') or '행사명').strip() or '행사명'
    tname = TYPE_NAME.get(spec.get('type'), '행사')
    led = LED.get(spec.get('led'))

    # 바닥 · 하늘
    plane('바닥', 200, 200, 0, 0, 0, mat('바닥', (0.12, 0.12, 0.13) if indoor else ((0.03, 0.06, 0.02) if night else (0.06, 0.16, 0.04)), 1.0), rot=(0, 0, 0))
    world = bpy.data.worlds.new('하늘'); scene.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*((0.004, 0.006, 0.02) if night or indoor else (0.35, 0.55, 0.9)), 1)
    bg.inputs[1].default_value = 0.15 if (night or indoor) else 1.0
    if indoor:
        box('실내벽', 60, 80, 14, 0, 15, 7, mat('벽', (0.08, 0.08, 0.09), 1.0))   # 카메라가 안에 있어 안쪽 면이 보인다
    light('태양', 'SUN', 20, 30, 40, (0.6, 0.65, 0.9) if night else (1.0, 0.95, 0.85), 0.15 if night else 3.0, target=(0, 0, 0))
    if indoor: light('실내조명', 'AREA', 0, 10, 12, (1, 1, 1), 1500 if night else 4000)

    # 무대
    if st:
        box('무대', W, D, H, 0, 0, H / 2, BLACK())
        box('무대상판', W, D, 0.02, 0, 0, H + 0.01, mat('상판', (0.04, 0.04, 0.045), 0.55))
        box('무대테두리', W + 0.04, D + 0.04, 0.06, 0, 0, H, ALU())
        steps = max(2, round(H / 0.2))
        for s in (-1, 1):
            for i in range(steps):
                box('계단', 1, 0.3, 0.2 * (i + 1), s * (W / 2 + 0.5), D / 2 - 0.15 - i * 0.3, 0.1 * (i + 1), DARK())
        person('사람1', -1.2, 0); person('사람2', 1.5, -1)
        if spec.get('podium'):
            box('연단', 0.7, 0.5, 1.1, W * 0.3, -D * 0.3, H + 0.55, DARK()); box('연단상판', 0.75, 0.55, 0.05, W * 0.3, -D * 0.3, H + 1.1, ALU())

    # 백드롭 트러스 · 현수막 · LED
    bdW = W + 2; bdH = max(4.5, (led[1] if led else 0) + 2.2 + H)
    yb = -D / 2 + 0.3
    if spec.get('backdrop'):
        for s in (-1, 1):
            truss('백드롭기둥', bdH, 'z', s * bdW / 2, yb, bdH / 2); box('베이스', 0.8, 0.8, 0.08, s * bdW / 2, yb, 0.04, BLACK())
        truss('백드롭가로', bdW, 'x', 0, yb, bdH - 0.15)
        banW = bdW - 0.6; banH = 1.1 if led else bdH - H - 1.2
        banY = bdH - 0.35 - banH / 2 if led else H + 0.6 + banH / 2
        text_plane('현수막', title, banW, banH, 0, yb + 0.17, banY, (0.9, 0.9, 0.9), (0.02, 0.02, 0.03), sub=None if led else tname)
        n = max(2, round(bdW / 2))
        for i in range(n):
            x = -bdW / 2 + (i + 0.5) * bdW / n
            cylinder('파라이트', 0.1, 0.25, x, yb + 0.2, bdH - 0.45, BLACK(), rot=(math.pi / 2 - 0.5, 0, 0), verts=8)
            if night: light('파라이트빛', 'SPOT', x, yb + 0.3, bdH - 0.4, accent, 400, target=(x * 0.6, D / 4, H), spot=0.8)
    if led:
        lw, lh = led; yl = yb + (0.35 if spec.get('backdrop') else 0)
        box('LED프레임', lw + 0.16, 0.12, lh + 0.16, 0, yl, H + 1.2 + lh / 2, BLACK())
        text_plane('LED', title, lw, lh, 0, yl + 0.07, H + 1.2 + lh / 2, (0.01, 0.015, 0.05), (1, 1, 1), emit=6.0 if night else 3.0, sub=tname)
        if not spec.get('backdrop'):
            for s in (-1, 1): truss('LED기둥', H + 1.3 + lh, 'z', s * (lw / 2 + 0.4), yl, (H + 1.3 + lh) / 2)
        if night: light('LED빛', 'AREA', 0, yl + 1.0, H + 1.2 + lh / 2, accent, 300, target=(0, D, H))

    # 조명 트러스 (골대형) + 무빙라이트
    if spec.get('truss') and st:
        th = H + 5.5; yt = D / 2 - 0.6; tw = W + 1.2
        for s in (-1, 1):
            truss('조명기둥', th, 'z', s * tw / 2, yt, th / 2); box('베이스', 0.8, 0.8, 0.08, s * tw / 2, yt, 0.04, BLACK())
        truss('조명가로', tw, 'x', 0, yt, th - 0.15)
        n = int(spec.get('moving', 0)); per = math.ceil(n / 2)
        beam_m = mat('빔', accent, 1.0, 0.0, accent, 1.2, alpha=0.08)
        for i in range(n):
            top = i < per; k = i if top else i - per; cnt = per if top else n - per
            x = -tw / 2 + (k + 0.5) * tw / max(1, cnt); y = yt if top else -D / 2 + 0.3; z = th - 0.45
            box('무빙헤드', 0.22, 0.22, 0.35, x, y, z - 0.35, BLACK()); box('무빙요크', 0.3, 0.3, 0.08, x, y, z, BLACK())
            if night:
                ang = math.sin(i * 1.3) * 0.45
                tgt = (x + math.sin(ang) * 4.5, 0 if top else D / 3, H)
                light('무빙빛', 'SPOT', x, y, z - 0.5, accent, 1500, target=tgt, spot=0.35, blend=0.3)
                L = 9.0; src = Vector((x, y, z - 0.5)); d = (Vector(tgt) - src).normalized()
                c = cone('빔', 0.05, 0.9, L, *(src + d * (L / 2)), beam_m)   # 좁은 쪽(-Z)이 등기구, 넓은 쪽(+Z)이 무대
                c.rotation_euler = _look_at(tuple(src), tgt); c.rotation_euler.rotate_axis('X', math.pi)
        if night:
            for s in (-1, 1):
                light('면조명', 'SPOT', s * tw / 3, yt, th - 0.5, (1, 0.95, 0.85), 2500, target=(s * W / 5, 0, H), spot=0.6)

    # 음향
    snd = spec.get('sound')
    if snd and st:
        ys = D / 2 + 0.3
        for s in (-1, 1):
            if snd == 'a1':
                cylinder('스탠드', 0.02, 1.4, s * (W / 2 + 0.6), ys, 0.7, BLACK(), verts=6); box('스피커', 0.4, 0.35, 0.6, s * (W / 2 + 0.6), ys, 1.6, BLACK())
            elif snd == 'a2':
                box('서브우퍼', 0.7, 0.7, 0.6, s * (W / 2 + 1), ys, 0.3, BLACK())
                for i in range(2): box('스피커', 0.5, 0.5, 0.7, s * (W / 2 + 1), ys, 0.95 + i * 0.72, BLACK())
            else:
                x = s * (W / 2 + 1.6)
                for i in range(2): box('서브우퍼', 1.1, 0.9, 0.6, x, ys, 0.3 + i * 0.62, BLACK())
                top = H + 5.2 if spec.get('truss') else bdH - 0.3
                truss('라인어레이행어', top - 1.5, 'z', x, ys - 0.2, 1.5 + (top - 1.5) / 2)
                for i in range(8):
                    e = box('라인어레이', 0.9, 0.6, 0.32, x, ys + 0.25, top - 0.3 - i * 0.36, BLACK()); e.rotation_euler[0] = 0.06 * i

    if spec.get('fence') and st:
        yf = D / 2 + 2.2; n = math.ceil((W + 4) / 1.2)
        for i in range(n):
            x = -(W + 4) / 2 + (i + 0.5) * 1.2
            box('펜스', 1.15, 0.05, 1.2, x, yf, 0.6, ALU()); box('펜스발', 0.1, 0.6, 0.05, x - 0.5, yf, 0.02, ALU())
    if spec.get('spark') and night and st:
        n = max(3, round(W / 2.5)); sm = mat('불꽃', (1, 0.9, 0.6), 1.0, 0.0, (1, 0.85, 0.4), 8.0)
        for i in range(n):
            x = -W / 2 + 1 + i * (W - 2) / max(1, n - 1)
            cone('스파클러', 0.02, 0.16, 2.2, x, D / 2 - 0.4, H + 1.1, sm)
            light('불꽃빛', 'POINT', x, D / 2 - 0.4, H + 0.6, (1, 0.9, 0.6), 60)
    if spec.get('fog') and night and st:
        box('헤이즈', W + 3, D + 3, 1.2, 0, 0, H + 0.6, mat('헤이즈', (1, 1, 1), 1.0, alpha=0.06))

    # 객석 (의자 = 메시 3개 공유, 물체만 복제)
    yStart = D / 2 + (4 if spec.get('fence') else 3)
    nch = int(spec.get('chairs', 0)); yEnd = yStart + 6
    if nch:
        perRow = min(20, max(6, round(max(W, 10) / 0.55))); rows = math.ceil(nch / perRow)
        aisle = 1.2 if perRow > 10 else 0; totalW = perRow * 0.55 + aisle
        legm = mat('의자다리', (0.05, 0.05, 0.06), 0.5, 0.4); i = 0
        for r in range(rows):
            if i >= nch: break
            for c in range(perRow):
                if i >= nch: break
                x = -totalW / 2 + c * 0.55 + 0.275 + (aisle if aisle and c >= perRow / 2 else 0)
                y = yStart + r * 0.9 + (r // 8) * 1.5
                box('의자', 0.45, 0.45, 0.06, x, y, 0.45, CHAIR()); box('의자등', 0.45, 0.05, 0.45, x, y + 0.2, 0.7, CHAIR()); box('의자다리', 0.4, 0.4, 0.42, x, y, 0.21, legm)
                i += 1
        yEnd = yStart + rows * 0.9 + (rows // 8) * 1.5
    for i in range(8): person('관객', (i - 3.5) * (W + 8) / 8, yEnd + 1 + (i % 3))

    # 텐트
    nt = int(spec.get('tents', 0)); tk = spec.get('tentkind', 'd3')
    if nt:
        tw_, td_ = TENT[tk]; sideX = max(W, 10) / 2 + 4 + td_ / 2; perSide = math.ceil(nt / 2); placed = 0
        for side in (-1, 1):
            for i in range(perSide):
                if placed >= nt: break
                x = side * sideX; y = yStart + 1 + i * (tw_ + 0.6) + tw_ / 2; h = 2.6 if tk == 'd11' else 2.2
                if tk == 'd11':
                    cylinder('몽골텐트', 3, h, x, y, h / 2, WHITE(), verts=16); cone('몽골지붕', 3.4, 0, 1.8, x, y, h + 0.9, BLUE(), verts=16)
                else:
                    for a, b in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                        cylinder('텐트다리', 0.03, h, x + a * td_ / 2 * 0.95, y + b * tw_ / 2 * 0.95, h / 2, ALU(), verts=6)
                    roof = cone('텐트지붕', math.hypot(tw_, td_) / 2 * 1.05, 0, 0.9, x, y, h + 0.45, BLUE(), rot=(0, 0, math.pi / 4), verts=4)
                    roof.scale = (td_ / max(tw_, td_), tw_ / max(tw_, td_), 1)
                    box('테이블', 0.6, tw_ * 0.7, 0.05, x - side * (td_ / 2 - 0.5), y, 0.75, WHITE())
                placed += 1
    if spec.get('photo'):
        x = max(W, 10) / 2 + 2; y = yEnd + 4
        box('포토존판', 3, 0.12, 2.4, x, y, 1.2, WHITE(), rz=math.pi / 4)
        text_plane('포토존', title, 2.8, 2.2, x - 0.05, y + 0.05, 1.2, accent, (1, 1, 1), sub='PHOTO ZONE', rz=math.pi / 4)
    if spec.get('gen') and not indoor:
        x = -(max(W, 10) / 2 + 9); y = -D / 2 - 4
        box('발전차', 2.4, 6, 2.6, x, y, 1.8, WHITE(), rz=0.4); box('발전차운전석', 2.3, 1.8, 1.8, x - 1.5, y - 3.6, 1.4, DARK(), rz=0.4)

    # 카메라
    far = max(14, nch / 25 + 12)
    cams = {'audience': ((W * 0.4, far, 2.2), (0, -D / 4, H + 1.8)), 'front': ((0, D / 2 + 9, H + 2.5), (0, -D / 2, H + 2)),
            'bird': ((8, far * 0.8, 32), (0, far / 3, 0)), 'side': ((W + 12, 3, 4), (0, 0, H + 1)), 'stage': ((-W * 0.3, -D / 2 + 1, H + 1.7), (0, far, 1.5))}
    pos, tgt = cams.get(cam, cams['audience'])
    cd = bpy.data.cameras.new('카메라'); cd.lens = 32
    co = _obj('카메라', cd, pos, _look_at(pos, tgt)); scene.camera = co

    # 렌더 설정
    if fast:
        for d in bpy.data.lights:
            d.use_shadow = d.type == 'SUN' or d.name.startswith('면조명')
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else engines[0])
    scene.render.resolution_x, scene.render.resolution_y = size; scene.render.resolution_percentage = 100
    try: scene.eevee.taa_render_samples = samples
    except Exception: pass
    try: scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    if hasattr(scene.eevee, 'use_bloom'): scene.eevee.use_bloom = True
    try: scene.render.image_settings.media_type = 'IMAGE'   # 블렌더 5.x
    except Exception: pass
    scene.render.image_settings.file_format = 'PNG'
    if blend_path: bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(blend_path))
    if render_path:
        scene.render.filepath = os.path.abspath(render_path); bpy.ops.render.render(write_still=True)
    return {'objects': len(_col.objects), 'meshes': len(_meshes), 'stage': (W, D, H), 'camera': cam, 'engine': scene.render.engine}


# ── 명령줄 ────────────────────────────────────────────────────────────
if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) < 2:
        print(__doc__); sys.exit(1)
    spec = json.load(open(args[0], encoding='utf-8'))
    opts = {'samples': 48, 'size': (1920, 1080), 'cam': 'audience', 'blend_path': None}
    i = 2
    while i < len(args):
        a = args[i]
        if a == '--blend': opts['blend_path'] = args[i + 1]; i += 2
        elif a == '--samples': opts['samples'] = int(args[i + 1]); i += 2
        elif a == '--size': w, h = args[i + 1].lower().split('x'); opts['size'] = (int(w), int(h)); i += 2
        elif a == '--cam': opts['cam'] = args[i + 1]; i += 2
        elif a == '--fast': opts['fast'] = True; i += 1
        else: i += 1
    r = build(spec, render_path=args[1], **opts)
    print('완료:', r)
