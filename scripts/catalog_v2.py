"""Owner's catalogue of 20 Oct 2026 (folder "ESHTYLE Catalogue" + SKU/qty/price sheet).
Selling price = owner's sheet price + Rs 100 (owner's instruction, to cover shipping and other costs).
Image indices refer to the files of each folder sorted by name (images only).
Names describe the piece the way shoppers search; no other brands' names are used."""

VERSION = "2026-10-20"
ADD = 100  # rupees added to every sheet price

# sku: (sheet qty, sheet price)
SHEET = {
 "ESH-001": (2, 249), "ESH-002": (12, 199), "ESH-003": (2, 199), "ESH-004": (12, 199), "ESH-005": (12, 149),
 "ESH-006": (12, 399), "ESH-007": (12, 299), "ESH-008": (12, 249), "ESH-009": (0, 249), "ESH-010": (6, 249),
 "ESH-011": (6, 249), "ESH-012": (6, 249), "ESH-013": (6, 249), "ESH-014": (6, 249), "ESH-015": (6, 249),
 "ESH-016": (9, 179), "ESH-017": (12, 149), "ESH-018": (12, 199), "ESH-019": (12, 249), "ESH-020": (10, 179),
 "ESH-021": (10, 179), "ESH-022": (10, 179), "ESH-023": (10, 249), "ESH-024": (10, 249), "ESH-025": (10, 249),
 "ESH-026": (10, 249), "ESH-027": (10, 249), "ESH-028": (10, 249), "ESH-029": (10, 249), "ESH-030": (10, 249),
 "ESH-031": (12, 199), "ESH-032": (10, 299), "ESH-033": (12, 149), "ESH-034": (6, 750), "ESH-035": (2, 199),
 "ESH-036": (2, 199), "ESH-037": (2, 199), "ESH-038": (12, 149), "ESH-039": (2, 199), "ESH-040": (36, 99),
 "ESH-041": (36, 99), "ESH-042": (1, 199), "ESH-043": (36, 149), "ESH-044": (6, 199), "ESH-045": (6, 249),
 "ESH-046": (6, 249), "ESH-047": (6, 229), "ESH-048": (6, 199), "ESH-049": (6, 399), "ESH-050": (12, 199),
 # ESH-051, ESH-052: no photos, no price in the sheet -> not listed
 "ESH-053": (6, 299), "ESH-054": (6, 229), "ESH-055": (6, 199), "ESH-056": (6, 229), "ESH-057": (24, 249),
 "ESH-058": (12, 249), "ESH-059": (6, 229), "ESH-060": (6, 199), "ESH-061": (6, 399), "ESH-062": (12, 149),
 "ESH-063": (3, 499), "ESH-064": (12, 129), "ESH-065": (12, 149), "ESH-066": (6, 399),
}

P = []
def add(sku, folder, name, slug, cat, line, imgs, colour="Gold", finish="Gold-tone", tags=(), keywords=(), sub=None):
    qty, base = SHEET[sku]
    P.append(dict(sku=sku, folder=folder, name=name, slug=slug, category=cat, subcategory=sub, price=base + ADD, stock=qty,
                  line=line, imgs=list(imgs), colour=colour, finish=finish, tags=list(tags), keywords=list(keywords)))

TULIP_KW = ["tulip bracelet", "stone bracelet", "flower bracelet", "korean bracelet", "gift for her"]
COMBO_KW = ["earrings combo", "korean earrings", "stud earrings", "daily wear earrings", "earring set"]

# ---------------- Cuffs, bangles, bracelets
add("ESH-001", "ESH-001 Broad bracelet", "Golden Broad Cuff Bracelet", "golden-broad-cuff-bracelet", "arm-cuffs",
    "A wide, softly concave cuff with a mirror finish that catches the light from every angle.", [2, 1, 3, 0],
    tags=["statement"], keywords=["cuff bracelet", "kada for women", "broad bracelet", "statement bracelet"])
add("ESH-002", "ESH-002 Single Cartier Bracelet", "Golden Screw Bangle Bracelet with Stones", "golden-screw-bangle-bracelet-with-stones", "bangles",
    "A clean oval bangle with screw motifs and sparkling stones — the everyday stacking essential.", [1, 0, 2, 3],
    tags=["bestseller", "stacking"], keywords=["screw bangle", "love bangle", "stone bangle", "kada"])
add("ESH-003", "ESH-003 line Bracelet (4)", "Golden Ribbed Wide Cuff Bracelet", "golden-ribbed-wide-cuff-bracelet", "arm-cuffs",
    "Fine vertical ribbing on a bold open cuff — architectural and effortless with workwear.", [1, 0, 3, 2, 4, 5],
    keywords=["cuff bracelet", "wide cuff", "kada for women", "office wear bracelet"])
add("ESH-004", "ESH-004 3 bamboo bracelet", "Golden Bamboo Bangle Bracelet", "golden-bamboo-bangle-bracelet", "bangles",
    "A slender jointed bangle inspired by bamboo — minimal, refined and easy to layer.", [1, 2, 3, 0, 4, 5],
    tags=["stacking"], keywords=["bamboo bracelet", "thin bangle", "kada"])
add("ESH-005", "ESH-005 Flower bracelet", "Golden Flower Cuff Bracelet", "golden-flower-cuff-bracelet", "bracelets",
    "Sculpted gold-tone blossoms that wrap the wrist in a soft garden of petals.", [1, 0, 2, 3, 4, 5],
    tags=["floral"], keywords=["flower bracelet", "floral cuff", "cuff bracelet"])
add("ESH-006", "ESH-006 3 combo bracelet", "Clover, Screw & Nail Bracelet Set of 3", "clover-screw-nail-bracelet-set-of-3", "bracelets",
    "Three signature shapes in one set: a black clover chain, a screw motif bangle and a nail cuff.", [7, 12, 3, 4, 1, 6, 2, 5, 11],
    colour="Black & Gold", tags=["bestseller", "stacking", "gift"], keywords=["bracelet set", "stack bracelets", "clover bracelet", "nail bracelet", "screw bangle"], sub="bracelet-combos")
add("ESH-007", "ESH-007 Nail and Cartier bracelet  ", "Nail & Screw Bangle Bracelet Set of 2", "nail-screw-bangle-bracelet-set-of-2", "bangles",
    "The power pair: a nail cuff and a screw motif bangle, designed to be worn together.", [3, 1, 2, 4],
    tags=["stacking", "gift"], keywords=["nail bracelet", "screw bangle", "bangle set", "stack bracelets"])
add("ESH-008", "ESH-008 Pink Tulip Bracelet", "Pink Stone Tulip Bracelet", "pink-stone-tulip-bracelet", "bracelets",
    "A delicate vine of blush-pink tulip stones on a gold-tone chain.", [0, 1, 2, 3, 4],
    colour="Pink", tags=["floral", "gift", "tulip"], keywords=TULIP_KW + ["pink bracelet"])
add("ESH-009", "ESH-009 Pink Purple Golden tulip bracelet", "Pink & Purple Stone Tulip Bracelet", "pink-purple-stone-tulip-bracelet", "bracelets",
    "Pink and purple tulip-cut stones climbing a fine gold-tone vine.", [2, 1, 0, 3, 4, 5, 6],
    colour="Pink & Purple", tags=["floral", "tulip"], keywords=TULIP_KW + ["purple bracelet"])
add("ESH-010", "ESH-0010 Silver Pink tulip bracelet", "Silver Pink Stone Tulip Bracelet", "silver-pink-stone-tulip-bracelet", "bracelets",
    "Soft pink tulip stones on a silver-tone vine — fresh, feminine and easy to wear every day.", [2, 0, 1, 3, 4, 5],
    colour="Pink", finish="Silver-tone", tags=["floral", "tulip", "gift"], keywords=TULIP_KW + ["silver bracelet", "pink bracelet"])
add("ESH-011", "ESH-0011 White tulip bracelet", "White Stone Tulip Bracelet", "white-stone-tulip-bracelet", "bracelets",
    "Clear white tulip stones on a gold-tone vine — a quietly sparkling everyday piece.", [2, 0, 1, 4, 3, 5],
    colour="White", tags=["floral", "tulip", "gift"], keywords=TULIP_KW + ["white stone bracelet"])
add("ESH-012", "ESH-0013 Pink Purple Silver tulip bracelet", "Silver Pink & Purple Stone Tulip Bracelet", "silver-pink-purple-stone-tulip-bracelet", "bracelets",
    "Pink, lilac and clear stones on a silver-tone tulip vine.", [2, 0, 1, 3, 4],
    colour="Pink & Purple", finish="Silver-tone", tags=["floral", "tulip"], keywords=TULIP_KW + ["silver bracelet"])
add("ESH-013", "ESH-0013 Pink Green Golden tulip bracelet", "Pink & Green Stone Tulip Bracelet", "pink-green-stone-tulip-bracelet", "bracelets",
    "Pink tulip stones with fresh green leaves on a gold-tone vine.", [0, 1, 3, 4, 2],
    colour="Pink & Green", tags=["floral", "tulip"], keywords=TULIP_KW)
add("ESH-014", "ESH-0014 Blue Golden tulip bracelet", "Blue Stone Tulip Bracelet", "blue-stone-tulip-bracelet", "bracelets",
    "Deep blue tulip stones on a gold-tone vine — a pop of colour for every outfit.", [2, 0, 1, 3, 4, 5],
    colour="Blue", tags=["floral", "tulip"], keywords=TULIP_KW + ["blue bracelet"])
add("ESH-015", "ESH-0015 Red Green Golden tulip bracelet", "Red & Green Stone Tulip Bracelet", "red-green-stone-tulip-bracelet", "bracelets",
    "Ruby-red tulip stones and green leaves on a gold-tone vine — festive and bright.", [1, 2, 0, 3, 4, 5],
    colour="Red & Green", tags=["floral", "tulip", "festive"], keywords=TULIP_KW + ["red bracelet"])
add("ESH-016", "ESH-0016 KASHMIRI BANGALS", "Golden Kashmiri Bangles Set", "golden-kashmiri-bangles-set", "bangles",
    "A stack of fine golden bangles with delicate dangling details — made for festivals and weddings.", [0, 2, 1, 3],
    tags=["festive", "new"], keywords=["kashmiri bangles", "bangles set", "ethnic bangles", "festive bangles", "wedding bangles"])
add("ESH-017", "ESH-0017 Black Clover Bracelet", "Black Clover Charm Bracelet", "black-clover-bracelet", "bracelets",
    "Black clover motifs framed in gold-tone — timeless, graphic and endlessly wearable.", [3, 1, 2, 0, 4, 5],
    colour="Black & Gold", tags=["bestseller", "clover"], keywords=["clover bracelet", "four leaf clover", "lucky charm bracelet"])
add("ESH-044", "ESH-0044", "Golden Multi-Wire Cuff Bracelet", "golden-multi-wire-cuff-bracelet", "arm-cuffs",
    "Dozens of fine golden wires gathered into one bold open cuff — a modern statement piece.", [4, 6, 0, 1, 2, 3, 5],
    tags=["statement", "new"], keywords=["cuff bracelet", "wire bracelet", "statement bracelet", "kada for women"])
add("ESH-050", "ESH-0050", "Black Clover Bracelet & Screw Bangle Set of 2", "black-clover-bracelet-screw-bangle-set", "bracelets",
    "A black clover chain bracelet paired with a screw motif bangle — the easiest stack there is.", [2, 4, 0, 1, 3, 6],
    colour="Black & Gold", tags=["stacking", "gift", "clover"], keywords=["bracelet set", "clover bracelet", "screw bangle", "stack bracelets"], sub="bracelet-combos")
add("ESH-058", "ESH-0058", "Stone-Studded Nail Bangle Bracelet", "stone-studded-nail-bangle-bracelet", "bangles",
    "A sleek nail-shaped bangle lined with sparkling stones, with an easy push-and-pull opening.", [1, 4, 6, 2, 0, 3, 5, 7],
    tags=["stacking", "new"], keywords=["nail bracelet", "nail bangle", "stone bangle", "kada"])
add("ESH-062", "ESH-0062", "Pink Clover Charm Bracelet", "pink-clover-bracelet", "bracelets",
    "Soft pink clover motifs on a fine gold-tone chain — sweet, light and easy to gift.", [0, 4, 1, 2, 3],
    colour="Pink", tags=["clover", "gift"], keywords=["clover bracelet", "pink bracelet", "four leaf clover"])
add("ESH-063", "ESHP-63", "Golden Stone-Studded Bracelet Watch", "golden-stone-studded-bracelet-watch", "bracelets",
    "An ornate golden bracelet with coloured stones and a small watch face — traditional style for festive days.", [0, 3, 4, 1, 2],
    tags=["festive", "new", "watch"], keywords=["bracelet watch", "watch for women", "ethnic watch", "festive jewellery"])
add("ESH-064", "ESH-64", "Golden Snake Chain Anklet", "golden-snake-chain-anklet", "anklets",
    "A smooth flat snake chain for the ankle with an adjustable extender.", [4, 6, 0, 1, 2, 3, 5],
    tags=["new"], keywords=["anklet", "payal", "gold anklet", "snake chain anklet"])

# ---------------- Gift sets
add("ESH-018", "ESH-0018 Heartshaped ring and chain combo", "Heart Pendant Necklace & Ring Gift Set", "heart-necklace-and-ring-gift-set", "gift-sets",
    "A matching open-heart pendant and ring, presented ready to gift.", [1, 0, 3, 2, 4, 5],
    tags=["gift", "heart"], keywords=["heart necklace", "heart ring", "jewellery gift set", "gift for girlfriend", "valentine gift"])
add("ESH-019", "ESH-0019 Flower earring and bracelet combo", "Golden Flower Earrings & Cuff Bracelet Set", "flower-earrings-and-bracelet-set", "gift-sets",
    "Sculpted flower studs paired with the matching petal cuff.", [2, 1, 0, 3, 4, 5],
    tags=["gift", "floral"], keywords=["flower earrings", "earring bracelet combo", "jewellery set"])

# ---------------- Earring combos
add("ESH-020", "ESH-0020 2p combo-1", "Butterfly & Pearl Tulip Earrings Combo — Set of 2", "butterfly-pearl-tulip-earrings-combo", "earring-combos",
    "Two pairs: pastel enamel butterfly studs and pink tulip studs with a pearl.", [0, 2, 3, 1, 4],
    colour="Pink & Blue", tags=["combo", "gift"], keywords=COMBO_KW + ["butterfly earrings", "tulip earrings"])
add("ESH-021", "ESH-0021 2p combo-2", "Pearl Flower & Crystal Claw Earrings Combo — Set of 2", "pearl-flower-crystal-claw-earrings-combo", "earring-combos",
    "Two pairs: a crystal flower stud with a pearl, and sparkling claw-style crawler earrings.", [1, 0, 2, 3],
    tags=["combo"], keywords=COMBO_KW + ["pearl earrings", "claw earrings"])
add("ESH-022", "ESH-0022 2p combo-4", "Crystal Cherry & Pearl Tulip Earrings Combo — Set of 2", "cherry-pearl-tulip-earrings-combo", "earring-combos",
    "Two pairs: crystal cherry studs with pearls and front-back pearl tulip earrings.", [2, 0, 1, 3],
    tags=["combo"], keywords=COMBO_KW + ["cherry earrings", "pearl earrings"])
add("ESH-023", "ESH-0023  2p combo-13", "Black Flower Stud & Long Drop Earrings Combo — Set of 2", "black-flower-drop-earrings-combo", "earring-combos",
    "Two pairs in black and gold: a flower stud and an elegant long drop — day to evening.", [3, 1, 2, 0],
    colour="Black & Gold", tags=["combo"], keywords=COMBO_KW + ["black earrings", "drop earrings"])
add("ESH-024", "ESH-0024 3p combo-3", "Pearl & Green Stone Stud Earrings Combo — Set of 3", "pearl-green-stone-earrings-combo", "earring-combos",
    "Three pairs: a pearl tulip, a pearl halo stud and green triangle stone studs.", [2, 0, 3, 4, 1],
    colour="Green & White", tags=["combo", "bestseller"], keywords=COMBO_KW + ["pearl earrings", "green earrings"])
add("ESH-025", "ESH-0025 3p combo-5", "Cherry, Flower & Heart Stud Earrings Combo — Set of 3", "cherry-flower-heart-earrings-combo", "earring-combos",
    "Three pairs: pearl cherry studs, sparkling flower studs and soft white hearts.", [1, 0, 2, 3, 4],
    tags=["combo"], keywords=COMBO_KW + ["heart earrings", "cherry earrings"])
add("ESH-026", "ESH-0026 3p combo-6", "Pearl Bow, Tulip & Crystal Claw Earrings Combo — Set of 3", "pearl-bow-tulip-claw-earrings-combo", "earring-combos",
    "Three pairs: a pearl bow, a pearl tulip and crystal claw crawlers.", [2, 0, 1, 3, 4],
    tags=["combo"], keywords=COMBO_KW + ["bow earrings", "pearl earrings"])
add("ESH-027", "ESH-0027 3p combo-7", "Pearl Ribbon & Wreath Earrings Combo — Set of 3", "pearl-ribbon-wreath-earrings-combo", "earring-combos",
    "Three pairs of pearl earrings: ribbon drops, a pearl wreath and a classic stud.", [1, 0, 2, 3, 4],
    colour="White & Gold", tags=["combo"], keywords=COMBO_KW + ["pearl earrings"])
add("ESH-028", "ESH-0028 3p combo-8", "White Flower, Pearl Cross & Black Clover Earrings Combo — Set of 3", "flower-pearl-cross-clover-earrings-combo", "earring-combos",
    "Three pairs: white enamel flowers, crossed pearl studs and black clover studs.", [0, 1, 2, 3],
    tags=["combo"], keywords=COMBO_KW + ["clover earrings", "flower earrings"])
add("ESH-029", "ESH-0029 3p combo-9", "Camellia, Pearl Drop & Black Bow Earrings Combo — Set of 3", "camellia-pearl-bow-earrings-combo", "earring-combos",
    "Three pairs: a camellia stud, a pearl drop and a black bow drop.", [0, 1, 2, 3],
    tags=["combo"], keywords=COMBO_KW + ["bow earrings", "pearl earrings"])
add("ESH-030", "ESH-0030 3p combo-10", "Crystal Claw, Butterfly & Round Stud Earrings Combo — Set of 3", "claw-butterfly-round-earrings-combo", "earring-combos",
    "Three pairs: crystal claw crawlers, white butterflies and a round crystal stud.", [0, 1, 2, 3, 4],
    tags=["combo"], keywords=COMBO_KW + ["butterfly earrings", "claw earrings"])
add("ESH-032", "ESH-0032 4p combo-11", "Bow, Butterfly & Pearl Earrings Combo — Set of 4", "bow-butterfly-pearl-earrings-combo", "earring-combos",
    "Four pairs of dainty favourites: bows, butterflies, a crystal heart and pearls.", [0, 1, 2, 3],
    tags=["combo", "gift", "bestseller"], keywords=COMBO_KW + ["bow earrings", "butterfly earrings"])
add("ESH-065", "ESH-0065 3p combo-12", "Pink Tulip, Pearl Halo & Flower Drop Earrings Combo — Set of 3", "pink-tulip-pearl-flower-earrings-combo", "earring-combos",
    "Three pairs: pink crystal tulips, a pearl halo stud and white flowers with a pearl drop.", [0, 3, 2, 1],
    colour="Pink & White", tags=["combo", "new"], keywords=COMBO_KW + ["tulip earrings", "pearl earrings"])
add("ESH-033", "ESH-0033 Cream Earring", "Golden Bow Pearl Drop Earrings", "golden-bow-pearl-drop-earrings", "earrings",
    "A golden bow with a crystal centre and a lustrous pearl drop on a small hoop.", [1, 0, 2, 3],
    colour="White & Gold", tags=["new"], keywords=["pearl drop earrings", "bow earrings", "hoop earrings", "party wear earrings"])
add("ESH-034", "ESH-0034 Earrings box", "Stud Earrings Gift Box Set", "stud-earrings-gift-box-set", "jewellery-box-sets",
    "A foldable gift box filled with assorted dainty stud earrings — a ready-made present.", [4, 2, 1, 0],
    tags=["gift", "bestseller"], keywords=["earring box", "earrings gift set", "stud earrings set", "gift for her"])

# ---------------- Necklaces, chains, pendants, sets
add("ESH-031", "ESH-0031 silver golden chain", "Gold & Silver Flat Snake Chain Necklace", "snake-chain-necklace-gold-silver", "chains",
    "Smooth flat snake chains in gold-tone and silver-tone that lie beautifully alone or layered.", [1, 0, 3, 2],
    colour="Gold & Silver", finish="Gold-tone & silver-tone", tags=["layering"], keywords=["snake chain", "flat chain", "herringbone chain", "silver chain"])
add("ESH-035", "ESH-0035 White Clover Necklace", "White Clover Necklace", "white-clover-necklace", "necklaces",
    "White clover motifs spaced along a fine gold-tone chain.", [2, 1, 0, 3, 4],
    colour="White & Gold", tags=["clover"], keywords=["clover necklace", "four leaf clover", "station necklace"])
add("ESH-036", "ESH-0036 Green Clover Necklace", "Green Clover Necklace", "green-clover-necklace", "necklaces",
    "Deep green clover motifs along a fine gold-tone chain.", [2, 3, 1, 0],
    colour="Green & Gold", tags=["clover"], keywords=["clover necklace", "green necklace", "four leaf clover"])
add("ESH-037", "ESH-0037 Clover Neckset", "Black Clover Necklace Set with Earrings, Bracelet & Ring", "black-clover-necklace-set", "necksets",
    "The complete black clover look: necklace, bracelet, stud earrings and ring.", [0, 2, 1, 3, 4, 5, 6],
    colour="Black & Gold", tags=["clover", "gift", "bestseller"], keywords=["clover jewellery set", "necklace set", "jewellery set for women"])
add("ESH-038", "ESH-0038 Heart Shape Chain", "Golden Open Heart Pendant Necklace", "open-heart-pendant-necklace", "pendants",
    "A softly sculpted open heart on a fine snake chain — a gift that says it all.", [3, 2, 0, 1, 4, 5, 6, 7, 8],
    tags=["heart", "gift"], keywords=["heart pendant", "heart necklace", "gift for girlfriend", "valentine gift"])
add("ESH-039", "ESH-0039 Clover Necklace", "Black Clover Necklace", "black-clover-necklace", "necklaces",
    "Black clover motifs along a fine gold-tone chain — the signature everyday necklace.", [1, 0, 2, 3, 4],
    colour="Black & Gold", tags=["clover", "bestseller"], keywords=["clover necklace", "black necklace", "four leaf clover"])
add("ESH-045", "ESH-0045", "Layered Snake Chain Open Heart Necklace", "layered-snake-chain-heart-necklace", "necklaces",
    "Two golden layers in one: a flat snake chain and a fine chain with an open heart.", [2, 4, 1, 3, 0],
    tags=["heart", "layering", "new"], keywords=["layered necklace", "heart necklace", "snake chain"])
add("ESH-046", "ESH-0046", "Golden Heart Necklace & Stud Earrings Set", "golden-heart-necklace-earrings-set", "necksets",
    "A sculpted golden heart pendant with matching heart studs.", [0, 1, 2, 3, 4],
    tags=["heart", "gift", "new"], keywords=["heart necklace set", "necklace with earrings", "jewellery set for women", "gift for her"])
add("ESH-047", "ESH-0047", "Emerald Green Stone Pendant Snake Chain Necklace", "emerald-green-pendant-snake-chain-necklace", "pendants",
    "A rectangular emerald-green stone pendant on a flat golden snake chain.", [3, 7, 0, 1, 2, 4, 5, 6],
    colour="Green & Gold", tags=["new"], keywords=["green stone pendant", "emerald necklace", "snake chain pendant"])
add("ESH-048", "ESH-0048", "Pink Stone Leaf Vine Necklace", "pink-stone-leaf-vine-necklace", "necklaces",
    "A sweet V of pink stone leaves on a fine gold-tone chain.", [4, 0, 2, 3, 1, 5, 6, 7, 8],
    colour="Pink", tags=["floral", "new"], keywords=["pink necklace", "stone necklace", "flower necklace"])
add("ESH-049", "ESH-0049", "Pink Stone Vine Necklace & Bracelet Set", "pink-stone-vine-necklace-bracelet-set", "necksets",
    "A matching pink stone vine necklace and bracelet — a complete look, ready to gift.", [2, 4, 0, 3, 1, 5, 6, 7, 8],
    colour="Pink", tags=["floral", "gift", "new"], keywords=["necklace set", "necklace and bracelet set", "pink jewellery set", "gift for her"])
add("ESH-053", "ESH-0053", "Snake Chain & Heart Pendant Layered Necklace Set of 2", "snake-chain-heart-pendant-necklace-set", "necklaces",
    "Two necklaces to layer: a flat snake chain and a fine chain with a puffed heart pendant.", [1, 0, 2, 3, 4, 5, 6, 7],
    tags=["heart", "layering", "new"], keywords=["layered necklace", "heart pendant", "snake chain", "necklace set"])
add("ESH-054", "ESH-0054", "Bow & Puffed Heart Pendant Necklace", "bow-puffed-heart-pendant-necklace", "pendants",
    "A golden bow above a puffed heart, on a fine chain — romantic and on-trend.", [6, 5, 1, 2, 3, 4, 0],
    tags=["heart", "bow", "new"], keywords=["bow necklace", "heart pendant", "bow pendant"])
add("ESH-055", "ESH-0055", "Golden Bow Pendant Necklace", "golden-bow-pendant-necklace", "pendants",
    "A dainty golden bow on a fine beaded station chain.", [2, 0, 3, 4, 1, 5],
    tags=["bow", "new"], keywords=["bow necklace", "bow pendant", "minimal necklace"])
add("ESH-056", "ESH-0056", "Golden Puffed Heart Pendant Necklace", "golden-puffed-heart-pendant-necklace", "pendants",
    "A glossy puffed heart on a fine snake chain — a modern everyday favourite.", [2, 0, 1, 3, 4, 5, 6, 7, 8],
    tags=["heart", "gift", "bestseller"], keywords=["heart pendant", "heart necklace", "puffed heart necklace"])
add("ESH-057", "ESH-0057", "Double Layer Heart Pendant Necklace", "double-layer-heart-pendant-necklace", "necklaces",
    "A two-layer golden necklace finished with a puffed heart pendant.", [6, 4, 0, 1, 2, 3, 5, 7],
    tags=["heart", "layering", "new"], keywords=["layered necklace", "heart necklace", "double layer necklace"])
add("ESH-059", "ESH-0059", "Emerald Green Octagon Pendant Necklace", "emerald-green-octagon-pendant-necklace", "pendants",
    "An octagon-cut emerald-green stone in a golden frame on a fine chain.", [2, 1, 3, 0, 4, 5, 6, 7],
    colour="Green & Gold", tags=["new"], keywords=["green stone pendant", "emerald necklace", "stone pendant"])
add("ESH-060", "ESH-0060", "Pink & Green Flower Station Necklace", "pink-green-flower-station-necklace", "necklaces",
    "Pink stone flowers with green leaves at the centre of a fine gold-tone chain.", [1, 2, 3, 0, 4, 5],
    colour="Pink & Green", tags=["floral", "new"], keywords=["flower necklace", "pink necklace", "stone necklace"])
add("ESH-061", "ESH-0061", "Pink Rose Vine Necklace & Bracelet Set", "pink-rose-vine-necklace-bracelet-set", "necksets",
    "Pink roses and green leaves on a matching necklace and bracelet.", [2, 3, 4, 7, 0, 1, 5, 6],
    colour="Pink & Green", tags=["floral", "gift", "new"], keywords=["necklace set", "necklace and bracelet set", "flower jewellery set"])
add("ESH-066", "ESH-0066", "Green Clover Jewellery Set with Necklace, Bracelet, Earrings & Ring", "green-clover-jewellery-set", "necksets",
    "The complete green clover look: necklace, bracelet, stud earrings and ring.", [1, 3, 2, 0, 4, 5, 6, 8, 9],
    colour="Green & Gold", tags=["clover", "gift", "new"], keywords=["clover jewellery set", "green necklace set", "jewellery set for women"])

# ---------------- Rings
add("ESH-040", "ESH-0040 Nail Rings", "Golden Nail Ring", "golden-nail-ring", "rings",
    "A polished nail that wraps around the finger — bold, modern, unisex in spirit.", [0, 1, 2, 3, 4, 5],
    tags=["stacking"], keywords=["nail ring", "golden ring", "statement ring"])
add("ESH-041", "ESH-0041 Heartshaped Rings", "Golden Open Heart Ring", "golden-open-heart-ring", "rings",
    "An open heart sculpted in gold-tone — sweet, simple and stackable.", [3, 0, 2, 4, 5, 6, 1],
    tags=["heart", "gift"], keywords=["heart ring", "golden ring", "promise ring"])
add("ESH-042", "ESH-0042 Ad Red Rings", "Red American Diamond Cocktail Ring", "red-american-diamond-cocktail-ring", "rings",
    "Ruby-red stones framed by sparkling American diamonds — made for celebrations.", [1, 0, 3, 2],
    colour="Red & White", finish="Silver-tone", tags=["party"], keywords=["ad ring", "american diamond ring", "cocktail ring", "party wear ring"])
add("ESH-043", "ESH-0043 Cartier Ring Combo", "Solitaire & Screw Ring Set of 2", "solitaire-screw-ring-set-of-2", "ring-combos",
    "A solitaire-style ring and a screw motif band, designed to stack.", [1, 2, 3, 4],
    tags=["stacking", "gift"], keywords=["ring set", "stacking rings", "solitaire ring", "screw ring"])
