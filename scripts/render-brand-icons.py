#!/usr/bin/env python3
"""从咕咕嘎嘎头部头像生成运行时、Windows 与 macOS 应用图标。"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


ICON_SIZE = 1024
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ICNS_SIZES = [(16, 16), (32, 32), (128, 128), (256, 256), (512, 512), (1024, 1024)]


def fit_avatar(source):
    bbox = source.getchannel("A").getbbox()
    subject = source.crop(bbox) if bbox else source
    max_width = 884
    max_height = 900
    scale = min(max_width / subject.width, max_height / subject.height)
    return subject.resize(
        (round(subject.width * scale), round(subject.height * scale)),
        Image.Resampling.LANCZOS,
    )


def render_icon(source):
    icon = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)
    draw.rounded_rectangle((28, 28, 996, 996), radius=226, fill=(255, 244, 223, 255))
    draw.rounded_rectangle((44, 44, 980, 980), radius=210, outline=(43, 101, 188, 255), width=26)
    avatar = fit_avatar(source)
    x = (ICON_SIZE - avatar.width) // 2
    y = ICON_SIZE - avatar.height - 34
    icon.alpha_composite(avatar, (x, y))
    return icon


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--assets-output", default=Path("assets/icon.png"), type=Path)
    parser.add_argument("--build-output", default=Path("build"), type=Path)
    args = parser.parse_args()

    avatar = Image.open(args.source).convert("RGBA")
    icon = render_icon(avatar)
    args.assets_output.parent.mkdir(parents=True, exist_ok=True)
    args.build_output.mkdir(parents=True, exist_ok=True)
    icon.save(args.assets_output)
    icon.save(args.build_output / "icon.png")
    icon.save(args.build_output / "icon.ico", sizes=ICO_SIZES)
    icon.save(args.build_output / "icon.icns", sizes=ICNS_SIZES)
    print("Rendered 咕咕嘎嘎 brand icons")


if __name__ == "__main__":
    main()
