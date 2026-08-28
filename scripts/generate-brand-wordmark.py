#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/social/retrowebgames-cover-1280.jpg'
OUT = ROOT / 'assets/brand/retrowebgames-wordmark.png'

image = Image.open(SRC).convert('RGB')
w, h = image.size
# Approved cover crop: x=510..1300 / y=325..445 on original 1536x807 artwork.
sx, sy = w / 1536.0, h / 807.0
box = (round(510*sx), round(325*sy), round(1300*sx), round(445*sy))
crop = image.crop(box).convert('RGB')
rgb = np.asarray(crop, dtype=np.float32)
mx = rgb.max(axis=2)
mn = rgb.min(axis=2)
chroma = mx - mn
luma = .2126*rgb[:, :, 0] + .7152*rgb[:, :, 1] + .0722*rgb[:, :, 2]

# Bright cyan/pink/gold lettering is kept; the dark social-cover rectangle is removed.
seed = (((mx > 70) & ((chroma > 17) | (luma > 102))).astype(np.uint8) * 255)
seed_img = Image.fromarray(seed, 'L')
near1 = np.asarray(seed_img.filter(ImageFilter.MaxFilter(3)), dtype=np.uint8)
near2 = np.asarray(seed_img.filter(ImageFilter.MaxFilter(5)), dtype=np.uint8)
alpha = np.zeros_like(seed, dtype=np.uint8)
alpha[near2 > 0] = 58
alpha[near1 > 0] = 155
alpha[seed > 0] = 255
soft = np.clip((mx - 29) / 50, 0, 1)
alpha = np.maximum((alpha.astype(np.float32) * soft).astype(np.uint8), (seed > 0).astype(np.uint8) * 220)
alpha_img = Image.fromarray(alpha, 'L').filter(ImageFilter.GaussianBlur(.42))

rgba = crop.convert('RGBA')
rgba.putalpha(alpha_img)
bbox = rgba.getbbox()
if not bbox:
    raise SystemExit('wordmark segmentation produced an empty image')
rgba = rgba.crop(bbox)

# Fixed transparent canvas gives stable intrinsic dimensions while CSS uses contain.
canvas_w, canvas_h = 1600, 250
safe_w, safe_h = 1550, 220
scale = min(safe_w / rgba.width, safe_h / rgba.height)
rw, rh = max(1, round(rgba.width*scale)), max(1, round(rgba.height*scale))
rgba = rgba.resize((rw, rh), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
canvas.alpha_composite(rgba, ((canvas_w-rw)//2, (canvas_h-rh)//2))
OUT.parent.mkdir(parents=True, exist_ok=True)
canvas.save(OUT, optimize=True, compress_level=9)
print(f'{OUT.relative_to(ROOT)}: {canvas.size[0]}x{canvas.size[1]}, {OUT.stat().st_size} bytes; source={image.size}, crop={box}')
