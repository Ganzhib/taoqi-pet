#!/usr/bin/env python3
"""Render the supplied CatBuddy cutout as eight small, looping desktop-pet GIFs."""

import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = (280, 320)
FRAMES = 12
DURATION_MS = 95
STATES = ("idle", "study", "work", "coffee", "debug", "slack", "nap", "cheer")
INK = (74, 51, 55, 255)
CREAM = (255, 248, 228, 255)
ORANGE = (244, 164, 88, 255)


def rounded(draw, box, fill, radius=12, width=4):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=INK, width=width)


def render_props(canvas, state, frame):
    draw = ImageDraw.Draw(canvas, "RGBA")
    wave = math.sin(frame * math.tau / FRAMES)
    if state == "idle":
        for x, y, offset in ((36, 86, 0), (241, 116, 3), (222, 34, 7)):
            glow = 5 + 2 * math.sin((frame + offset) * math.tau / FRAMES)
            draw.ellipse((x-glow, y-glow, x+glow, y+glow), fill=(255, 207, 97, 230))
            draw.line((x-12, y, x+12, y), fill=INK, width=2)
            draw.line((x, y-12, x, y+12), fill=INK, width=2)
    elif state == "study":
        rounded(draw, (37, 259, 243, 306), CREAM, 9)
        draw.line((140, 262, 140, 303), fill=INK, width=3)
        for y in (272, 282, 292):
            draw.line((53, y, 120, y), fill=(153, 129, 151, 255), width=2)
            draw.line((158, y, 225, y), fill=(153, 129, 151, 255), width=2)
        x = 173 + 8 * wave
        draw.line((x, 250, x+20, 279), fill=(233, 149, 57, 255), width=7)
        draw.polygon(((x+20,279),(x+13,275),(x+18,285)), fill=INK)
        draw.ellipse((225, 50, 245, 70), fill=(255, 225, 117, 220))
    elif state == "work":
        rounded(draw, (30, 240, 250, 295), (173, 197, 213, 255), 9)
        draw.polygon(((40,238),(240,238),(217,194),(63,194)), fill=(202, 218, 228, 255))
        draw.line((63,194,217,194,240,238,40,238,63,194), fill=INK, width=4, joint="curve")
        draw.ellipse((130, 207, 150, 227), fill=(245, 188, 116, 255))
        for x, y in ((41,75),(231,88)):
            dy = 7 * wave
            draw.ellipse((x, y+dy, x+12, y+20+dy), fill=(99, 188, 226, 220))
        draw.rectangle((226, 257, 237, 275), fill=(222, 89, 78, 255))
    elif state == "coffee":
        rounded(draw, (163, 221, 244, 296), (245, 230, 194, 255), 18)
        draw.arc((218, 232, 264, 279), 270, 90, fill=INK, width=7)
        draw.ellipse((167, 217, 240, 230), fill=(93, 61, 45, 255))
        for x in (185, 211):
            dy = 5 * wave
            draw.arc((x, 180+dy, x+20, 219+dy), 70, 270, fill=(175, 170, 161, 230), width=3)
        draw.ellipse((39, 81, 50, 99), fill=(99, 188, 226, 215))
    elif state == "debug":
        rounded(draw, (46, 246, 230, 299), (220, 230, 236, 255), 10)
        draw.rectangle((57, 255, 220, 286), fill=(81, 75, 105, 255))
        x = 132 + 8 * wave
        draw.ellipse((x-13, 257, x+13, 282), fill=(223, 87, 86, 255), outline=CREAM, width=2)
        draw.line((x, 258, x, 281), fill=INK, width=3)
        draw.line((x-24, 264, x+24, 264), fill=INK, width=2)
        draw.line((x-24, 276, x+24, 276), fill=INK, width=2)
        rounded(draw, (217, 52, 249, 104), (255, 221, 110, 255), 11)
        draw.line((233, 64, 233, 84), fill=INK, width=5)
        draw.ellipse((230, 90, 236, 96), fill=INK)
    elif state == "slack":
        draw.ellipse((34, 262, 250, 304), fill=(241, 187, 128, 230), outline=INK, width=4)
        x = 183 + 11 * wave
        y = 242 + 5 * wave
        draw.ellipse((x-25,y-10,x+20,y+11), fill=(125, 178, 203, 255), outline=INK, width=3)
        draw.polygon(((x+18,y),(x+39,y-14),(x+39,y+14)), fill=(125, 178, 203, 255))
        draw.ellipse((x-15,y-3,x-10,y+2), fill=INK)
        for bx, by in ((207,90),(228,62),(246,42)):
            r = 3 + (frame % 3)
            draw.ellipse((bx-r,by-r,bx+r,by+r), outline=(150, 204, 230, 230), width=2)
    elif state == "nap":
        draw.ellipse((34, 265, 247, 309), fill=(213, 183, 223, 255), outline=INK, width=4)
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 30)
        for index, (x,y) in enumerate(((194,77),(218,48),(238,25))):
            dy = int(5 * math.sin((frame+index*3)*math.tau/FRAMES))
            draw.text((x,y+dy), "Z", font=font, fill=(126, 115, 176, 255), stroke_width=1, stroke_fill=INK)
        draw.arc((27, 36, 80, 88), 30, 280, fill=(255, 211, 102, 255), width=8)
    elif state == "cheer":
        for index in range(15):
            x = 23 + (index*57) % 239
            y = 26 + (index*83 + frame*11) % 235
            color = ((246, 117, 131, 230), (111, 191, 164, 230), (255, 209, 96, 230))[index % 3]
            draw.rectangle((x,y,x+6,y+10), fill=color)
        rounded(draw, (103, 264, 174, 303), (255, 225, 113, 255), 13)
        draw.polygon(((115, 268),(120, 248),(130, 267)), fill=(255, 225, 113, 255))
        draw.polygon(((145, 267),(151, 248),(160, 268)), fill=(255, 225, 113, 255))


def gif_frame(source, state, frame):
    canvas = Image.new("RGBA", SIZE)
    angle = 2.5 * math.sin(frame * math.tau / FRAMES)
    bounce = int(3 * math.sin(frame * math.tau / FRAMES))
    cat = source.resize((246, 246), Image.Resampling.LANCZOS).rotate(
        angle, Image.Resampling.BICUBIC, expand=False
    )
    canvas.alpha_composite(cat, (17, 25 + bounce))
    render_props(canvas, state, frame)
    return canvas


def gif_palette(frame):
    # GIF has one-bit alpha; reserve palette index 255 for transparent pixels.
    palette = frame.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    alpha = frame.getchannel("A")
    pixels = palette.load()
    mask = alpha.load()
    for y in range(frame.height):
        for x in range(frame.width):
            if mask[x, y] < 128:
                pixels[x, y] = 255
    colors = palette.getpalette()
    colors[255*3:255*3+3] = [0, 0, 0]
    palette.putpalette(colors)
    return palette


def render_icon(source, output):
    icon = Image.new("RGBA", (1024, 1024))
    draw = ImageDraw.Draw(icon)
    draw.rounded_rectangle((32, 32, 992, 992), radius=225, fill=(255, 243, 217, 255))
    draw.rounded_rectangle((33, 33, 991, 991), radius=225, outline=(214, 137, 74, 255), width=32)
    cat = source.resize((890, 890), Image.Resampling.LANCZOS)
    icon.alpha_composite(cat, (67, 67))
    icon.save(output / "icon.png")
    icon.save(output / "icon.ico", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
    iconset = output / "icon.iconset"
    iconset.mkdir(exist_ok=True)
    for size in (16, 32, 128, 256, 512):
        icon.resize((size,size), Image.Resampling.LANCZOS).save(iconset / f"icon_{size}x{size}.png")
        icon.resize((size*2,size*2), Image.Resampling.LANCZOS).save(iconset / f"icon_{size}x{size}@2x.png")
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(output / "icon.icns")], check=True)
    for file in iconset.iterdir():
        file.unlink()
    iconset.rmdir()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    source = Image.open(args.source).convert("RGBA")
    for state in STATES:
        frames = [gif_palette(gif_frame(source, state, index)) for index in range(FRAMES)]
        frames[0].save(args.output / f"cat-{state}.gif", save_all=True,
                       append_images=frames[1:], duration=DURATION_MS,
                       loop=0, disposal=2, transparency=255, optimize=False)
    render_icon(source, args.output)
    print("Rendered", len(STATES), "GIFs and app icons in", args.output)


if __name__ == "__main__":
    main()
