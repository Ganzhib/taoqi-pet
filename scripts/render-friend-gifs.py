#!/usr/bin/env python3
"""Render five original animal friends as small, looping desktop-pet GIFs.

Same visual language as render-cat-gifs.py: INK outlines, CREAM highlights,
soft pastel fills. Every frame keeps a transparent background and shows only
the pet itself - no props, no text, no borders. Each animation is tightened to
the pet's bounding box and re-centered so nothing dangles outside the canvas.
"""

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = (280, 320)
FRAMES = 12
DURATION_MS = 95
FRIENDS = ("kitty", "doggy", "dragon", "bunny", "blob")

INK = (74, 51, 55, 255)
CREAM = (255, 248, 228, 255)
WHITE = (255, 255, 255, 255)
PINK = (247, 176, 197, 255)
BLUSH = (249, 186, 190, 215)
GRAY = (215, 210, 224, 255)
MINT = (166, 224, 200, 255)
MINT_DARK = (128, 199, 172, 255)
BROWN = (226, 165, 118, 255)
LAV = (205, 197, 231, 255)
SPARK = (255, 221, 110, 235)


def dot(draw, cx, cy, r, fill, outline=INK, width=4):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill, outline=outline, width=width)


def poly(draw, points, fill):
    draw.polygon(points, fill=fill)
    draw.line(list(points) + [points[0]], fill=INK, width=4, joint="curve")


def open_eyes(draw, cx, cy, r, gap):
    for dx in (-gap, gap):
        dot(draw, cx + dx, cy, r, INK, outline=None, width=0)
        draw.ellipse((cx + dx - r * 0.45, cy - r * 0.5, cx + dx + r * 0.05, cy + r * 0.15), fill=WHITE)


def happy_eyes(draw, cx, cy, r, gap):
    for dx in (-gap, gap):
        draw.arc((cx + dx - r, cy - r * 0.7, cx + dx + r, cy + r * 0.7), 200, 340, fill=INK, width=6)


def blush(draw, cx, cy, r):
    for dx in (-r * 1.2, r * 1.2):
        draw.ellipse((cx + dx - r * 0.55, cy - r * 0.32, cx + dx + r * 0.55, cy + r * 0.32), fill=BLUSH)


def chain(draw, points, r, fill):
    for x, y in points:
        dot(draw, x, y, r + 4, INK, outline=None, width=0)
    for x, y in points:
        dot(draw, x, y, r, fill, outline=None, width=0)


def tail_points(base_x, base_y, length, phase, amp, reach=58, lift=42):
    points = []
    for index in range(length + 1):
        t = index / length
        points.append((base_x + reach * t + amp * math.sin(phase + t * math.pi),
                       base_y - lift * t))
    return points


def heart(draw, cx, cy, r, fill):
    dot(draw, cx - r * 0.5, cy, r * 0.62, INK, outline=None, width=0)
    dot(draw, cx + r * 0.5, cy, r * 0.62, INK, outline=None, width=0)
    draw.polygon(((cx - r + 1, cy - r * 0.2), (cx + r - 1, cy - r * 0.2), (cx, cy + r)), fill=INK)
    dot(draw, cx - r * 0.5, cy, r * 0.45, fill, outline=None, width=0)
    dot(draw, cx + r * 0.5, cy, r * 0.45, fill, outline=None, width=0)
    draw.polygon(((cx - r + 6, cy - r * 0.25), (cx + r - 6, cy - r * 0.25), (cx, cy + r - 4)), fill=fill)


def draw_kitty(draw, wave, frame):
    dy = int(3 * wave)
    cx, cy = 140, 150 + dy
    chain(draw, tail_points(196, 250 + dy, 6, wave * math.pi / 2, 12), 13, GRAY)
    draw.ellipse((cx - 55, 195 + dy, cx + 55, 305 + dy), fill=CREAM, outline=INK, width=4)
    dot(draw, cx - 30, 292 + dy, 16, CREAM)
    dot(draw, cx + 30, 292 + dy, 16, CREAM)
    poly(draw, ((cx - 62, cy - 38), (cx - 40, cy - 95), (cx - 12, cy - 55)), GRAY)
    poly(draw, ((cx + 62, cy - 38), (cx + 40, cy - 95), (cx + 12, cy - 55)), GRAY)
    poly(draw, ((cx - 52, cy - 46), (cx - 40, cy - 78), (cx - 24, cy - 54)), PINK)
    poly(draw, ((cx + 52, cy - 46), (cx + 40, cy - 78), (cx + 24, cy - 54)), PINK)
    dot(draw, cx, cy, 68, GRAY)
    draw.ellipse((cx - 30, cy + 18, cx + 30, cy + 52), fill=CREAM, outline=INK, width=3)
    if frame in (5, 6):
        happy_eyes(draw, cx, cy - 6, 12, 26)
    else:
        open_eyes(draw, cx, cy - 6, 11, 26)
    blush(draw, cx, cy + 18, 22)
    draw.polygon(((cx - 6, cy + 26), (cx + 6, cy + 26), (cx, cy + 34)), fill=INK)
    draw.arc((cx - 14, cy + 32, cx, cy + 46), 20, 160, fill=INK, width=3)
    draw.arc((cx, cy + 32, cx + 14, cy + 46), 20, 160, fill=INK, width=3)


def draw_doggy(draw, wave, frame):
    dy = int(4 * wave)
    cx, cy = 140, 150 + dy
    chain(draw, tail_points(200, 255 + dy, 6, wave * math.pi, 16), 13, BROWN)
    draw.ellipse((cx - 58, 200 + dy, cx + 58, 308 + dy), fill=CREAM, outline=INK, width=4)
    dot(draw, cx - 34, 296 + dy, 15, CREAM)
    dot(draw, cx + 34, 296 + dy, 15, CREAM)
    poly(draw, ((cx - 58, cy - 28), (cx - 44, cy - 100), (cx - 10, cy - 52)), BROWN)
    poly(draw, ((cx + 58, cy - 28), (cx + 44, cy - 100), (cx + 10, cy - 52)), BROWN)
    dot(draw, cx, cy, 64, CREAM)
    dot(draw, cx - 58, cy + 18, 20, CREAM)
    dot(draw, cx + 58, cy + 18, 20, CREAM)
    open_eyes(draw, cx, cy - 8, 9, 24)
    draw.ellipse((cx - 28, cy + 12, cx + 28, cy + 44), fill=CREAM, outline=INK, width=3)
    draw.ellipse((cx - 9, cy + 16, cx + 9, cy + 30), fill=INK)
    pant = int(3 * wave)
    draw.ellipse((cx - 12, cy + 30, cx + 12, cy + 44 + pant), fill=INK)
    draw.ellipse((cx - 7, cy + 34, cx + 7, cy + 42 + pant), fill=PINK)
    blush(draw, cx, cy + 26, 20)


def draw_dragon(draw, wave, frame):
    hover = int(5 * wave)
    cx, cy = 140, 150 + hover
    flap = int(10 * math.sin(frame * math.tau / FRAMES))
    for side in (-1, 1):
        poly(draw, ((cx + side * 42, cy - 5), (cx + side * 88, cy - 45 - flap),
                    (cx + side * 62, cy + 42)), MINT_DARK)
    tail = tail_points(180, 245 + hover, 5, wave * math.pi / 2, 8, reach=46, lift=38)
    chain(draw, tail, 12, MINT)
    heart(draw, tail[-1][0], tail[-1][1], 11, PINK)
    draw.ellipse((cx - 55, 185 + hover, cx + 55, 300 + hover), fill=MINT, outline=INK, width=4)
    draw.ellipse((cx - 28, 215 + hover, cx + 28, 285 + hover), fill=CREAM, outline=INK, width=3)
    for index, bx in enumerate((cx - 30, cx, cx + 30)):
        poly(draw, ((bx - 12, 197 + hover - index * 4), (bx + 12, 197 + hover - index * 4),
                    (bx, 172 + hover - index * 6)), MINT_DARK)
    dot(draw, cx, cy, 60, MINT)
    poly(draw, ((cx - 40, cy - 42), (cx - 34, cy - 78), (cx - 20, cy - 46)), CREAM)
    poly(draw, ((cx + 40, cy - 42), (cx + 34, cy - 78), (cx + 20, cy - 46)), CREAM)
    draw.ellipse((cx - 26, cy + 8, cx + 26, cy + 40), fill=MINT_DARK, outline=INK, width=3)
    dot(draw, cx - 10, cy + 18, 3, INK, outline=None, width=0)
    dot(draw, cx + 10, cy + 18, 3, INK, outline=None, width=0)
    draw.arc((cx - 12, cy + 22, cx + 12, cy + 40), 20, 160, fill=INK, width=3)
    open_eyes(draw, cx, cy - 10, 10, 22)
    blush(draw, cx, cy + 2, 18)


def draw_bunny(draw, wave, frame):
    hop = int(6 * wave)
    cx, cy = 140, 155 + hop
    sway = 5 * math.sin(frame * math.tau / FRAMES + 1)
    for side, ex in ((-1, cx - 24), (1, cx + 24)):
        lean = int(sway * side)
        draw.ellipse((ex - 16 + lean, 8 + hop, ex + 16 + lean, 118 + hop), fill=WHITE, outline=INK, width=4)
        draw.ellipse((ex - 7 + lean, 26 + hop, ex + 7 + lean, 100 + hop), fill=PINK)
    dot(draw, 78, 255 + hop, 18, CREAM)
    draw.ellipse((cx - 50, 200 + hop, cx + 50, 302 + hop), fill=WHITE, outline=INK, width=4)
    dot(draw, cx - 28, 292 + hop, 14, CREAM)
    dot(draw, cx + 28, 292 + hop, 14, CREAM)
    dot(draw, cx, cy, 58, WHITE)
    open_eyes(draw, cx, cy - 6, 8, 21)
    draw.ellipse((cx - 6, cy + 14, cx + 6, cy + 24), fill=PINK, outline=INK, width=2)
    draw.arc((cx - 10, cy + 20, cx, cy + 32), 20, 160, fill=INK, width=3)
    draw.arc((cx, cy + 20, cx + 10, cy + 32), 20, 160, fill=INK, width=3)
    draw.rectangle((cx - 6, cy + 30, cx + 6, cy + 40), fill=WHITE, outline=INK, width=2)
    draw.line((cx, cy + 30, cx, cy + 40), fill=INK, width=2)
    blush(draw, cx, cy + 18, 18)


def draw_blob(draw, wave, frame):
    squish = int(9 * wave)
    cx, bottom = 140, 300
    w, h = 66 + squish, 96 - squish
    top = bottom - 2 * h
    dot(draw, cx - w - 8, top + h + 26, 13, LAV)
    dot(draw, cx + w + 8, top + h + 26, 13, LAV)
    draw.rounded_rectangle((cx - w, top, cx + w, bottom), radius=70, fill=LAV, outline=INK, width=4)
    happy_eyes(draw, cx, top + 62, 11, 26)
    blush(draw, cx, top + 84, 22)
    pant = int(3 * wave)
    draw.ellipse((cx - 11, top + 88, cx + 11, top + 106 + pant), fill=INK)
    poly(draw, ((cx, top - 20), (cx + 30, top - 46), (cx + 16, top + 2)), MINT)
    draw.line(((cx, top - 20), (cx + 20, top - 32)), fill=INK, width=3)
    if frame % 6 < 3:
        sx, sy = cx + w + 6, top - 18
        r = 4 + frame % 3
        draw.ellipse((sx - r, sy - r, sx + r, sy + r), fill=SPARK)


DRAWERS = {"kitty": draw_kitty, "doggy": draw_doggy, "dragon": draw_dragon,
           "bunny": draw_bunny, "blob": draw_blob}


def raw_frame(friend, frame):
    canvas = Image.new("RGBA", SIZE)
    draw = ImageDraw.Draw(canvas, "RGBA")
    wave = math.sin(frame * math.tau / FRAMES)
    DRAWERS[friend](draw, wave, frame)
    return canvas


def union_box(frames):
    left, top, right, bottom = SIZE[0], SIZE[1], 0, 0
    for frame in frames:
        box = frame.getbbox()
        if not box:
            continue
        left, top = min(left, box[0]), min(top, box[1])
        right, bottom = max(right, box[2]), max(bottom, box[3])
    pad = 8
    return (max(0, left - pad), max(0, top - pad),
            min(SIZE[0], right + pad), min(SIZE[1], bottom + pad))


def tighten(frames):
    box = union_box(frames)
    width, height = box[2] - box[0], box[3] - box[1]
    offset = ((SIZE[0] - width) // 2 - box[0], (SIZE[1] - height) // 2 - box[1])
    tightened = []
    for frame in frames:
        canvas = Image.new("RGBA", SIZE)
        canvas.alpha_composite(frame, offset)
        tightened.append(canvas)
    return tightened


def gif_palette(frame):
    palette = frame.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    alpha = frame.getchannel("A")
    pixels = palette.load()
    mask = alpha.load()
    for y in range(frame.height):
        for x in range(frame.width):
            if mask[x, y] < 128:
                pixels[x, y] = 255
    colors = palette.getpalette()
    colors[255 * 3:255 * 3 + 3] = [0, 0, 0]
    palette.putpalette(colors)
    return palette


def render_friend(friend, output):
    frames = tighten([raw_frame(friend, index) for index in range(FRAMES)])
    palettes = [gif_palette(frame) for frame in frames]
    palettes[0].save(output / (friend + "-idle.gif"), save_all=True,
                     append_images=palettes[1:], duration=DURATION_MS,
                     loop=0, disposal=2, transparency=255, optimize=False)
    return output / (friend + "-idle.gif")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for friend in FRIENDS:
        render_friend(friend, args.output)
        print("rendered", friend + "-idle.gif")
    print("Rendered", len(FRIENDS), "friend GIFs in", args.output)


if __name__ == "__main__":
    main()
