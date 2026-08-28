#!/usr/bin/env python3
"""Rebuild the transparent home wordmark from the approved social cover.

ImageMagick is used deliberately: the source artwork is authoritative and the
output gets a fixed transparent safety canvas so CSS scaling cannot clip glyphs.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/social/retrowebgames-cover-1280.jpg"
OUT = ROOT / "assets/brand/retrowebgames-wordmark.png"

if not SRC.exists():
    raise SystemExit(f"missing source cover: {SRC}")
if not shutil.which("magick"):
    raise SystemExit("ImageMagick 'magick' is required")

def run(*args):
    subprocess.run(["magick", *map(str, args)], check=True)

with tempfile.TemporaryDirectory(prefix="rwg-wordmark-") as tmp_name:
    tmp = Path(tmp_name)
    crop = tmp / "crop.png"
    alpha = tmp / "alpha.png"
    red, green, blue = (tmp / "red.png", tmp / "green.png", tmp / "blue.png")
    rgba = tmp / "rgba.png"
    final = tmp / "wordmark.png"

    # The wider crop includes the whole final S; edge bands are explicitly
    # excluded from alpha so no source-cover decorations can leak into the logo.
    run(SRC, "-crop", "697x130+420+255", "+repage", crop)
    run(crop, "-colorspace", "Gray", "-threshold", "12%",
        "-morphology", "Open", "Disk:1", "-morphology", "Dilate", "Disk:1",
        "-blur", "0x0.5", "-fill", "black",
        "-draw", "rectangle 0,0 24,129 rectangle 683,0 696,129", alpha)
    for channel, target in (("R", red), ("G", green), ("B", blue)):
        run(crop, "-channel", channel, "-separate", target)
    run(red, green, blue, alpha, "-channel", "RGBA", "-combine", rgba)
    run(rgba, "-trim", "+repage", "-resize", "1450x220!",
        "-gravity", "center", "-background", "none", "-extent", "1600x250", final)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(final, OUT)

print(f"{OUT.relative_to(ROOT)}: 1600x250, complete wordmark with transparent safe area")
