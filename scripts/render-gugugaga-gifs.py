#!/usr/bin/env python3
"""从九张咕咕嘎嘎透明母版批量生成桌宠 GIF 与 WebM。"""

import argparse
import subprocess
import sys
from pathlib import Path


VARIANTS = {
    "gugugaga": "gugugaga-spritesheet.png",
    "gugugaga-beanie": "gugugaga-beanie-spritesheet.png",
    "gugugaga-pajamas": "gugugaga-pajamas-spritesheet.png",
    "gugugaga-overalls": "gugugaga-overalls-spritesheet.png",
    "gugugaga-happy": "gugugaga-happy-spritesheet.png",
    "gugugaga-worker": "gugugaga-worker-spritesheet.png",
    "gugugaga-prayer": "gugugaga-prayer-spritesheet.png",
    "gugugaga-daydream": "gugugaga-daydream-spritesheet.png",
    "gugugaga-cat": "gugugaga-cat-spritesheet.png",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="assets/source", type=Path)
    parser.add_argument("--output", default="assets/pets", type=Path)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    renderer = Path(__file__).with_name("render-pet-from-image.py")
    for pet_id, filename in VARIANTS.items():
        command = [
            sys.executable,
            str(renderer),
            "--source", str(args.source / filename),
            "--id", pet_id,
            "--output", str(args.output),
            "--sprite-grid", "3x3",
        ]
        if pet_id != "gugugaga":
            command.append("--exact-id")
        if args.preview:
            command.append("--preview")
        subprocess.run(command, check=True)
    print(f"Rendered {len(VARIANTS)} gugugaga variants in {args.output}")


if __name__ == "__main__":
    main()
