#!/usr/bin/env python3
"""把静态插画或逐帧精灵表转成桌宠动图。

抠图走「已知背景的 matting」：先按与背景色的距离估出软 alpha，
再反解前景色（unpremultiply），最后只保留最大的连通区域，
顺手去掉文字、装饰点这类孤立元素。

同一个角色会同时输出两种格式，用于兼顾透明通道质量和降级播放：

  <id>-idle.gif   GIF，1 bit 透明 + 256 色 —— 现状基线
  <id>-idle.webm  VP9，8 bit 软透明 + 24 bit 色 —— 运行时主素材

用法：
  python3 scripts/render-pet-from-image.py \\
      --source assets/source/penguin-reference.png --id penguin \\
      --output /tmp/out --canvas 280x320

逐帧表用法：
  python3 scripts/render-pet-from-image.py \\
      --source assets/source/gugugaga-spritesheet.png --id gugugaga \\
      --sprite-grid 3x3 --output assets/pets
"""

import argparse
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

from pet_animation import decode_webm_frame, save_webm

FRAMES = 12
DURATION_MS = 95

# 与背景色的 RGB 欧氏距离：低于 LOW 视为确定背景，高于 HIGH 视为确定前景
ALPHA_LOW = 10.0
ALPHA_HIGH = 46.0

# 连通区域判定：alpha 高于该值才算前景，再向外膨胀覆盖软边缘
COMPONENT_THRESHOLD = 96
COMPONENT_DILATE = 5
# 轮廓内侧多少像素内强制不透明
CORE_INSET = 3


def load_reference(path):
    return Image.open(path).convert("RGBA")


def reference_cutout(image):
    """优先保留输入图自带的透明通道，否则再按背景色抠图。

    图像生成工具导出的 PNG 已经带软 alpha；如果继续按边缘颜色估背景，
    深色头发会被误判成背景。透明输入只清理主体外的残余光晕，不重新
    估色，也不改写人物内部的颜色。
    """
    alpha = image.getchannel("A")
    if alpha.getextrema()[0] < 255:
        subject_mask = largest_component_alpha(image)
        cut = image.copy()
        cut.putalpha(ImageChops.multiply(alpha, subject_mask))
        return cut, None

    background = estimate_background(image)
    cut = matte(image, background)
    cut.putalpha(refine_alpha(cut.getchannel("A"), largest_component_alpha(cut)))
    return cut, background


def estimate_background(image):
    """取四条边的中位数颜色作为背景色估计。"""
    width, height = image.size
    pixels = image.load()
    samples = []
    for x in range(width):
        samples.append(pixels[x, 0])
        samples.append(pixels[x, height - 1])
    for y in range(height):
        samples.append(pixels[0, y])
        samples.append(pixels[width - 1, y])
    channels = list(zip(*[pixel[:3] for pixel in samples]))
    return tuple(sorted(channel)[len(channel) // 2] for channel in channels)


def distance(color, background):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(color[:3], background)))


def matte(image, background):
    """按与背景色的距离估软 alpha，并反解前景色。"""
    width, height = image.size
    source = image.load()
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    target = out.load()
    span = ALPHA_HIGH - ALPHA_LOW

    for y in range(height):
        for x in range(width):
            pixel = source[x, y]
            delta = distance(pixel, background)
            if delta <= ALPHA_LOW:
                # 只清零 alpha，保留原色：角色内部的浅色区域（白肚皮、眼白）
                # 会在这里被判成背景，但随后 refine_alpha 会把它们恢复成不透明，
                # 那时必须拿得到正确的 RGB，否则就会变成黑块。
                target[x, y] = (pixel[0], pixel[1], pixel[2], 0)
                continue
            if delta >= ALPHA_HIGH:
                target[x, y] = (pixel[0], pixel[1], pixel[2], 255)
                continue
            alpha = (delta - ALPHA_LOW) / span
            # 反解：观测色 = alpha * 前景 + (1 - alpha) * 背景
            foreground = tuple(
                max(0, min(255, round((pixel[i] - (1.0 - alpha) * background[i]) / alpha)))
                for i in range(3)
            )
            target[x, y] = foreground + (round(alpha * 255),)
    return out


def largest_component_alpha(image):
    """只保留最大的前景连通区域，去掉孤立的文字与装饰。"""
    width, height = image.size
    alpha = image.getchannel("A")
    pixels = alpha.load()
    seen = bytearray(width * height)
    best = []
    best_size = 0

    for start_y in range(height):
        for start_x in range(width):
            index = start_y * width + start_x
            if seen[index] or pixels[start_x, start_y] < COMPONENT_THRESHOLD:
                continue
            queue = deque([(start_x, start_y)])
            seen[index] = 1
            component = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for next_x, next_y in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= next_x < width and 0 <= next_y < height:
                        next_index = next_y * width + next_x
                        if not seen[next_index] and pixels[next_x, next_y] >= COMPONENT_THRESHOLD:
                            seen[next_index] = 1
                            queue.append((next_x, next_y))
            if len(component) > best_size:
                best_size = len(component)
                best = component

    mask = Image.new("L", (width, height), 0)
    mask_pixels = mask.load()
    for x, y in best:
        mask_pixels[x, y] = 255
    if COMPONENT_DILATE > 1:
        mask = mask.filter(ImageFilter.MaxFilter(COMPONENT_DILATE))
    return fill_holes(mask)


def fill_holes(mask):
    """从画布边界洪水填充外部背景，没被淹到的空腔就是角色内部。

    没有这一步，角色身上的浅色区域（眼白、高光、白肚皮）会因为接近
    背景色而被判成半透明，叠在深色底上就是一块块灰斑。
    """
    width, height = mask.size
    pixels = mask.load()
    outside = bytearray(width * height)
    queue = deque()

    def seed(x, y):
        if pixels[x, y] == 0 and not outside[y * width + x]:
            outside[y * width + x] = 1
            queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for next_x, next_y in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                index = next_y * width + next_x
                if not outside[index] and pixels[next_x, next_y] == 0:
                    outside[index] = 1
                    queue.append((next_x, next_y))

    filled = Image.new("L", (width, height), 0)
    filled_pixels = filled.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if pixels[x, y] or not outside[row + x]:
                filled_pixels[x, y] = 255
    return filled


def refine_alpha(soft, solid):
    """轮廓边界用软 alpha，内部一律不透明。

    solid 内缩一圈得到 core，core 区域强制 255；外圈保留 matte 算出的
    过渡值，这样发丝、光晕是渐变的，身体是实的。
    """
    core = solid.filter(ImageFilter.MinFilter(CORE_INSET * 2 + 1))
    kept = ImageChops.multiply(soft, solid)
    return ImageChops.lighter(kept, core)


def tight_bbox(image):
    box = image.getchannel("A").getbbox()
    return image.crop(box) if box else image


def fit_canvas(image, canvas):
    """等比缩放到画布内，水平居中、底部对齐。"""
    width, height = canvas
    scale = min(width / image.width, height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    resized = image.resize(size, Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", canvas, (0, 0, 0, 0))
    frame.paste(resized, ((width - size[0]) // 2, height - size[1]), resized)
    return frame


def sprite_frames(image, grid, canvas):
    """把规则精灵表切为等比例、同基线的逐帧动画。

    每格先独立清除生成图周围的彩色残影，再以整组动作的最大轮廓确定
    唯一缩放比例。这样挥手、迈步和伸懒腰不会被逐帧强行缩放成同一
    外接框，肢体动作的幅度可以完整保留。
    """
    columns, rows = (int(part) for part in grid.lower().split("x"))
    if columns < 1 or rows < 1:
        raise ValueError("sprite grid must contain positive columns and rows")

    cells = []
    for row in range(rows):
        top = round(row * image.height / rows)
        bottom = round((row + 1) * image.height / rows)
        for column in range(columns):
            left = round(column * image.width / columns)
            right = round((column + 1) * image.width / columns)
            cell = image.crop((left, top, right, bottom))
            cut, _ = reference_cutout(cell)
            cells.append(tight_bbox(cut))

    max_width = max(cell.width for cell in cells)
    max_height = max(cell.height for cell in cells)
    target_width, target_height = canvas
    scale = min(target_width / max_width, target_height / max_height) * 0.96
    frames = []
    for cell in cells:
        size = (
            max(1, round(cell.width * scale)),
            max(1, round(cell.height * scale)),
        )
        resized = cell.resize(size, Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", canvas, (0, 0, 0, 0))
        frame.paste(
            resized,
            ((target_width - size[0]) // 2, target_height - size[1]),
            resized,
        )
        frames.append(frame)
    return frames


def idle_frames(subject, canvas):
    """12 帧无缝呼吸：缩放与位移都由 sin(2πt) 驱动，首尾自动衔接。"""
    frames = []
    width, height = canvas
    for index in range(FRAMES):
        phase = 2 * math.pi * index / FRAMES
        breath = math.sin(phase)
        scale_x = 1.0 + 0.010 * breath
        scale_y = 1.0 - 0.020 * breath
        size = (max(1, round(subject.width * scale_x)), max(1, round(subject.height * scale_y)))
        scaled = subject.resize(size, Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", canvas, (0, 0, 0, 0))
        x = (width - size[0]) // 2
        y = height - size[1] + round(2 * breath)
        frame.paste(scaled, (x, y), scaled)
        frames.append(frame)
    return frames


def to_gif_frame(rgba):
    """GIF 只有 1 bit 透明：alpha 按 128 二值化，透明像素固定映射到索引 255。"""
    alpha = rgba.getchannel("A")
    palette = rgba.convert("RGB").convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
    pixels = palette.load()
    alpha_pixels = alpha.load()
    width, height = palette.size
    for y in range(height):
        for x in range(width):
            if alpha_pixels[x, y] < 128:
                pixels[x, y] = 255
    colors = palette.getpalette()
    colors[255 * 3:255 * 3 + 3] = [0, 0, 0]
    palette.putpalette(colors)
    return palette


def save_gif(frames, path):
    palettes = [to_gif_frame(frame) for frame in frames]
    palettes[0].save(
        path, save_all=True, append_images=palettes[1:], duration=DURATION_MS,
        loop=0, disposal=2, transparency=255, optimize=False,
    )


def gif_roundtrip(rgba):
    """把 RGBA 按 GIF 的口径走一圈，用来直观对比 1 bit 透明的损失。"""
    palette = to_gif_frame(rgba)
    palette.info["transparency"] = 255
    return palette.convert("RGBA")


def contact_sheet(gif_frame, target_frame, path, zoom_box=(28, 58, 128, 158), zoom=3):
    """把 GIF 与新格式分别叠到深/浅背景上，再放大一块边缘区域，用于肉眼验收。"""
    width, height = target_frame.size
    tiles = []
    for background in ((17, 17, 17, 255), (245, 245, 245, 255)):
        for frame in (gif_frame, target_frame):
            tile = Image.new("RGBA", (width, height), background)
            tile.alpha_composite(frame)
            tiles.append(tile)
    row_a = Image.new("RGBA", (width * 2, height))
    row_a.paste(tiles[0], (0, 0))
    row_a.paste(tiles[1], (width, 0))
    row_b = Image.new("RGBA", (width * 2, height))
    row_b.paste(tiles[2], (0, 0))
    row_b.paste(tiles[3], (width, 0))

    sheet = Image.new("RGBA", (width * 2, height * 2))
    sheet.paste(row_a, (0, 0))
    sheet.paste(row_b, (0, height))

    crops = []
    for tile in tiles:
        crop = tile.crop(zoom_box)
        crops.append(crop.resize((crop.width * zoom, crop.height * zoom), Image.Resampling.NEAREST))
    crop_w, crop_h = crops[0].size
    zoom_sheet = Image.new("RGBA", (crop_w * 2, crop_h * 2))
    zoom_sheet.paste(crops[0], (0, 0))
    zoom_sheet.paste(crops[1], (crop_w, 0))
    zoom_sheet.paste(crops[2], (0, crop_h))
    zoom_sheet.paste(crops[3], (crop_w, crop_h))

    combined = Image.new("RGBA", (max(sheet.width, zoom_sheet.width),
                                   sheet.height + zoom_sheet.height), (255, 255, 255, 255))
    combined.paste(sheet, (0, 0))
    combined.paste(zoom_sheet, (0, sheet.height))
    combined.save(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--id", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--canvas", default="280x320")
    parser.add_argument("--crf", type=int, default=30, help="VP9 恒定质量参数，越大体积越小")
    parser.add_argument(
        "--sprite-grid",
        metavar="COLSxROWS",
        help="把输入作为规则逐帧表切分，例如 3x3；省略时生成呼吸待机动画",
    )
    parser.add_argument(
        "--exact-id",
        action="store_true",
        help="直接用角色 ID 作为文件名；换装形态用它避免被识别成独立 idle 角色",
    )
    parser.add_argument("--preview", action="store_true", help="额外输出边缘对比图")
    args = parser.parse_args()

    width, height = (int(part) for part in args.canvas.lower().split("x"))
    canvas = (width, height)

    reference = load_reference(args.source)
    if args.sprite_grid:
        frames = sprite_frames(reference, args.sprite_grid, canvas)
        cut = reference
        background = None
    else:
        cut, background = reference_cutout(reference)
        cut = tight_bbox(cut)
        subject = fit_canvas(cut, canvas)
        frames = idle_frames(subject, canvas)

    args.output.mkdir(parents=True, exist_ok=True)
    output_id = args.id if args.exact_id else f"{args.id}-idle"
    gif_path = args.output / f"{output_id}.gif"
    webm_path = args.output / f"{output_id}.webm"
    save_gif(frames, gif_path)
    try:
        save_webm(frames, webm_path, DURATION_MS, args.crf)
    except RuntimeError as error:
        print("跳过 WebM:", error)

    gif_size = gif_path.stat().st_size
    if background is None:
        print("输入透明通道: 已保留并清理主体外残余")
    else:
        print("背景色估计:", background)
    if args.sprite_grid:
        print(f"逐帧表: {args.sprite_grid}，共 {len(frames)} 帧")
    else:
        print("裁切后尺寸:", cut.size)
    print(f"GIF  : {gif_path.name}  {gif_size/1024:.1f} KB")
    if webm_path.exists():
        webm_size = webm_path.stat().st_size
        print(f"WebM : {webm_path.name}  {webm_size/1024:.1f} KB  "
              f"(-{100 - webm_size * 100 / gif_size:.0f}%)")

        if args.preview:
            preview = args.output / f"{output_id}-compare.png"
            contact_sheet(gif_roundtrip(frames[0]), decode_webm_frame(webm_path), preview)
            print("对比图:", preview)


if __name__ == "__main__":
    main()
