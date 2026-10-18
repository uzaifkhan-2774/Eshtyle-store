"""Build editorial hero / campaign banners from the owner's model photography.
Desktop hero = a triptych of three model shots (2400x1050); mobile hero = one portrait crop (1080x1440).
Usage: python3 -I scripts/build_banners.py <photos_root> <repo_root>"""
import sys, os, json
from PIL import Image, ImageOps
SRC, REPO = sys.argv[1], sys.argv[2]
OUT = os.path.join(REPO, 'backend/uploads/seed/banners')
os.makedirs(OUT, exist_ok=True)
P = lambda rel: os.path.join(SRC, rel)
I = {
 'neckset_hand': P('Necklace-Chain/ESH-0037 Clover Neckset/model shot-1.jpeg'),
 'neckset_look': P('Necklace-Chain/ESH-0037 Clover Neckset/model shot.jpeg'),
 'blue_flower': P('Earings/Blue Flower Earrings/model shot.jpeg'),
 'flower_cuff': P('Bracelet/ESH-0042 Flower bracelet/model shot.jpeg'),
 'aurea': P('Earings/The Aurea Sculpt 160Rs/modle shot.jpeg'),
 'trilogy': P('Earings/The Golden Trilogy 179 Rs/model shot.jpeg'),
 'noir': P('Earings/The Noir Rose 179 Rs/modle shot.jpeg'),
 'ad_green_saree': P('Rings/Ad Green Rings/model shot-1.jpeg'),
 'ad_white_dark': P('Rings/Ad White Rings/model hand-2.jpeg'),
 'ad_red_mirror': P('Rings/ESH-0035 Ad Red Rings/model shot.jpeg'),
 'chain_blazer': P('Necklace-Chain/ESH-0029 silver golden chain/model shot.jpeg'),
 'cuff_office': P('Bracelet/ESH-003 line Bracelet (4)/model shot.jpeg'),
 'clover_laptop': P('Necklace-Chain/ESH-0047 Clover Necklace/office look.jpeg'),
 'korean_model': P('Earings/ESH-006 TO ESH-0016 Korean Earring Combo/2p combo-13/model shot-1.jpeg'),
 'pink_ring': P('Rings/ESH-0036 Ad Pink Rings/model shot.jpeg'),
}
def crop(path, w, h, fx=0.5, fy=0.35):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    W, H = im.size; target = w / h
    if W / H > target: cw, ch = int(H * target), H
    else: cw, ch = W, int(W / target)
    x = int(max(0, min(W - cw, fx * W - cw / 2))); y = int(max(0, min(H - ch, fy * H - ch / 2)))
    return im.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS)
def triptych(name, keys, focus=None):
    focus = focus or {}
    canvas = Image.new('RGB', (2400, 1050), (255, 248, 238))
    for i, k in enumerate(keys):
        fx, fy = focus.get(k, (0.5, 0.4))
        canvas.paste(crop(I[k], 796, 1050, fx, fy), (i * 802, 0))
    canvas.save(os.path.join(OUT, f'{name}-desktop.webp'), 'WEBP', quality=80, method=5)
def single(name, key, w, h, fx=0.5, fy=0.4, suffix='mobile'):
    crop(I[key], w, h, fx, fy).save(os.path.join(OUT, f'{name}-{suffix}.webp'), 'WEBP', quality=80, method=5)

F = {'aurea': (0.55, 0.4), 'noir': (0.5, 0.45), 'trilogy': (0.45, 0.4), 'chain_blazer': (0.5, 0.35), 'cuff_office': (0.55, 0.45), 'clover_laptop': (0.6, 0.4), 'ad_green_saree': (0.5, 0.45), 'ad_white_dark': (0.55, 0.5), 'ad_red_mirror': (0.45, 0.4), 'blue_flower': (0.55, 0.45), 'flower_cuff': (0.5, 0.45), 'neckset_hand': (0.5, 0.45)}
triptych('hero-everyday', ['neckset_hand', 'blue_flower', 'flower_cuff'], F); single('hero-everyday', 'neckset_hand', 1080, 1440, *F['neckset_hand'])
triptych('hero-earrings', ['aurea', 'trilogy', 'noir'], F); single('hero-earrings', 'aurea', 1080, 1440, *F['aurea'])
triptych('hero-rings', ['ad_green_saree', 'ad_white_dark', 'ad_red_mirror'], F); single('hero-rings', 'ad_green_saree', 1080, 1440, *F['ad_green_saree'])
triptych('hero-office', ['chain_blazer', 'cuff_office', 'clover_laptop'], F); single('hero-office', 'chain_blazer', 1080, 1440, *F['chain_blazer'])
single('edit-korean', 'korean_model', 1200, 1500, 0.5, 0.45, 'portrait')
single('edit-rings', 'pink_ring', 1200, 1500, 0.5, 0.45, 'portrait')
single('look-clover', 'neckset_look', 1400, 1400, 0.5, 0.5, 'square')
print(sorted(os.listdir(OUT)))
