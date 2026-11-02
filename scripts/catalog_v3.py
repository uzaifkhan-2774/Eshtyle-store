"""Build backend/seed/catalog.json from the owner's product sheet (Nushop export, tab-separated).

Usage:  python3 scripts/catalog_v3.py <sheet.tsv>

* Price = "Selling Price" from the sheet, exactly (set ADD below to add a fixed amount to every price).
  MRP is NOT shown on the site (a flat 2x MRP would read as a fake discount).
* Stock = "Quantity". Rows that share a Product Code become one product: with colour options when their Colour
  differs (each colour keeps its own photos and stock), otherwise with size options.
* Photos = the sheet's Image 1..10 links, used directly (change a link in the sheet or in Admin → photo changes).
* Products that already existed in the earlier catalogue keep their name, link (slug), category and copy,
  so existing links, reviews and orders stay connected.
"""
import csv, html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION = "2026-11-02"
ADD = 0  # rupees added to every sheet price

# Combos where the customer chooses which designs they get (each photo = one design). sheet SKU -> how many to pick
PICK_RING = {}  # owner (2026-11-01): no "pick any 2" anywhere
# Sold as ONE piece at this price, whatever the sheet's "Pack Of" says (owner: "299 me single kr").
SINGLE_AT = {"ESHTYLE_99": 299, "ESHTYLE_56": 299}
PICK_EARRINGS_AFTER = None  # owner (2026-10-31): no more "pick any 2" earrings — each is a single pair
# Earrings listed as "Pack of 2" in the sheet are sold as ONE pair, at most this price (owner: "350 wale ... 299 ... single pcs").
EARRING_SINGLE_PRICE = 299

# Names fixed where the sheet's auto-generated name did not match the product type.
NAME_FIX = {
    "ESHTYLE_80": "Golden Heart Necklace & Earrings Set",
    "ESHTYLE_104": "Multicolour Pendant Necklace & Earrings Set",
    "ESHTYLE_106": "Golden Statement Necklace",
    "ESHTYLE_70": "Foldable Jewellery Organiser Case",
    "ESHTYLE_120": "Golden Mini Clover Bracelet",
    "ESHTYLE_131": "Golden Mini Starfish Stud Earrings",
}
# Category fixes where the sheet's product type is wrong (e.g. a pendant entered as "arm cf").
CAT_FIX = {"ESHTYLE_52": "pendants", "ESHTYLE_62": "gift-sets"}
# Category moves applied after the page is matched to the old catalogue (so existing links stay the same).
POST_CAT = {"ESHTYLE_72": "necklaces", "ESHTYLE_108": "necklaces",  # clover necklaces sit with the other clover necklaces
           "ESHTYLE_120": "bracelets",  # photos show it worn on the wrist
           "ESHTYLE_70": "earring-combos"}  # 12 pairs of stud earrings in a box

# Which photo goes first (1 = the sheet's Image 1): the photo with the piece worn by a model.
FRONT = {"ESHTYLE_02": 3, "ESHTYLE_03": 6, "ESHTYLE_05": 3, "ESHTYLE_06": 3, "ESHTYLE_07": 3, "ESHTYLE_10": 5, "ESHTYLE_11": 2,
         "ESHTYLE_12": 4, "ESHTYLE_13": 3, "ESHTYLE_14": 4, "ESHTYLE_16": 4, "ESHTYLE_17": 4, "ESHTYLE_19": 2, "ESHTYLE_21": 3,
         "ESHTYLE_23": 5, "ESHTYLE_24": 3, "ESHTYLE_25": 3, "ESHTYLE_26": 3, "ESHTYLE_27": 3, "ESHTYLE_28": 3, "ESHTYLE_29": 2,
         "ESHTYLE_33": 4, "ESHTYLE_36": 4, "ESHTYLE_39": 2, "ESHTYLE_40": 6, "ESHTYLE_41": 3, "ESHTYLE_42": 2, "ESHTYLE_43": 3,
         "ESHTYLE_50": 3, "ESHTYLE_52": 2, "ESHTYLE_53": 3, "ESHTYLE_54": 2, "ESHTYLE_55": 3, "ESHTYLE_56": 2, "ESHTYLE_57": 5,
         "ESHTYLE_59": 3, "ESHTYLE_61": 4, "ESHTYLE_62": 6, "ESHTYLE_63": 7, "ESHTYLE_64": 3, "ESHTYLE_67": 2, "ESHTYLE_68": 4,
         "ESHTYLE_69": 2, "ESHTYLE_71": 3, "ESHTYLE_74": 3, "ESHTYLE_75": 4, "ESHTYLE_76": 2, "ESHTYLE_78": 2, "ESHTYLE_80": 5,
         "ESHTYLE_82": 2, "ESHTYLE_84": 4, "ESHTYLE_85": 6, "ESHTYLE_86": 4, "ESHTYLE_87": 6, "ESHTYLE_88": 4, "ESHTYLE_90": 6,
         "ESHTYLE_91": 2, "ESHTYLE_94": 6, "ESHTYLE_97": 4, "ESHTYLE_99": 8, "ESHTYLE_102": 2, "ESHTYLE_103": 4, "ESHTYLE_105": 7,
         "ESHTYLE_107": 5, "ESHTYLE_108": 2, "ESHTYLE_109": 2, "ESHTYLE_112": 2, "ESHTYLE_113": 3, "ESHTYLE_114": 3, "ESHTYLE_116": 9,
         "ESHTYLE_117": 2, "ESHTYLE_119": 4, "ESHTYLE_120": 4, "ESHTYLE_121": 7, "ESHTYLE_123": 2, "ESHTYLE_124": 3, "ESHTYLE_125": 2,
         "ESHTYLE_126": 2, "ESHTYLE_130": 3, "ESHTYLE_131": 5, "ESHTYLE_132": 2, "ESHTYLE_133": 3, "ESHTYLE_134": 5, "ESHTYLE_135": 7}


def front_first(sku, urls):
    k = FRONT.get(sku, 1) - 1
    return [urls[k]] + urls[:k] + urls[k + 1:] if 0 < k < len(urls) else urls
# Old catalogue mappings that are wrong (the sheet reuses a code number for a different product).
NO_MAP = {"ESHTYLE_16", "ESHTYLE_18", "ESHTYLE_37", "ESHTYLE_72"}

FAMILY = {"watches": "b", "earrings": "e", "earring-combos": "e", "necklaces": "n", "chains": "n", "pendants": "n", "necksets": "s",
          "gift-sets": "s", "rings": "r", "ring-combos": "r", "bracelets": "b", "bangles": "b", "arm-cuffs": "b",
          "anklets": "a", "jewellery-box-sets": "x"}


# Colour-variation families: the product's display name (the first row's name mentions only one colour).
FAMILY_NAME = {"ESHTYLE_74": "Clover Charm Bracelet",
               "ESHTYLE_36": "Clover Necklace"}
FIRST_NEW = 107  # rows from ESHTYLE_107 on are new products (never in the old catalogue)


def colour_label(c):
    c = c.strip().lower().replace("balck", "black").replace("grren", "green").replace("plight", "light")
    parts = [x.strip() for x in re.split(r",|\band\b|&", c) if x.strip()]
    other = [x for x in parts if x not in ("gold", "golden")]
    return (" & ".join(other) or "gold").title()


def img(u):
    u = u.strip()
    return re.sub(r"^https?://(www\.)?e-shtyle\.(com|in)(?=/uploads/)", "", u)


def slugify(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def clean_name(n):
    n = re.sub(r"\s+for\s+wom[ae]n\b", "", n, flags=re.I).strip()
    n = re.sub(r"^Gold[- ]Tone[d]?\s+", "Golden ", n, flags=re.I)
    n = re.sub(r"^Gold Stainless Steel\s+", "Golden ", n, flags=re.I)
    n = re.sub(r"^Silver[- ]Tone\s+", "Silver ", n, flags=re.I)
    n = re.sub(r"\bAnd\b", "&", n)
    n = re.sub(r"^Golden Golden\b", "Golden", n)
    return n[:1].upper() + n[1:]


def category(name, ptype, pack):
    t = f"{name} {ptype}".lower()
    if "watch" in t: return "watches"
    if "organi" in t or "storage box" in t or "jewellery box" in t or "jwellry box" in t: return "jewellery-box-sets"
    if "anklet" in t or "anklete" in t: return "anklets"
    if re.search(r"necklace.*(earring|bracelet|ring)|jewellery set|set with", t) or re.search(r"(necklace|neckalce|chain).*(earing|braclete|ring)", ptype.lower()):
        return "necksets"
    if "armlet" in t or "arm c" in ptype.lower(): return "arm-cuffs"
    if "earring" in t or "earing" in t:
        return "earring-combos" if ("set" in name.lower() or pack > 1) else "earrings"
    if re.search(r"\bring\b", t): return "ring-combos" if pack > 1 else "rings"
    if "bangle" in t or "bangal" in t: return "bangles"
    if "cuff" in t: return "arm-cuffs"
    if "brac" in t or "barac" in t: return "bracelets"
    if "pendant" in t: return "pendants"
    if "chain" in t: return "chains"
    return "necklaces"


def description(raw):
    items = re.findall(r"<li>(.*?)</li>", raw, flags=re.S)
    out = []
    for it in items:
        txt = html.unescape(re.sub(r"<[^>]+>", "", it)).strip()
        txt = re.sub(r"\s+", " ", txt)
        if re.search(r"quality assurance", txt, re.I):
            continue  # vague quality claims are left out
        out.append(txt)
    return out


def apply_extra(products):
    """backend/seed/catalog-extra.json: photos, products and colour options that are not in the sheet."""
    f = ROOT / "backend/seed/catalog-extra.json"
    if not f.exists():
        return
    x = json.loads(f.read_text())
    by = {p["sku"]: p for p in products}
    for p in products:
        for v in p["variants"]:
            by.setdefault(v["sku"], v)
    for sku, im in x.get("images", {}).items():
        t = by.get(sku)
        if not t:
            continue
        cur = [i["url"] for i in t["images"]]
        front = [u for u in im.get("front", []) if u not in cur]
        second = [u for u in im.get("second", []) if u not in cur]
        cur = front + cur[:1] + second + cur[1:]
        t["images"] = [{"url": u} for u in cur]
    for v in x.get("variants", []):
        p = by.get(v["parent"])
        if p and not any(o["sku"] == v["sku"] for o in p["variants"]):
            p["variants"].append({"label": v["label"], "sku": v["sku"], "stock": v["stock"], "images": v["images"]})
            p["stock"] = sum(o["stock"] for o in p["variants"])
            p["colour"] = ", ".join(o["label"] for o in p["variants"])
    for n in x.get("products", []):
        if n["sku"] not in by:
            products.append(n)
    for sku, name in x.get("rename", {}).items():
        if sku in by and "name" in by[sku]:
            by[sku]["name"] = by[sku]["styleName"] = name


def main(sheet_path):
    rows = list(csv.reader(open(sheet_path, encoding="utf-8"), delimiter="\t"))
    h = rows[0]; col = {k.strip(): i for i, k in enumerate(h) if k.strip()}
    old = {p["sku"]: p for p in json.load(open(ROOT / "scripts/catalog_v2_snapshot.json"))["products"]}  # previous catalogue (2026-10-20)
    groups, order = {}, []
    for r in rows[1:]:
        if not r or not r[col["Sku Id"]].strip():
            continue
        code = r[col["Product Code"]].strip() or r[col["Sku Id"]].strip()
        if code not in groups:
            groups[code] = []; order.append(code)
        groups[code].append(r)

    products, used = [], set()
    for code in order:
        rs = groups[code]; r = rs[0]
        sku = r[col["Sku Id"]].strip()
        num = int(sku.split("_")[1])
        ptype = r[col["attr_Product Type"]].strip()
        pack = int(r[col["attr_Pack Of"]] or 1)
        price = max(int(float(x[col["Selling Price"]])) for x in rs) + ADD
        if ptype.lower() == "earring" and pack == 2:
            pack, price = 1, min(price, EARRING_SINGLE_PRICE)
        if sku in SINGLE_AT:
            pack, price = 1, SINGLE_AT[sku]
        imgs = front_first(sku, [img(r[i]) for i in range(col["Image 1"], col["Image 10"] + 1) if r[i].strip().startswith("http")])
        bullets = description(r[col["Description"]])
        material = r[col["attr_Material"]].strip() if "attr_Material" in col else ""
        name = NAME_FIX.get(sku) or clean_name(r[col["Name"]].strip())
        cat = CAT_FIX.get(sku) or category(name, ptype, pack)

        m = re.search(r"ESHP?-0*(\d+)", code)
        o = old.get("ESH-%03d" % int(m.group(1))) if (m and "new-stock" not in code and sku not in NO_MAP and num < FIRST_NEW) else None
        if o and FAMILY.get(o["category"]) != FAMILY.get(cat) and not (FAMILY.get(o["category"]) in "sb" and FAMILY.get(cat) in "sb"):
            o = None  # different kind of product: do not reuse the old page
        if o and o["slug"] in used:
            o = None

        variants = []
        colours = [colour_label(x[col["Colour"]]) for x in rs]
        if len(rs) > 1 and len(set(colours)) == len(colours):
            variants = [{"label": c, "sku": x[col["Sku Id"]].strip(), "stock": int(x[col["Quantity"]] or 0),
                         "images": [{"url": u} for u in front_first(x[col["Sku Id"]].strip(), [img(x[i]) for i in range(col["Image 1"], col["Image 10"] + 1) if x[i].strip().startswith("http")])]}
                        for c, x in zip(colours, rs)]
        elif len(rs) > 1:
            by_size = {}
            for x in rs:
                size = x[col["Size"]].strip()
                by_size.setdefault(size, {"sku": x[col["Sku Id"]].strip(), "stock": 0})
                by_size[size]["stock"] += int(x[col["Quantity"]] or 0)
            unit = "Bangle size" if "bang" in (ptype + name).lower() else "Size"
            variants = [{"label": f"Size {s}", "sku": v["sku"], "stock": v["stock"], "images": []} for s, v in by_size.items()]
            _ = unit
        stock = sum(v["stock"] for v in variants) if variants else int(r[col["Quantity"]] or 0)

        if o:
            item = {k: o[k] for k in ("name", "slug", "category", "subcategory", "line", "colour", "finish", "tags", "keywords", "styleName", "antiTarnish")}
        else:
            slug = slugify(name)
            if slug in used: slug = f"{slug}-{num}"
            line = next((b.split(":", 1)[1].strip() for b in bullets if b.lower().startswith("stylish design")), bullets[0].split(":", 1)[-1].strip() if bullets else name)
            colour = r[col["Colour"]].strip().title().replace(" And ", " & ").replace("Balck", "Black").replace("Grren", "Green") or "Gold"
            item = {"name": name, "slug": slug, "category": cat, "subcategory": "bracelet-combos" if cat == "bracelets" and "set" in name.lower() else None,
                    "line": line, "colour": colour, "finish": "Silver-tone" if name.lower().startswith("silver") else "Gold-tone",
                    "tags": ["new"] if "new-stock" in code or num >= 75 else [], "keywords": [], "styleName": name, "antiTarnish": False}
        if len(variants) > 1 and not variants[0]["label"].startswith("Size"):
            if sku in FAMILY_NAME: item["name"] = item["styleName"] = FAMILY_NAME[sku]
            item["colour"] = ", ".join(v["label"] for v in variants)
            item["line"] = re.sub(r"\b(black|red|white|blue|pink|green)\s+(?=clover)", "", item["line"], flags=re.I)
            item["line"] = item["line"][:1].upper() + item["line"][1:]
        if sku in CAT_FIX or sku in POST_CAT: item["category"] = POST_CAT.get(sku) or CAT_FIX[sku]
        if "watch" in item["name"].lower(): item["category"] = "watches"
        if sku in NAME_FIX and sku not in ("ESHTYLE_80", "ESHTYLE_104", "ESHTYLE_106", "ESHTYLE_70"): item["name"] = item["styleName"] = NAME_FIX[sku]
        used.add(item["slug"])
        pick = PICK_RING.get(sku, 0)
        if not pick and PICK_EARRINGS_AFTER and num > PICK_EARRINGS_AFTER and pack == 2 and "earring" in (ptype + " " + name).lower():
            pick = 2
        if pick:
            item["tags"] = sorted(set(item["tags"]) | {"pick-your-designs"})
            if pick and "Pick" not in item["name"]:
                item["name"] = f"{item['name']} — Pick Any {pick}"
        desc = [f"{b}" for b in bullets]
        if pick:
            desc.insert(0, f"Choose your {pick} favourite designs: each photo is one design. Pick them on this page before adding to bag.")
        products.append({
            "sku": sku, **item, "price": price, "stock": stock, "pick": pick,
            "images": [{"url": u} for u in imgs],
            "variants": variants, "video": None, "priceKnown": True,
            "description": "\n\n".join(desc) if desc else None, "material": material,
            "packOf": pack, "sheetCode": code,
        })
    apply_extra(products)
    out = {"version": VERSION, "products": products}
    (ROOT / "backend/seed/catalog.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"{len(products)} products ({sum(len(p['variants']) or 1 for p in products)} SKUs) written; "
          f"{sum(1 for p in products if p['pick'])} pick-your-designs; reused old pages: "
          f"{sum(1 for p in products if not p['sku'] in () and p['slug'] in {o['slug'] for o in old.values()})}")


if __name__ == "__main__":
    main(sys.argv[1])
