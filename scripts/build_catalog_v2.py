"""Build optimised WebP photos + backend/seed/catalog.json from the owner's 20-Oct-2026 catalogue.
Usage: python3 -I scripts/build_catalog_v2.py "<ESHTYLE Catalogue folder>" <repo_root>"""
import sys, os, json, shutil
from PIL import Image, ImageOps
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalog_v2 import P, SHEET, VERSION

SRC, REPO = sys.argv[1], sys.argv[2]
OUT = os.path.join(REPO, "backend/uploads/seed")
EXT = (".jpg", ".jpeg", ".png", ".jfif", ".webp")
assert len({p["sku"] for p in P}) == len(P) == len(SHEET), (len(P), len(SHEET))
assert len({p["slug"] for p in P}) == len(P)

def files_in(d):
    return sorted(f for f in os.listdir(d) if f.lower().endswith(EXT) and os.path.isfile(os.path.join(d, f)))

def convert(src, dest_dir, idx):
    os.makedirs(dest_dir, exist_ok=True)
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    big = im.copy(); big.thumbnail((1400, 1400), Image.LANCZOS)
    sm = im.copy(); sm.thumbnail((560, 560), Image.LANCZOS)
    slug = os.path.basename(dest_dir); base = f"{slug}-{idx + 1}"
    big.save(os.path.join(dest_dir, f"{base}.webp"), "WEBP", quality=80, method=5)
    sm.save(os.path.join(dest_dir, f"{base}-sm.webp"), "WEBP", quality=76, method=5)
    return {"url": f"/uploads/seed/{slug}/{base}.webp", "thumb": f"/uploads/seed/{slug}/{base}-sm.webp", "width": big.size[0], "height": big.size[1]}

keep = {p["slug"] for p in P} | {"banners", "reels"}
for d in os.listdir(OUT):  # remove photo folders of products that are no longer sold
    if d not in keep and os.path.isdir(os.path.join(OUT, d)): shutil.rmtree(os.path.join(OUT, d))

products = []
for p in P:
    d = os.path.join(SRC, p["folder"]); fs = files_in(d); dest = os.path.join(OUT, p["slug"])
    if os.path.isdir(dest): shutil.rmtree(dest)
    images = [convert(os.path.join(d, fs[i]), dest, k) for k, i in enumerate(p["imgs"][:9])]
    item = {k: v for k, v in p.items() if k not in ("folder", "imgs")}
    item.update(styleName=p["name"], images=images, variants=[], video=None, priceKnown=True, antiTarnish=False)
    products.append(item)
    print(f'{p["sku"]} {p["slug"]}: {len(images)} photos, ₹{p["price"]}, stock {p["stock"]}')

json.dump({"version": VERSION, "products": products}, open(os.path.join(REPO, "backend/seed/catalog.json"), "w"), indent=1, ensure_ascii=False)
print("products:", len(products))
