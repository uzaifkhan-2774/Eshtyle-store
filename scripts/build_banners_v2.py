"""Rebuild the homepage banners from the owner's 20-Oct-2026 catalogue photos (products that are on sale now).
Usage: python3 -I scripts/build_banners_v2.py "<ESHTYLE Catalogue folder>" <repo_root>"""
import sys, os
from PIL import Image, ImageOps
SRC, REPO = sys.argv[1], sys.argv[2]
OUT = os.path.join(REPO, 'backend/uploads/seed/banners'); os.makedirs(OUT, exist_ok=True)
EXT = (".jpg", ".jpeg", ".png", ".jfif", ".webp")
def pick(folder, i):
    fs = sorted(f for f in os.listdir(os.path.join(SRC, folder)) if f.lower().endswith(EXT)); return os.path.join(SRC, folder, fs[i])
def crop(path, w, h, fx=0.5, fy=0.4):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB'); W, H = im.size; t = w / h
    cw, ch = (int(H * t), H) if W / H > t else (W, int(W / t))
    x = int(max(0, min(W - cw, fx * W - cw / 2))); y = int(max(0, min(H - ch, fy * H - ch / 2)))
    return im.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS)
def triptych(name, srcs):
    c = Image.new('RGB', (2400, 1050), (255, 248, 238))
    for i, (p, fx, fy) in enumerate(srcs): c.paste(crop(p, 796, 1050, fx, fy), (i * 802, 0))
    c.save(os.path.join(OUT, f'{name}-desktop.webp'), 'WEBP', quality=80, method=5)
def single(name, p, w, h, fx=0.5, fy=0.4, suffix='mobile'):
    crop(p, w, h, fx, fy).save(os.path.join(OUT, f'{name}-{suffix}.webp'), 'WEBP', quality=80, method=5)

neckset = pick('ESH-0037 Clover Neckset', 4)
triptych('hero-everyday', [(neckset, 0.5, 0.45), (pick('ESH-0010 Silver Pink tulip bracelet', 4), 0.5, 0.5), (pick('ESH-0056', 8), 0.5, 0.4)])
single('hero-everyday', neckset, 1080, 1440, 0.5, 0.45)
combo = pick('ESH-0023  2p combo-13', 1)
triptych('hero-combos', [(combo, 0.5, 0.4), (pick('ESH-0024 3p combo-3', 4), 0.45, 0.4), (pick('ESH-0029 3p combo-9', 2), 0.5, 0.45)])
single('hero-combos', combo, 1080, 1440, 0.5, 0.4)
triptych('hero-tulip', [(pick('ESH-0014 Blue Golden tulip bracelet', 4), 0.5, 0.5), (pick('ESH-0011 White tulip bracelet', 4), 0.5, 0.5), (pick('ESH-0015 Red Green Golden tulip bracelet', 4), 0.5, 0.5)])
single('hero-tulip', pick('ESH-0010 Silver Pink tulip bracelet', 4), 1080, 1440, 0.5, 0.5)
single('edit-pendants', pick('ESH-0054', 2), 1200, 1500, 0.5, 0.45, 'portrait')
print(sorted(os.listdir(OUT)))
