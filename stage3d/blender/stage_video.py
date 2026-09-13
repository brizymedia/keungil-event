# -*- coding: utf-8 -*-
"""
큰길이벤트기획 · 3D 무대 시안 → 블렌더 고화질 **영상**

stage_gen.py 로 같은 장면을 세운 뒤 카메라가 움직이고, 무빙라이트가 돌고, LED 가 숨쉬고,
안개 속에 빛줄기가 보이는 장면을 프레임마다 그려 MP4 로 묶는다.

  blender -b -P stage_video.py -- 시안.json 결과.mp4
        [--seconds 12] [--fps 24] [--size 1920x1080] [--samples 24]
        [--shots audience,crane,side,bird]     장면 순서 (audience·crane·side·bird·stage·led 중에서)
        [--no-fog]                             안개(볼륨) 끄기 — 빠르지만 빛줄기가 반투명 원뿔로 나온다
        [--frames 1-120]                       일부 프레임만 (끊긴 렌더 이어서 할 때)
        [--keep]                               PNG 프레임 폴더를 지우지 않는다
        [--blend 결과.blend]                   블렌더 파일도 저장 (열어서 손으로 고칠 때)

ffmpeg 가 PATH 에 있으면 그것으로 묶고(H.264·CRF 18), 없으면 블렌더 내장 인코더로 묶는다.
"""
import bpy, json, math, os, sys, random, shutil, subprocess
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
_ns = {'__name__': 'stage_gen'}
exec(compile(open(os.path.join(HERE, 'stage_gen.py'), encoding='utf-8').read(), 'stage_gen.py', 'exec'), _ns)
build, _obj, mat, LED = _ns['build'], _ns['_obj'], _ns['mat'], _ns['LED']

def _smooth(t):            # 0→1 을 천천히 시작해 천천히 끝나게
    return t * t * (3 - 2 * t)

def _lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def shots_for(spec, info):
    """장면 이름 → (t)→(카메라 위치, 바라보는 점) 함수와 렌즈. t 는 0~1."""
    W, D, H = info['stage']; W = W or 8
    nch = int(spec.get('chairs', 0)); far = max(14, nch / 25 + 12)
    led = LED.get(spec.get('led')); lh = led[1] if led else 3
    led_c = (0, -D / 2, H + 1.2 + lh / 2)
    return {
        'audience': (lambda t: (_lerp((W * 0.55, far + 3, 1.9), (W * 0.15, far * 0.5, 2.6), _smooth(t)),
                                _lerp((0, -D / 4, H + 1.8), (0, -D / 4, H + 2.2), _smooth(t))), 30),
        'crane':    (lambda t: (_lerp((W * 0.7, D / 2 + 7, 1.5), (W * 1.0, D / 2 + 13, 9.5), _smooth(t)), led_c), 35),
        'side':     (lambda t: (((W + 9) * math.cos(math.radians(25 + 50 * _smooth(t))), (W + 9) * math.sin(math.radians(25 + 50 * _smooth(t))), 3.5 + 1.5 * t),
                                (0, 0, H + 1.5)), 32),
        'bird':     (lambda t: (_lerp((1.5, far * 0.9, 15), (4, far * 1.5, 34), _smooth(t)),
                                _lerp((0, far / 3, 1), (0, far / 5, 0), _smooth(t))), 30),
        'stage':    (lambda t: (_lerp((-W * 0.35, -D / 2 + 1.5, H + 1.7), (W * 0.1, -D / 2 + 3, H + 1.9), _smooth(t)), (0, far, 1.5)), 28),
        'led':      (lambda t: (_lerp((-W * 0.4, D / 2 + 5, H + 1), (W * 0.3, D / 2 + 4, H + 2.5), _smooth(t)), led_c), 40),
    }

def add_fog(spec, info):
    """무대 둘레에 옅은 안개 상자 — 스팟 조명이 실제 빛줄기를 만든다. 가짜 빔 원뿔·헤이즈 판은 숨긴다."""
    W, D, H = info['stage']; W = W or 8
    m = bpy.data.materials.new('안개'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = 0.035; vol.inputs['Anisotropy'].default_value = 0.35
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    fog = _ns['box']('안개', W + 18, D + 24, H + 9, 0, D / 2 + 2, (H + 9) / 2, m)
    fog.display_type = 'WIRE'
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.data.materials and o.data.materials[0].name in ('빔', '헤이즈'):
            o.hide_render = True
    sc = bpy.context.scene
    for k, v in (('volumetric_tile_size', '4'), ('volumetric_samples', 48), ('use_volumetric_shadows', True), ('volumetric_shadow_samples', 8)):
        try: setattr(sc.eevee, k, v)
        except Exception: pass
    return fog

def soften(spec):
    """영상용 손질: 불꽃은 반투명한 빛무리로, 밤에는 달빛을 조금 더 (객석이 보이게)."""
    m = bpy.data.materials.get('불꽃')
    if m and m.node_tree:
        p = m.node_tree.nodes.get('Principled BSDF')
        if p:
            p.inputs['Emission Strength'].default_value = 3.0; p.inputs['Alpha'].default_value = 0.3
            p.inputs['Base Color'].default_value = (1, 0.8, 0.45, 1)
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    if spec.get('night', True):
        sun = bpy.data.lights.get('태양')
        if sun: sun.energy = max(sun.energy, 0.5); sun.color = (0.55, 0.62, 0.9)

def add_glare():
    """컴포지터 블룸 — LED·불꽃·빛줄기가 번지게."""
    sc = bpy.context.scene
    try:
        nt = bpy.data.node_groups.new('합성', 'CompositorNodeTree'); sc.compositing_node_group = nt
        nt.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        rl = nt.nodes.new('CompositorNodeRLayers'); gl = nt.nodes.new('CompositorNodeGlare'); out = nt.nodes.new('NodeGroupOutput')
        gl.inputs['Type'].default_value = 'Bloom'; gl.inputs['Threshold'].default_value = 1.2
        gl.inputs['Strength'].default_value = 0.12; gl.inputs['Size'].default_value = 0.6
        nt.links.new(rl.outputs['Image'], gl.inputs['Image']); nt.links.new(gl.outputs['Image'], out.inputs['Image'])
        sc.render.use_compositing = True
        return True
    except Exception as e:
        print('블룸 생략:', e); return False

def _fcurves(ob):
    """블렌더 5.x(슬롯 액션)·4.x 양쪽에서 물체의 F-커브 목록."""
    ad = ob.animation_data
    if not ad or not ad.action: return []
    act = ad.action
    if hasattr(act, 'fcurves'): return list(act.fcurves)
    out = []
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for cb in getattr(strip, 'channelbags', []): out += list(cb.fcurves)
    return out

def animate(spec, info, shots, fps, seconds):
    sc = bpy.context.scene
    N = max(fps, int(round(seconds * fps))); sc.frame_start = 1; sc.frame_end = N; sc.render.fps = fps
    W, D, H = info['stage']
    night = bool(spec.get('night', True))

    # 1) 카메라 — 바라보는 점(빈 객체)을 따라가게 하고, 둘 다 3프레임마다 키를 찍는다 (장면 사이는 컷)
    cam = sc.camera; look = _obj('카메라목표', None, (0, 0, H + 1.5))
    c = cam.constraints.new('TRACK_TO'); c.target = look; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    cam.rotation_euler = (0, 0, 0)
    table = shots_for(spec, info)
    names = [s for s in shots if s in table] or ['audience']
    per = N // len(names); f0 = 1
    for si, name in enumerate(names):
        fn, lens = table[name]
        f1 = N if si == len(names) - 1 else f0 + per - 1
        cam.data.lens = lens; cam.data.keyframe_insert('lens', frame=f0); cam.data.keyframe_insert('lens', frame=f1)
        f = f0
        while True:
            t = (f - f0) / max(1, f1 - f0)
            pos, tgt = fn(t)
            cam.location = pos; cam.keyframe_insert('location', frame=f)
            look.location = tgt; look.keyframe_insert('location', frame=f)
            if f >= f1: break
            f = min(f1, f + 3)
        f0 = f1 + 1
    for ob in (cam, look, cam.data):
        for fc in _fcurves(ob):
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

    # 2) 무빙라이트 — 등기구 빈 객체를 좌우로 천천히, 위아래로 조금 흔든다 (기구마다 위상이 다르다)
    rigs = [o for o in bpy.data.objects if o.name.startswith('무빙기구')]
    for i, g in enumerate(rigs):
        ph = i * 0.9; T = 4.0 * fps
        for f in range(1, N + 1, 2):
            g.rotation_euler = (0.18 * math.sin(2 * math.pi * f / (T * 1.3) + ph * 1.7), 0, 0.55 * math.sin(2 * math.pi * f / T + ph))
            g.keyframe_insert('rotation_euler', frame=f)

    # 3) LED 밝기 숨쉬기 · 불꽃 흔들림
    def emit_input(mname):
        m = bpy.data.materials.get(mname)
        if not m or not m.node_tree: return None
        p = m.node_tree.nodes.get('Principled BSDF')
        return p.inputs['Emission Strength'] if p else None
    led_in = emit_input('LED_바탕'); led_txt = emit_input('LED_글')
    if led_in and night:
        base = led_in.default_value; base_t = led_txt.default_value if led_txt else 0
        for f in range(1, N + 1, 4):
            k = 1 + 0.18 * math.sin(2 * math.pi * f / (3.0 * fps))
            led_in.default_value = base * k; led_in.keyframe_insert('default_value', frame=f)
            if led_txt: led_txt.default_value = base_t * k; led_txt.keyframe_insert('default_value', frame=f)
    rnd = random.Random(7)
    sp = emit_input('불꽃')
    sparks = [o for o in bpy.data.objects if o.type == 'LIGHT' and o.name.startswith('불꽃빛')]
    if sp and night:
        base = sp.default_value
        cones = [o for o in bpy.data.objects if o.name.startswith('스파클러')]
        for f in range(1, N + 1, 2):
            sp.default_value = base * rnd.uniform(0.55, 1.35); sp.keyframe_insert('default_value', frame=f)
            for o in sparks:
                o.data.energy = 60 * rnd.uniform(0.4, 1.4); o.data.keyframe_insert('energy', frame=f)
            for o in cones:
                o.scale = (1, 1, 2.2 * rnd.uniform(0.7, 1.1)); o.keyframe_insert('scale', frame=f)
    return N

def encode(frames_dir, out_path, fps):
    ff = shutil.which('ffmpeg')
    pattern = os.path.join(frames_dir, 'f_%04d.png')
    if ff:
        cmd = [ff, '-y', '-framerate', str(fps), '-start_number', '1', '-i', pattern,
               '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out_path]
        print('ffmpeg:', ' '.join(cmd)); subprocess.run(cmd, check=True); return 'ffmpeg'
    # 블렌더 내장 인코더: 프레임 PNG 를 시퀀서에 얹어 다시 출력
    sc = bpy.context.scene
    files = sorted(f for f in os.listdir(frames_dir) if f.startswith('f_') and f.endswith('.png'))
    sc.sequence_editor_create()
    ed = sc.sequence_editor
    strip = ed.sequences.new_image('프레임', os.path.join(frames_dir, files[0]), 1, 1)
    for f in files[1:]: strip.elements.append(f)
    sc.frame_start = 1; sc.frame_end = len(files)
    try: sc.render.image_settings.media_type = 'VIDEO'
    except Exception: pass
    sc.render.image_settings.file_format = 'FFMPEG'; sc.render.ffmpeg.format = 'MPEG4'; sc.render.ffmpeg.codec = 'H264'
    sc.render.ffmpeg.constant_rate_factor = 'HIGH'; sc.render.filepath = out_path
    sc.render.use_compositing = False; sc.render.use_sequencer = True
    bpy.ops.render.render(animation=True); return 'blender'

def make_video(spec, out_path, seconds=12, fps=24, size=(1920, 1080), samples=24, shots=('audience', 'crane', 'side', 'bird'),
               fog=True, frames=None, keep=False, blend_path=None):
    info = build(spec, samples=samples, size=size, cam='audience')
    sc = bpy.context.scene
    if fog and spec.get('night', True): add_fog(spec, info)
    soften(spec); add_glare()
    try: sc.eevee.use_raytracing = True; sc.eevee.use_shadows = True; sc.eevee.shadow_ray_count = 2
    except Exception: pass
    try: sc.eevee.shadow_pool_size = '1024'   # 조명이 많아 기본 버퍼가 넘친다는 경고가 뜬다
    except Exception: pass
    N = animate(spec, info, shots, fps, seconds)
    if frames:
        sc.frame_start, sc.frame_end = max(1, frames[0]), min(N, frames[1])
    out_path = os.path.abspath(out_path)
    frames_dir = os.path.splitext(out_path)[0] + '_frames'; os.makedirs(frames_dir, exist_ok=True)
    sc.render.filepath = os.path.join(frames_dir, 'f_')
    try: sc.render.image_settings.media_type = 'IMAGE'
    except Exception: pass
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
    if blend_path: bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(blend_path))
    print('렌더 시작: %d~%d 프레임, %dx%d, %d 샘플, 물체 %d개' % (sc.frame_start, sc.frame_end, size[0], size[1], samples, info['objects']))
    bpy.ops.render.render(animation=True)
    how = encode(frames_dir, out_path, fps)
    if not keep and not frames: shutil.rmtree(frames_dir, ignore_errors=True)
    return {'frames': N, 'fps': fps, 'size': size, 'encoder': how, 'out': out_path}


if __name__ == '__main__' and '--' in sys.argv:
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) < 2:
        print(__doc__); sys.exit(1)
    spec = json.load(open(args[0], encoding='utf-8'))
    o = {}
    i = 2
    while i < len(args):
        a = args[i]
        if a == '--seconds': o['seconds'] = float(args[i + 1]); i += 2
        elif a == '--fps': o['fps'] = int(args[i + 1]); i += 2
        elif a == '--samples': o['samples'] = int(args[i + 1]); i += 2
        elif a == '--size': w, h = args[i + 1].lower().split('x'); o['size'] = (int(w), int(h)); i += 2
        elif a == '--shots': o['shots'] = [s.strip() for s in args[i + 1].split(',') if s.strip()]; i += 2
        elif a == '--frames': a1, b1 = args[i + 1].split('-'); o['frames'] = (int(a1), int(b1)); i += 2
        elif a == '--blend': o['blend_path'] = args[i + 1]; i += 2
        elif a == '--no-fog': o['fog'] = False; i += 1
        elif a == '--keep': o['keep'] = True; i += 1
        else: i += 1
    r = make_video(spec, args[1], **o)
    print('완료:', r)
