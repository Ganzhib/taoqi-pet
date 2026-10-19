"""桌宠动画编码的公共部分：RGBA 帧序列 → 透明 WebM。"""

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

DEFAULT_CRF = 30


def save_webm(frames, path, duration_ms=95, crf=DEFAULT_CRF):
    """把 RGBA 帧序列编码成带 alpha 的 VP9 WebM。

    -pix_fmt yuva420p  保留 alpha 通道
    -auto-alt-ref 0    VP9 带 alpha 时必需，否则 altref 帧会破坏 alpha
    -b:v 0 -crf N      恒定质量模式

    回读校验时注意：ffmpeg 自带的原生 VP9 解码器不还原 alpha，
    必须显式指定 ``-c:v libvpx-vp9``。
    """
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("未找到 ffmpeg，无法编码透明 WebM")
    with tempfile.TemporaryDirectory() as tmp:
        for index, frame in enumerate(frames):
            frame.convert("RGBA").save(Path(tmp) / f"frame_{index:04d}.png")
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-framerate", f"1000/{duration_ms}",
            "-i", str(Path(tmp) / "frame_%04d.png"),
            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
            "-b:v", "0", "-crf", str(crf),
            "-auto-alt-ref", "0", "-row-mt", "1", "-an",
            str(path),
        ], check=True)
    return path


def decode_webm_frame(path, index=0):
    """用 libvpx 解码器取回一帧 RGBA，供对比图使用。"""
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-c:v", "libvpx-vp9", "-i", str(path),
            "-vf", f"select=eq(n\\,{index})", "-vframes", "1",
            "-pix_fmt", "rgba", str(Path(tmp) / "frame.png"),
        ], check=True)
        return Image.open(Path(tmp) / "frame.png").convert("RGBA")
