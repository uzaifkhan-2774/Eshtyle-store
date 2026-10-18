# Source-of-truth mapping from the owner's photo folders to seed products.
# price_known=True only where the owner's folder name carried a price.
# All other prices are SAMPLE values and are flagged priceReviewRequired in the DB.
P = []
def add(folder, name, cat, price, sku=None, known=False, line="", finish="Gold-tone", colour="Gold", tags=(), variants=None, anti_tarnish=False, extra_folders=(), sub=None):
    P.append(dict(folder=folder, name=name, category=cat, subcategory=sub, price=price, sku=sku, priceKnown=known, line=line,
                  finish=finish, colour=colour, tags=list(tags), variants=variants, antiTarnish=anti_tarnish, extraFolders=list(extra_folders)))

B="Bracelet/"; E="Earings/"; N="Necklace-Chain/"; R="Rings/"; C="Combo/"
# ---------- Bracelets / bangles / cuffs
add(B+"ESH-001 Broad bracelet","Sculpted Broad Cuff","arm-cuffs",549,"ESH-001",line="A wide, softly concave cuff with a mirror finish that catches light from every angle.",tags=["statement","cuff"])
add(B+"ESH-002 Single Cartier Bracelet","Screw Motif Stone Bangle","bangles",449,"ESH-002",line="A clean oval bangle punctuated with screw motifs and sparkling stones — the everyday stacking essential.",tags=["bestseller","stacking"])
add(B+"ESH-0027 3 combo bracelet","Clover, Screw & Nail Bracelet Trio","bracelets",899,"ESH-0027",line="Three signature silhouettes in one set: a black clover chain, a screw motif bangle and a nail cuff.",tags=["bestseller","stacking","gift"],sub="bracelet-combos")
add(B+"ESH-003 line Bracelet (4)","Ribbed Line Cuff","arm-cuffs",499,"ESH-003",line="Fine vertical ribbing on a bold, open cuff — architectural and effortless with workwear.",tags=["new"])
add(B+"ESH-0042 Flower bracelet","Blossom Cuff","bracelets",429,"ESH-0042",line="Hand-sculpted gold-tone blossoms that wrap the wrist in a soft garden of petals.",tags=["new","floral"])
add(B+"ESH-0043 bamboo bracelet","Bamboo Bangle","bangles",349,"ESH-0043",line="A slender jointed bangle inspired by bamboo — minimal, refined, easy to layer.",tags=["stacking"])
add(B+"ESH-0044 Nail and Cartier bracelet  ","Nail & Screw Motif Bangle Duo","bangles",749,"ESH-0044",line="The power pair: a nail-wrap cuff and a screw motif bangle, designed to be worn together.",tags=["bestseller","stacking","gift"],extra_folders=[B+"ESH-001 Broad bracelet/cartier baraclate"])
add(B+"ESH-0045 Pink Tulip Bracelet","Pink Tulip Vine Bracelet","bracelets",399,"ESH-0045",line="A delicate vine of blush-pink tulip stones on a gold-tone chain.",colour="Pink",tags=["floral","gift"])
add(B+"ESH-0077 Tulip bracelet","Tulip Vine Bracelet","bracelets",399,"ESH-0077",line="Petite tulip-cut stones climbing a fine vine — choose the palette that speaks to you.",tags=["floral","bestseller"],variants=[
  ("ESH-0000 Pink Purple Golden tulip bracelet","Pink & Purple / Gold","ESH-0077-PPG"),
  ("ESH-0023 Pink Purple Silver tulip bracelet","Pink & Purple / Silver","ESH-0023"),
  ("ESH-0024 Pink Green Golden tulip bracelet","Pink & Green / Gold","ESH-0024"),
  ("ESH-0025 Blue Golden tulip bracelet","Blue / Gold","ESH-0025"),
  ("ESH-0026 Red Green Golden tulip bracelet","Red & Green / Gold","ESH-0026"),
  ("ESH-0000 Silver Pink tulip bracelet","Pink / Silver","ESH-0077-PS"),
  ("ESH-0000 White tulip bracelet","White / Gold","ESH-0077-W")])
add(B+"ESH-0079 Black Clover Bracelet","Black Clover Bracelet","bracelets",399,"ESH-0079",line="Five onyx-black clover motifs framed in gold-tone — timeless, graphic, endlessly wearable.",colour="Black & Gold",tags=["bestseller","clover"])
# ---------- Combos / gift sets
add(C+"ESH-0018 Heartshaped ring and chain combo","Open Heart Necklace & Ring Set","gift-sets",549,"ESH-0018-SET",line="A matching open-heart pendant and ring, presented ready to gift.",tags=["gift","heart"])
add(C+"ESH-0022 Flower earring and bracelet combo","Blossom Earrings & Cuff Set","gift-sets",699,"ESH-0022",line="Sculpted blossom studs paired with the matching petal cuff.",tags=["gift","floral"])
# ---------- Earrings
add(E+"Blue Flower Earrings","Cobalt Blossom Drop Earrings","earrings",249,"ESH-E101",line="Two tiers of matte cobalt petals with gold-tone centres — a joyful pop of colour.",colour="Blue",tags=["floral"])
add(E+"ESH-0015 Cream Earring","Pearl Bow Huggie Drops","earrings",229,"ESH-0015",line="Gold-tone huggies with a sparkling bow and a lustrous faux-pearl drop.",colour="Cream & Gold",tags=["pearl","new"])
add(E+"ESH-0028 Earrings box","The Earring Box","jewellery-box-sets",999,"ESH-0028",line="A curated case of petite studs — florals, pearls and bows — in a keepsake box.",tags=["gift","bestseller"])
add(E+"ESH-006 TO ESH-0016 Korean Earring Combo","Korean Stud Earring Combo","earring-combos",249,"ESH-0006",line="Curated sets of dainty Korean-style studs. Pick the combo that matches your mood.",tags=["bestseller","combo"],variants=[
  ("2p combo-1","2-Pair Combo 1",None),("2p combo-2","2-Pair Combo 2",None),("2p combo-4","2-Pair Combo 4",None),("2p combo-13","2-Pair Combo 13",None),
  ("3p combo-3","3-Pair Combo 3",None),("3p combo-5","3-Pair Combo 5",None),("3p combo-6","3-Pair Combo 6",None),("3p combo-7","3-Pair Combo 7",None),
  ("3p combo-8","3-Pair Combo 8",None),("3p combo-9","3-Pair Combo 9",None),("3p combo-10","3-Pair Combo 10",None),("3p combo-12","3-Pair Combo 12",None),
  ("4p combo-11","4-Pair Combo 11",None)])
add(E+"Earings Combo 180 Rs","Everyday Earring Combo Card","earring-combos",180,"ESH-E102",known=True,line="A card of everyday studs and hoops — one for every day of the week.",tags=["combo"])
add(E+"Green Flower Earing","Emerald Blossom Drop Earrings","earrings",249,"ESH-E103",line="Deep green matte petals in a cascading two-flower drop.",colour="Green",tags=["floral"])
add(E+"Korean Earrings variant","Lily Petal Stud Earrings","earrings",199,"ESH-E104",line="Oversized lily petals with textured gold-tone centres, in four soft shades.",tags=["floral","new"],variants=[
  ("pink","Pink",None),("green","Olive Green",None),("brown","Cocoa Brown",None),("white","Ivory White",None)])
add(E+"Oxidised Silver Geometric Square Triangle Drop Earrings for Women 135rs","Oxidised Geometric Jhumka Drops","earrings",135,"ESH-E105",known=True,finish="Oxidised silver-tone",colour="Silver",line="A modern take on the jhumka: stacked geometric forms finished with tiny bead fringe.",tags=["ethnic"])
add(E+"Pink Green Earring","Peach & Sage Blossom Earrings","earrings",229,"ESH-E106",line="Pearl-centred peach petals over a sage-green bloom.",colour="Peach & Green",tags=["floral"])
add(E+"Rose Gold-Plated Graduated Sphere Dangle Earrings 199 Rs","Graduated Sphere Dangle Earrings","earrings",199,"ESH-E107",known=True,finish="Rose gold-tone",colour="Rose Gold",line="Polished spheres in descending sizes — fluid movement with every turn.",tags=["new"])
add(E+"Spiral Emerald Charm Earrings","Emerald Teardrop Charm Earrings","earrings",249,"ESH-E108",finish="Silver-tone",colour="Green",line="A faceted emerald-green teardrop suspended beneath a crystal-set stud.",tags=["occasion"])
add(E+"The Amber Ice Earrings 120 Rs","The Amber Ice","earrings",120,"ESH-E109",known=True,colour="Amber",line="A faceted amber-tone stone set in a sleek oval frame.",tags=["statement"])
add(E+"The Aurea Sculpt 160Rs","The Aurea Sculpt","earrings",160,"ESH-E110",known=True,line="Molten, sculptural gold-tone ovals — quietly bold.",tags=["bestseller","minimal"])
add(E+"The Golden Nazar Drop 180 Rs","The Golden Nazar Drop","earrings",180,"ESH-E111",known=True,line="Evil-eye charms in a sunburst setting on petite huggies.",tags=["new"])
add(E+"The Golden Trilogy 179 Rs","The Golden Trilogy","earrings",179,"ESH-E112",known=True,finish="Tri-tone",colour="Mixed metal",line="Silver, rose and gold-tone spheres finished with a brushed disc.",tags=["statement"])
add(E+"The Modernist Drop 140 Rs","The Modernist Drop","earrings",140,"ESH-E113",known=True,line="Textured, folded gold-tone planes — art-gallery minimalism for your ears.",tags=["bestseller","minimal"])
add(E+"The Noir Rose 179 Rs","The Noir Rose","earrings",179,"ESH-E114",known=True,finish="Rose gold-tone with matte black enamel",colour="Black & Rose Gold",line="Matte black petals edged in rose gold-tone — moody and modern.",tags=["bestseller"],extra_folders=[E+"Mat Black Rose Gold Earings 179 Rs"])
add(E+"The Sunburst Spike 139 Rs","The Sunburst Spike","earrings",139,"ESH-E115",known=True,line="Radiating gold-tone spikes fanning out like a sunrise.",tags=["statement"])
add(E+"The Terrazzo Triangle 160 Rs","The Terrazzo Triangle","earrings",160,"ESH-E116",known=True,colour="Peach",line="Terrazzo-inspired triangular studs with a softly rounded frame.",tags=["minimal"])
add(E+"The White Clover Dangles 160 Rs","The White Clover Dangles","earrings",160,"ESH-E117",known=True,finish="Rose gold-tone",colour="White & Rose Gold",line="Double clover drops in mother-of-pearl-look white, hanging from slim hoops.",tags=["clover","bestseller"])
add(E+"Orange Flower Earings","Coral Blossom Drop Earrings","earrings",249,"ESH-E118",colour="Coral",line="Bright coral petals in a two-bloom cascade.",tags=["floral"])
# ---------- Necklaces / chains / pendants / necksets
add(N+"Anti-Tarnish Gold Butterfly Pendant Necklace with Cubic Zirconia","Butterfly CZ Pendant Necklace","pendants",399,"ESH-N101",anti_tarnish=True,line="An open butterfly pendant traced in cubic zirconia on a fine gold-tone chain.",tags=["new","pendant"])
add(N+"Anti-Tarnish Gold Chain Necklace for Women","Bar Drop Gold Chain Necklace","chains",349,"ESH-N102",anti_tarnish=True,line="A minimal Y-drop chain that elongates the neckline.",tags=["minimal"])
add(N+"Bow Pendant Flat Snake Chain Necklace for Women","Bow Pendant Snake Chain","pendants",399,"ESH-N103",line="A sweet bow pendant on a liquid flat snake chain.",tags=["new","pendant"])
add(N+"ESH-0019 White Clover Necklace","White Clover Station Necklace","necklaces",449,"ESH-0019",colour="White & Gold",line="White clover motifs spaced along a fine chain — the modern heirloom.",tags=["clover","bestseller"])
add(N+"ESH-0020 Golden Clover Necklace","Golden Clover Station Necklace","necklaces",449,"ESH-0020",line="All-gold-tone clover stations for a tonal, polished look.",tags=["clover"])
add(N+"ESH-0020 Golden Clover Necklace/Golden Snake Chain","Golden Snake Chain","chains",299,"ESH-N104",line="A fluid flat snake chain with a liquid-metal sheen.",tags=["minimal","bestseller"])
add(N+"ESH-0021 Green Clover Necklace","Green Clover Station Necklace","necklaces",449,"ESH-0021",colour="Green & Gold",line="Malachite-green clovers that bring colour to neutral outfits.",tags=["clover"])
add(N+"ESH-0029 silver golden chain","Flat Snake Chain","chains",299,"ESH-0029",line="The essential flat snake chain, in gold-tone or silver-tone.",tags=["minimal"],variants=[("__all__","Gold-tone","ESH-0029-G"),("__all__","Silver-tone","ESH-0029-S")])
add(N+"ESH-0037 Clover Neckset","Black Clover Neckset","necksets",1199,"ESH-0037",colour="Black & Gold",line="The complete clover look: necklace, bracelet, earrings and ring in one coordinated set.",tags=["gift","clover","bestseller"])
add(N+"ESH-0046 Heart Shape Chain","Open Heart Pendant Chain","pendants",349,"ESH-0046",line="A softly rounded open heart on a sleek snake chain.",tags=["heart","gift"])
add(N+"ESH-0047 Clover Necklace","Black Clover Station Necklace","necklaces",449,"ESH-0047",colour="Black & Gold",line="Onyx-black clovers on a fine gold-tone chain.",tags=["clover","bestseller"])
add(N+"Elegant Double Heart Pendant Necklace","Double Heart Pendant Necklace","pendants",399,"ESH-N105",line="Two interlocking hearts — one polished, one stone-set.",tags=["heart","gift"])
add(N+"Green Emerald Baguette Station Necklace for Women","Emerald Baguette Station Necklace","necklaces",499,"ESH-N106",colour="Green & Gold",line="Emerald-green baguette stones stationed along a delicate chain.",tags=["occasion","new"])
add(N+"Organic Shell Pearl Pendant Necklace for Women","Shell Pearl Pendant Necklace","pendants",399,"ESH-N107",colour="Ivory & Gold",line="An organic shell-pearl drop on a fine gold-tone chain.",tags=["pearl"])
# ---------- Rings
add(R+"Ad Green Rings","Emerald Bloom Cocktail Ring","rings",499,"ESH-R101",finish="Silver-tone with American Diamond (CZ)",colour="Green",line="A layered starburst of green and clear American Diamond stones — made for celebrations.",tags=["occasion","statement"])
add(R+"Ad White Rings","Starburst American Diamond Ring","rings",449,"ESH-R102",finish="Silver-tone with American Diamond (CZ)",colour="Silver",line="A radiant floral starburst of clear American Diamond stones.",tags=["occasion"])
add(R+"Cartier Rings","Screw Motif Band Ring","rings",299,"ESH-R103",line="A polished band with screw motifs and a single bezel-set stone.",tags=["stacking","bestseller"])
add(R+"Circle Shaped Rings","Round Stone Solitaire Ring","rings",249,"ESH-R104",line="A round cabochon-style stone on a slim gold-tone band.",tags=["new"],variants=[("Green Ring","Green",None),("Purple Ring","Purple",None),("Red Ring","Red",None),("White Ring","White",None),("White Drop Ring","White Drop",None)])
add(R+"ESH-0018 Heartshaped Rings","Open Heart Ring","rings",249,"ESH-0018",line="A softly drawn open heart on a fine band.",tags=["heart"])
add(R+"ESH-0030 Nail Rings","Nail Wrap Ring","rings",299,"ESH-0030",line="A sleek nail silhouette that wraps the finger.",tags=["stacking","bestseller"])
add(R+"ESH-0035 Ad Red Rings","Ruby Cross Cocktail Ring","rings",449,"ESH-0035",finish="Silver-tone with American Diamond (CZ)",colour="Red",line="Ruby-red stones in a cross formation, framed by sparkling American Diamond stones.",tags=["occasion"])
add(R+"ESH-0036 Ad Pink Rings","Blush Lotus Cocktail Ring","rings",449,"ESH-0036",finish="Silver-tone with American Diamond (CZ)",colour="Pink",line="Frosted blush petals open around a pavé centre.",tags=["occasion","new"])
add(R+"ESH-0038 Cartier Ring Combo","Solitaire & Screw Motif Ring Duo","ring-combos",499,"ESH-0038",line="A solitaire band and a screw motif band — the perfect stack.",tags=["stacking","gift"])
add(R+"Heart Rings","Heart Stone Ring","rings",249,"ESH-R105",line="A heart-cut stone on a slender gold-tone band.",tags=["heart"],variants=[("Black Ring","Black",None),("Mate Pink Ring","Matte Pink",None),("Pink Ring","Pink",None),("Purple Ring","Purple",None),("Red Ring","Red",None),("White Ring","White",None)])
add(R+"Oval Rings","Oval Stone Ring","rings",249,"ESH-R106",line="An elongated oval stone, softly set on a slim band.",tags=["new"],variants=[("Light Pink Ring","Light Pink",None),("Mate Pink Ring","Matte Pink",None),("Pink Ring","Pink",None),("Red Ring","Red",None),("White Ring","White",None)])
add(R+"Square Shaped Rings","Square Stone Ring","rings",249,"ESH-R107",line="A square-cut stone with clean geometric lines.",variants=[("Black Ring","Black",None),("Green Ring","Green",None),("Orange Ring","Orange",None),("Pink Squre","Pink",None),("Purple Ring","Purple",None),("Red Ring","Red",None)])
