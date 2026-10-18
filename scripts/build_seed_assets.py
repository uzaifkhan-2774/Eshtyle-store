"""Convert the owner's raw photos into optimised WebP and emit backend/seed/catalog.json.
Usage: python3 -I scripts/build_seed_assets.py <photos_root> <repo_root>"""
import sys, os, re, json, subprocess
from PIL import Image, ImageOps
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalog_spec import P
from seo_spec import SEO

SRC, REPO = sys.argv[1], sys.argv[2]
OUT = os.path.join(REPO, "backend/uploads/seed")
EXT = (".jpg", ".jpeg", ".png", ".jfif")
ORDER = ["front", "model", "modle", "hand", "content", "close", "zoom", "size", "office", "mirror", "packag"]

def slugify(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
def rank(f):
    n = f.lower()
    for i, k in enumerate(ORDER):
        if k in n: return (i, n)
    return (len(ORDER), n)
def files_in(d):
    return sorted([os.path.join(d, f) for f in os.listdir(d) if f.lower().endswith(EXT) and os.path.isfile(os.path.join(d, f))], key=lambda p: rank(os.path.basename(p)))

def convert(src, dest_dir, idx):
    os.makedirs(dest_dir, exist_ok=True)
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    w, h = im.size
    big = im.copy(); big.thumbnail((1400, 1400), Image.LANCZOS)
    sm = im.copy(); sm.thumbnail((560, 560), Image.LANCZOS)
    # Keyword-rich file names help image search: /uploads/seed/<slug>/<slug>-1.webp
    base = f"{os.path.basename(dest_dir)}-{idx + 1}"
    big.save(os.path.join(dest_dir, f"{base}.webp"), "WEBP", quality=80, method=5)
    sm.save(os.path.join(dest_dir, f"{base}-sm.webp"), "WEBP", quality=76, method=5)
    return {"url": f"/uploads/seed/{os.path.basename(dest_dir)}/{base}.webp", "thumb": f"/uploads/seed/{os.path.basename(dest_dir)}/{base}-sm.webp", "width": big.size[0], "height": big.size[1]}

catalog = []
for p in P:
    seo_name, slug, keywords = SEO[p["name"]]
    d = os.path.join(SRC, p["folder"]); dest = os.path.join(OUT, slug)
    counter = [0]
    def conv(f):
        r = convert(f, dest, counter[0]); counter[0] += 1; return r
    item = {k: v for k, v in p.items() if k not in ("folder", "extraFolders", "variants")}
    item["styleName"] = p["name"]; item["name"] = seo_name; item["keywords"] = keywords
    item["slug"] = slug; item["images"] = []; item["variants"] = []; item["video"] = None
    if p["variants"]:
        top = files_in(d)
        used = set()
        for key, label, vsku in p["variants"]:
            vd = os.path.join(d, key)
            if key == "__all__": vf = []
            elif os.path.isdir(vd): vf = files_in(vd)
            else:
                vf = [f for f in top if os.path.basename(f).lower().startswith(key.lower() + " ") or os.path.splitext(os.path.basename(f))[0].lower() == key.lower() or os.path.basename(f).lower().startswith(key.lower() + " earring")]
            used.update(vf)
            item["variants"].append({"label": label, "sku": vsku, "images": [conv(f) for f in vf[:6]]})
        rest = [f for f in top if f not in used]
        item["images"] = [conv(f) for f in rest[:8]]
        if not item["images"]:
            item["images"] = [v["images"][0] for v in item["variants"] if v["images"]][:8]
    else:
        fs = files_in(d)
        for ef in p["extraFolders"]: fs += files_in(os.path.join(SRC, ef))
        fs = sorted(fs, key=lambda x: rank(os.path.basename(x)))
        item["images"] = [conv(f) for f in fs[:9]]
    movs = [f for f in os.listdir(d) if f.lower().endswith(".mov")]
    if movs:
        os.makedirs(dest, exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(d, movs[0]), "-an", "-vf", "scale=-2:720", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-movflags", "+faststart", os.path.join(dest, f"{slug}-video.mp4")], check=True)
        item["video"] = f"/uploads/seed/{slug}/{slug}-video.mp4"
    print(f"{slug}: {len(item['images'])} imgs, {len(item['variants'])} variants, {sum(len(v['images']) for v in item['variants'])} variant imgs")
    catalog.append(item)

os.makedirs(os.path.join(REPO, "backend/seed"), exist_ok=True)
json.dump(catalog, open(os.path.join(REPO, "backend/seed/catalog.json"), "w"), indent=1)
print("products:", len(catalog))
