#!/usr/bin/env python3
"""쓸모이슈 쇼츠 생성기 — 풀리지 않는 자루 매듭법 (9:16, 1080x1920)

사용법:
  python3 make_video.py                # 일러스트 버전 (오프라인, BGM+자막)
  python3 make_video.py --photoreal    # Higgsfield 실사 이미지 다운로드 사용
  python3 make_video.py --voice        # edge-tts 한국어 나레이션 추가 (인터넷 필요)

의존성: ffmpeg, Pillow, numpy / (--voice 시) pip install edge-tts
"""
import argparse
import json
import math
import os
import struct
import subprocess
import sys
import wave

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, "assets")
W, H = 1080, 1920
FPS = 30

FONT_DIR = "/usr/share/fonts/truetype/nanum"
FONT_BOLD = os.path.join(FONT_DIR, "NanumSquareRoundB.ttf")
FONT_REG = os.path.join(FONT_DIR, "NanumSquareRoundR.ttf")
if not os.path.exists(FONT_BOLD):
    FONT_BOLD = FONT_REG = os.path.join(FONT_DIR, "NanumGothicBold.ttf")

# ── 색상 팔레트 ──────────────────────────────────────────────
BG_TOP = (250, 244, 230)
BG_BOT = (240, 230, 208)
GREEN = (73, 138, 80)
GREEN_DK = (52, 104, 60)
GREEN_LT = (104, 165, 106)
ROPE = (246, 244, 236)
ROPE_DK = (176, 166, 148)
INK = (43, 40, 36)
RED = (224, 73, 76)
BLUE = (47, 111, 237)
AMBER = (240, 173, 60)

SCENES = json.load(open(os.path.join(BASE, "scenes.json"), encoding="utf-8"))


# ── 그리기 유틸 ──────────────────────────────────────────────
def bezier(pts, n=120):
    """De Casteljau 곡선 샘플링 (임의 차수)."""
    out = []
    for i in range(n + 1):
        t = i / n
        p = [list(q) for q in pts]
        while len(p) > 1:
            p = [
                (p[j][0] * (1 - t) + p[j + 1][0] * t,
                 p[j][1] * (1 - t) + p[j + 1][1] * t)
                for j in range(len(p) - 1)
            ]
        out.append(p[0])
    return out


def rope_path(d, pts, width=34, n=140):
    """밧줄: 어두운 외곽 + 밝은 심 + 꼬임 눈금."""
    path = bezier(pts, n)
    d.line(path, fill=ROPE_DK, width=width, joint="curve")
    d.line(path, fill=ROPE, width=width - 12, joint="curve")
    step = max(2, n // 26)
    for i in range(step, n - 2, step):
        (x0, y0), (x1, y1) = path[i - 1], path[i + 1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        r = width * 0.32
        cx, cy = path[i]
        d.line([(cx - nx * r, cy - ny * r), (cx + nx * r + dx * 0.12, cy + ny * r + dy * 0.12)],
               fill=(214, 206, 190), width=5)
    return path


def arrow(d, p0, p1, color, width=16, head=34):
    d.line([p0, p1], fill=color, width=width)
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    for s in (-1, 1):
        a = ang + math.pi + s * 0.45
        d.line([p1, (p1[0] + head * math.cos(a), p1[1] + head * math.sin(a))],
               fill=color, width=width)


def curved_arrow(d, pts, color, width=14, head=32):
    path = bezier(pts, 60)
    d.line(path, fill=color, width=width, joint="curve")
    (x0, y0), (x1, y1) = path[-4], path[-1]
    ang = math.atan2(y1 - y0, x1 - x0)
    for s in (-1, 1):
        a = ang + math.pi + s * 0.45
        d.line([(x1, y1), (x1 + head * math.cos(a), y1 + head * math.sin(a))],
               fill=color, width=width)


def badge(d, xy, num, color=BLUE, r=44):
    x, y = xy
    d.ellipse([x - r, y - r, x + r, y + r], fill=color, outline=(255, 255, 255), width=6)
    f = ImageFont.truetype(FONT_BOLD, 52)
    d.text((x, y - 4), str(num), font=f, fill=(255, 255, 255), anchor="mm")


def text_center(d, y, txt, size, fill=INK, font=None, stroke=0, stroke_fill=(255, 255, 255)):
    f = ImageFont.truetype(font or FONT_BOLD, size)
    d.text((W // 2, y), txt, font=f, fill=fill, anchor="mm",
           stroke_width=stroke, stroke_fill=stroke_fill)


def base_canvas(title, sub, accent=GREEN):
    img = Image.new("RGB", (W, H), BG_TOP)
    d = ImageDraw.Draw(img)
    for y in range(H):  # 세로 그라데이션
        t = y / H
        c = tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOT))
        d.line([(0, y), (W, y)], fill=c)
    # 상단 채널 태그 + 제목
    f = ImageFont.truetype(FONT_BOLD, 44)
    tw = d.textlength("쓸모이슈", font=f)
    d.rounded_rectangle([W / 2 - tw / 2 - 34, 96, W / 2 + tw / 2 + 34, 178], 40, fill=accent)
    d.text((W / 2, 136), "쓸모이슈", font=f, fill=(255, 255, 255), anchor="mm")
    text_center(d, 268, title, 76, fill=INK)
    if sub:
        text_center(d, 356, sub, 48, fill=(110, 102, 90), font=FONT_REG)
    return img, d


def draw_sack(d, cx, top, w, h, bunch=True):
    """묶인 목 부분이 있는 초록 마대자루."""
    x0, x1 = cx - w / 2, cx + w / 2
    bot = top + h
    d.ellipse([x0 + 40, bot - 46, x1 - 40, bot + 44], fill=(0, 0, 0, 40))  # 그림자
    body = [(x0 + 22, top + 96), (x0 - 26, bot - 140), (x0 + 60, bot),
            (x1 - 60, bot), (x1 + 26, bot - 140), (x1 - 22, top + 96)]
    d.polygon(body, fill=GREEN)
    d.polygon([(x0 + 22, top + 96), (x0 + 60, top + 30), (x1 - 60, top + 30), (x1 - 22, top + 96)],
              fill=GREEN_LT)
    if bunch:  # 오므린 목
        d.polygon([(cx - 96, top + 44), (cx - 44, top - 74), (cx + 44, top - 74), (cx + 96, top + 44)],
                  fill=GREEN_DK)
        for i in range(-3, 4):
            d.line([(cx + i * 24, top + 40), (cx + i * 12, top - 66)], fill=GREEN, width=7)
    # 직조 텍스처
    for yy in range(int(top + 130), int(bot - 30), 56):
        d.line([(x0 + 14, yy), (x1 - 14, yy)], fill=GREEN_DK, width=3)
    for xx in range(int(x0 + 60), int(x1 - 30), 64):
        d.line([(xx, top + 120), (xx - 18, bot - 24)], fill=GREEN_DK, width=3)


def result_badge(d, xy, ok=True):
    x, y = xy
    r = 78
    col = GREEN if ok else RED
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))
    d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=12)
    if ok:
        d.line([(x - 36, y + 2), (x - 8, y + 32), (x + 42, y - 30)], fill=col, width=18, joint="curve")
    else:
        d.line([(x - 32, y - 32), (x + 32, y + 32)], fill=col, width=18)
        d.line([(x + 32, y - 32), (x - 32, y + 32)], fill=col, width=18)


# ── 장면별 일러스트 ──────────────────────────────────────────
def scene1():
    img, d = base_canvas("자루, 이렇게 묶으세요?", "손 놓으면 스르륵… 다 풀립니다", RED)
    draw_sack(d, W / 2, 900, 620, 700)
    ny = 830  # 목 높이의 엉성한 매듭
    rope_path(d, [(W/2 - 320, ny + 130), (W/2 - 200, ny - 60), (W/2 - 40, ny + 40), (W/2 + 60, ny - 40)])
    rope_path(d, [(W/2 + 60, ny - 40), (W/2 + 180, ny + 60), (W/2 + 330, ny - 90)])
    # 풀리는 방향 화살표
    curved_arrow(d, [(W/2 - 250, ny - 40), (W/2 - 360, ny - 100), (W/2 - 430, ny - 40)], RED)
    curved_arrow(d, [(W/2 + 260, ny - 60), (W/2 + 380, ny - 130), (W/2 + 440, ny - 60)], RED)
    result_badge(d, (W - 190, 640), ok=False)
    return img


def scene2():
    img, d = base_canvas("올바른 매듭법", "고리 만들고 → 통과 → 감고 → 다시 통과", BLUE)
    cx, cy = W / 2, 900
    # 본줄 (가로)
    rope_path(d, [(90, cy - 220), (cx - 120, cy - 260), (W - 90, cy - 210)])
    # 아래로 내린 고리
    rope_path(d, [(cx - 60, cy - 240), (cx - 240, cy + 60), (cx, cy + 260), (cx + 240, cy + 60), (cx + 40, cy - 240)])
    # 끝줄이 고리 아래→위 통과 후 본줄을 감는 경로
    rope_path(d, [(cx - 40, cy + 400), (cx - 20, cy + 160), (cx + 20, cy - 60), (cx + 120, cy - 300)], width=28)
    curved_arrow(d, [(cx + 120, cy - 320), (cx + 240, cy - 420), (cx + 60, cy - 460), (cx - 60, cy - 330)], BLUE)
    badge(d, (170, cy - 320), 1)
    badge(d, (cx - 300, cy + 210), 2)
    badge(d, (cx + 330, cy - 420), 3)
    text_center(d, 1520, "① 아래로 고리  ② 밑에서 위로 통과", 54)
    text_center(d, 1608, "③ 본줄 감아 고리 속으로 → 당기기", 54)
    return img


def scene3():
    img, d = base_canvas("두 바퀴 감아 잠그기", "손가락에 두 바퀴 → 끝줄 통과 → 당김", BLUE)
    cx, cy = W / 2, 840
    draw_sack(d, cx, 1180, 560, 560)
    # 두 개의 코일 (겹친 원)
    for k, dx in enumerate((-52, 52)):
        d.ellipse([cx + dx - 150, cy - 150, cx + dx + 150, cy + 150], outline=ROPE_DK, width=40)
        d.ellipse([cx + dx - 150, cy - 150, cx + dx + 150, cy + 150], outline=ROPE, width=24)
    # 끝줄이 두 코일 중앙 통과
    rope_path(d, [(cx, cy - 340), (cx - 10, cy - 80), (cx + 10, cy + 120), (cx, cy + 300)], width=28)
    badge(d, (cx - 300, cy - 170), 4)
    badge(d, (cx + 310, cy - 170), 5)
    arrow(d, (cx + 330, cy + 240), (cx + 330, cy + 470), AMBER, width=20, head=44)
    f = ImageFont.truetype(FONT_BOLD, 46)
    d.text((cx + 330, cy + 530), "당김!", font=f, fill=AMBER, anchor="mm")
    return img


def scene4():
    img, d = base_canvas("풀 때는 한 번에!", "끝줄만 살짝 위로 당기면 끝", GREEN)
    cx = W / 2
    draw_sack(d, cx, 1050, 620, 660)
    ny = 980
    # 느슨해지며 풀리는 고리들
    rope_path(d, [(cx - 260, ny), (cx - 140, ny - 150), (cx + 20, ny - 30), (cx + 160, ny - 170), (cx + 300, ny - 10)])
    rope_path(d, [(cx - 60, ny + 10), (cx - 20, ny - 200), (cx + 30, ny - 380), (cx + 10, ny - 520)], width=28)
    arrow(d, (cx + 170, ny - 300), (cx + 170, ny - 540), GREEN, width=20, head=46)
    result_badge(d, (W - 190, 620), ok=True)
    # 반짝임
    for (sx, sy, r) in [(180, 700, 26), (250, 560, 16), (W - 320, 500, 20)]:
        d.line([(sx - r, sy), (sx + r, sy)], fill=AMBER, width=8)
        d.line([(sx, sy - r), (sx, sy + r)], fill=AMBER, width=8)
    return img


# ── BGM (Karplus-Strong 아르페지오 + 패드) ───────────────────
def make_bgm(path, seconds):
    import numpy as np
    sr = 44100
    total = int(sr * seconds)
    out = np.zeros(total, dtype=np.float64)

    def pluck(freq, dur, vol):
        n = int(sr * dur)
        period = max(2, int(sr / freq))
        buf = np.random.uniform(-1, 1, period)
        sig = np.empty(n)
        for i in range(n):
            v = buf[i % period]
            buf[i % period] = 0.996 * 0.5 * (v + buf[(i + 1) % period])
            sig[i] = v
        env = np.exp(-np.linspace(0, 5.2, n))
        return sig * env * vol

    chords = [  # Am - F - C - G
        [220.0, 261.63, 329.63, 440.0],
        [174.61, 220.0, 261.63, 349.23],
        [130.81, 196.0, 261.63, 329.63],
        [196.0, 246.94, 293.66, 392.0],
    ]
    bpm = 96
    eighth = 60 / bpm / 2
    t_pos = 0.0
    ci = 0
    while t_pos < seconds - 0.3:
        notes = chords[ci % 4]
        order = [0, 1, 2, 3, 2, 3, 1, 2]
        for oi in order:
            if t_pos >= seconds - 0.3:
                break
            s = int(t_pos * sr)
            p = pluck(notes[oi], min(0.9, seconds - t_pos), 0.24)
            e = min(total, s + len(p))
            out[s:e] += p[: e - s]
            t_pos += eighth
        # 잔잔한 패드 (마디 단위)
        bar = eighth * 8
        s = int((t_pos - bar) * sr)
        n = int(bar * sr)
        tt = np.arange(n) / sr
        pad = sum(np.sin(2 * np.pi * f / 2 * tt) for f in notes[:3]) / 3
        envp = np.minimum(tt / 0.6, 1) * np.minimum((bar - tt) / 0.6, 1).clip(0, 1)
        e = min(total, s + n)
        out[s:e] += (pad * envp * 0.075)[: e - s]
        ci += 1

    fade = int(sr * 2.0)
    out[-fade:] *= np.linspace(1, 0, fade)
    out[: int(sr * 0.4)] *= np.linspace(0, 1, int(sr * 0.4))
    out = np.tanh(out * 1.1) * 0.85
    pcm = (out * 32767 * 0.5).astype(np.int16)
    stereo = np.repeat(pcm[:, None], 2, axis=1).ravel()
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(stereo.tobytes())


# ── 자막 (ASS) ───────────────────────────────────────────────
def fmt_ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def make_ass(path, durations):
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,NanumSquareRoundB,64,&H00FFFFFF,&H00FFFFFF,&H00201810,&H7F000000,-1,0,0,0,100,100,0,0,1,4,2,2,60,60,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    t0 = 0.0
    for scene, dur in zip(SCENES, durations):
        subs = scene["subs"]
        weights = [len(s) for s in subs]
        tw = sum(weights)
        t = t0
        for s, wgt in zip(subs, weights):
            d = dur * wgt / tw
            lines.append(f"Dialogue: 0,{fmt_ts(t)},{fmt_ts(t + d - 0.05)},Sub,,0,0,0,,{s}")
            t += d
        t0 += dur
    open(path, "w", encoding="utf-8").write(head + "\n".join(lines) + "\n")


# ── 나레이션 (edge-tts, 인터넷 필요) ─────────────────────────
def make_voice(durations):
    import asyncio
    import edge_tts

    async def gen():
        for i, scene in enumerate(SCENES):
            fn = os.path.join(ASSETS, f"nar{i + 1}.mp3")
            await edge_tts.Communicate(scene["narration"], "ko-KR-InJoonNeural", rate="+8%").save(fn)
            print("voice:", fn)

    asyncio.run(gen())
    durs = []
    for i in range(len(SCENES)):
        fn = os.path.join(ASSETS, f"nar{i + 1}.mp3")
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fn],
            capture_output=True, text=True).stdout.strip()
        durs.append(max(float(out) + 0.6, 3.0))
    return durs


def download_photoreal():
    import urllib.request
    for i, scene in enumerate(SCENES):
        fn = os.path.join(ASSETS, f"photo{i + 1}.png")
        if not os.path.exists(fn):
            print("download:", scene["image_url"])
            urllib.request.urlretrieve(scene["image_url"], fn)


# ── 조립 ─────────────────────────────────────────────────────
def build(photoreal, voice):
    os.makedirs(ASSETS, exist_ok=True)

    durations = [s["duration"] for s in SCENES]
    if voice:
        durations = make_voice(durations)

    if photoreal:
        download_photoreal()
        imgs = [os.path.join(ASSETS, f"photo{i + 1}.png") for i in range(len(SCENES))]
    else:
        for i, fn in enumerate([scene1, scene2, scene3, scene4]):
            p = os.path.join(ASSETS, f"illust{i + 1}.png")
            fn().save(p)
            print("illust:", p)
        imgs = [os.path.join(ASSETS, f"illust{i + 1}.png") for i in range(len(SCENES))]

    total = sum(durations)
    bgm = os.path.join(ASSETS, "bgm.wav")
    make_bgm(bgm, total + 0.5)
    ass = os.path.join(ASSETS, "subs.ass")
    make_ass(ass, durations)

    # 장면 클립: 켄번즈 줌
    clips = []
    for i, (img, dur) in enumerate(zip(imgs, durations)):
        clip = os.path.join(ASSETS, f"clip{i + 1}.mp4")
        frames = int(dur * FPS)
        zdir = "1.001+0.10*on/{fr}".format(fr=frames) if i % 2 == 0 else "1.101-0.10*on/{fr}".format(fr=frames)
        vf = (f"scale=1620:2880,zoompan=z='{zdir}':d={frames}"
              f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps={FPS}:s={W}x{H}")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", str(dur), "-i", img,
             "-vf", vf, "-t", str(dur), "-r", str(FPS), "-pix_fmt", "yuv420p",
             "-c:v", "libx264", "-crf", "18", clip], check=True)
        clips.append(clip)
        print("clip:", clip)

    concat_txt = os.path.join(ASSETS, "concat.txt")
    open(concat_txt, "w").write("".join(f"file '{c}'\n" for c in clips))

    # 나레이션 트랙: 장면 시작 시점에 맞춰 배치
    if voice:
        nar = os.path.join(ASSETS, "narration.wav")
        parts = []
        t = 0.0
        for i, dur in enumerate(durations):
            parts.append(f"[{i}:a]adelay={int(t * 1000)}|{int(t * 1000)}[n{i}]")
            t += dur
        nar_ins = sum([["-i", os.path.join(ASSETS, f"nar{i + 1}.mp3")] for i in range(len(SCENES))], [])
        fc = ";".join(parts) + ";" + "".join(f"[n{i}]" for i in range(len(SCENES))) + \
             f"amix=inputs={len(SCENES)}:normalize=0[nar]"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + nar_ins +
                       ["-filter_complex", fc, "-map", "[nar]", nar], check=True)

    out = os.path.join(BASE, "ssulmoissue_knot_shorts.mp4")
    fade = f"fade=t=in:d=0.4,fade=t=out:st={total - 0.5}:d=0.5,ass={ass}"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concat_txt]
    if voice:
        nar = os.path.join(ASSETS, "narration.wav")
        cmd += ["-i", bgm, "-i", nar,
                "-filter_complex",
                f"[0:v]{fade}[v];[1:a]volume=0.32[b];[2:a]volume=1.6[n];"
                f"[b][n]amix=inputs=2:duration=first:normalize=0[aout]",
                "-map", "[v]", "-map", "[aout]"]
    else:
        cmd += ["-i", bgm, "-filter_complex", f"[0:v]{fade}[v]",
                "-map", "[v]", "-map", "1:a"]
    cmd += ["-t", str(total), "-c:v", "libx264", "-crf", "19", "-preset", "medium",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    print("done:", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--photoreal", action="store_true", help="Higgsfield 실사 이미지 사용")
    ap.add_argument("--voice", action="store_true", help="edge-tts 한국어 나레이션 포함")
    a = ap.parse_args()
    build(a.photoreal, a.voice)
