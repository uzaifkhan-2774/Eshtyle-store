# SEO — how E-SHTYLE products get found on Google

## What is built in

**Search-friendly product names.** Every product is named the way shoppers type into Google (“Golden Geometric Drop Earrings”, “Oxidised Silver Jhumka Earrings”, “American Diamond Cocktail Ring”). The original creative style name is kept on the product page as “Style”. URLs, image file names and alt text use the same words, for example `/product/golden-geometric-drop-earrings` with the image file `golden-geometric-drop-earrings-1.webp`.

**Page titles and descriptions.** Each product has an SEO title (“… for Women | E-SHTYLE”, under 70 characters) and a meta description. Each category has its own keyword-focused title and description, such as “Earrings for Women Online — Stylish Studs, Drops & Korean Earrings”. You can edit all of these in Admin → Products → *Google search listing* (with a live preview) and Admin → Categories.

**Google can read every page without JavaScript.** When the storefront is served by the API (`FRONTEND_DIST`), product, category, collection and home URLs return real HTML containing:
- the title, description, canonical URL, Open Graph and Twitter tags (these also give good link previews on WhatsApp and Instagram)
- Product structured data with price, availability, shipping and return policy, plus breadcrumbs, so Google can show price and stock in results
- a plain-HTML summary of the page with its heading, description, links and images
- a real 404 status for products that don't exist

**Google Shopping (free listings).** The feed at `/feeds/google.xml` lists every variant with its title, description, images, price, sale price, availability, colour, Google product category, brand, gender and age group.

**Sitemap with images** at `/sitemap.xml`, and `robots.txt` that keeps admin, account, cart and checkout pages out of search.

**On-site search** understands Indian spellings and synonyms: *earings, jhumki, kada, AD ring, anti tarnish, nazar, haar, moti*. It ignores filler words like “for women”, needs every remaining word to match, and ranks products whose name matches above tag-only matches.

## After the site is live (owner checklist)

1. **Google Search Console**: add your domain, verify it with a DNS record, submit `https://<domain>/sitemap.xml`, then use *URL inspection → Request indexing* for the home page and your top 10 products.
2. **Google Merchant Center** (free): create an account and verify and claim the website. Set up shipping (free above ₹499, otherwise ₹59) and a 7-day return policy. Add the feed `https://<domain>/feeds/google.xml` as a *scheduled fetch* (daily), and turn on *Free listings*. Your products can then appear in the Google Shopping tab and Google Images with price.
3. **Google Business Profile**: create one for E-SHTYLE (online retail), linking the website and Instagram.
4. **Bing Webmaster Tools**: import the site from Search Console.
5. Link the website from Instagram, WhatsApp Business and your marketplace listings. Backlinks and branded searches help ranking.

## Keep improving (routine, no code needed)

- When adding a product, start its **name** with the words people search: colour or material, then style, then type (“Pink Stone Tulip Bracelet”). Don't use other brands' names (Cartier, Van Cleef, etc.). That is a trademark risk, and Google Merchant Center rejects such products.
- If your supplier confirms **gold plating, 18K plating, brass base or anti-tarnish**, add that to the name, material and tags. “Gold Plated” is searched far more than “Golden”.
- Add **material, size and weight** for each product. Google shows these in results.
- Collect **genuine reviews**: star ratings appear in Google results once approved reviews exist.
- Write the category descriptions in your own words and keep them at 2–3 sentences. Avoid copying text from other sites.
- Make campaign pages (Admin → Marketing → Campaign pages) for seasonal searches like “Rakhi gift for sister”, “Diwali jewellery gift set” and “Valentine gift for girlfriend”.
- Results take time: new sites usually need 4–12 weeks to rank on Google. Shopping free listings can appear sooner once the feed is approved.

## Renamed products

| Original style name | Search-friendly name | URL |
|---|---|---|
| Sculpted Broad Cuff | **Golden Broad Cuff Bracelet** | `/product/golden-broad-cuff-bracelet` |
| Screw Motif Stone Bangle | **Golden Screw Bangle Bracelet with Stones** | `/product/golden-screw-bangle-bracelet-with-stones` |
| Clover, Screw & Nail Bracelet Trio | **Clover, Screw & Nail Bracelet Set of 3** | `/product/clover-screw-nail-bracelet-set-of-3` |
| Ribbed Line Cuff | **Golden Ribbed Wide Cuff Bracelet** | `/product/golden-ribbed-wide-cuff-bracelet` |
| Blossom Cuff | **Golden Flower Cuff Bracelet** | `/product/golden-flower-cuff-bracelet` |
| Bamboo Bangle | **Golden Bamboo Bangle Bracelet** | `/product/golden-bamboo-bangle-bracelet` |
| Nail & Screw Motif Bangle Duo | **Nail & Screw Bangle Bracelet Set of 2** | `/product/nail-screw-bangle-bracelet-set-of-2` |
| Pink Tulip Vine Bracelet | **Pink Stone Tulip Charm Bracelet** | `/product/pink-stone-tulip-bracelet` |
| Tulip Vine Bracelet | **Multicolour Stone Tulip Vine Bracelet** | `/product/multicolour-stone-tulip-bracelet` |
| Black Clover Bracelet | **Black Clover Charm Bracelet** | `/product/black-clover-bracelet` |
| Open Heart Necklace & Ring Set | **Heart Pendant Necklace & Ring Gift Set** | `/product/heart-necklace-and-ring-gift-set` |
| Blossom Earrings & Cuff Set | **Golden Flower Earrings & Cuff Bracelet Set** | `/product/flower-earrings-and-bracelet-set` |
| Cobalt Blossom Drop Earrings | **Blue Flower Drop Earrings** | `/product/blue-flower-drop-earrings` |
| Pearl Bow Huggie Drops | **Pearl Bow Huggie Hoop Earrings** | `/product/pearl-bow-huggie-earrings` |
| The Earring Box | **Stud Earrings Gift Box Set** | `/product/stud-earrings-gift-box-set` |
| Korean Stud Earring Combo | **Korean Earrings Combo Pack** | `/product/korean-earrings-combo-pack` |
| Everyday Earring Combo Card | **Daily Wear Earrings Combo Set** | `/product/daily-wear-earrings-combo-set` |
| Emerald Blossom Drop Earrings | **Green Flower Drop Earrings** | `/product/green-flower-drop-earrings` |
| Lily Petal Stud Earrings | **Lily Flower Stud Earrings** | `/product/lily-flower-stud-earrings` |
| Oxidised Geometric Jhumka Drops | **Oxidised Silver Geometric Jhumka Earrings** | `/product/oxidised-silver-jhumka-earrings` |
| Peach & Sage Blossom Earrings | **Peach & Green Flower Earrings with Pearl** | `/product/peach-green-flower-pearl-earrings` |
| Graduated Sphere Dangle Earrings | **Rose Gold Plated Ball Drop Earrings** | `/product/rose-gold-plated-ball-drop-earrings` |
| Emerald Teardrop Charm Earrings | **Green Teardrop Stone Drop Earrings** | `/product/green-teardrop-drop-earrings` |
| The Amber Ice | **Amber Crystal Oval Stud Earrings** | `/product/amber-crystal-oval-earrings` |
| The Aurea Sculpt | **Golden Chunky Oval Earrings** | `/product/golden-chunky-oval-earrings` |
| The Golden Nazar Drop | **Evil Eye Nazar Huggie Earrings** | `/product/evil-eye-nazar-earrings` |
| The Golden Trilogy | **Tri-Tone Ball & Disc Drop Earrings** | `/product/tri-tone-drop-earrings` |
| The Modernist Drop | **Golden Geometric Textured Drop Earrings** | `/product/golden-geometric-drop-earrings` |
| The Noir Rose | **Black & Rose Gold Petal Earrings** | `/product/black-rose-gold-petal-earrings` |
| The Sunburst Spike | **Golden Sunburst Statement Earrings** | `/product/golden-sunburst-earrings` |
| The Terrazzo Triangle | **Peach Triangle Stud Earrings** | `/product/peach-triangle-stud-earrings` |
| The White Clover Dangles | **White Clover Drop Hoop Earrings** | `/product/white-clover-drop-earrings` |
| Coral Blossom Drop Earrings | **Orange Flower Drop Earrings** | `/product/orange-flower-drop-earrings` |
| Butterfly CZ Pendant Necklace | **Anti-Tarnish Butterfly Pendant Necklace** | `/product/anti-tarnish-butterfly-pendant-necklace` |
| Bar Drop Gold Chain Necklace | **Anti-Tarnish Golden Y Chain Necklace** | `/product/anti-tarnish-golden-y-chain-necklace` |
| Bow Pendant Snake Chain | **Bow Pendant Snake Chain Necklace** | `/product/bow-pendant-snake-chain-necklace` |
| White Clover Station Necklace | **White Clover Necklace** | `/product/white-clover-necklace` |
| Golden Clover Station Necklace | **Golden Clover Necklace** | `/product/golden-clover-necklace` |
| Golden Snake Chain | **Golden Flat Snake Chain Necklace** | `/product/golden-snake-chain-necklace` |
| Green Clover Station Necklace | **Green Clover Necklace** | `/product/green-clover-necklace` |
| Flat Snake Chain | **Flat Snake Chain Necklace in Gold & Silver** | `/product/snake-chain-necklace-gold-silver` |
| Black Clover Neckset | **Black Clover Necklace Set with Earrings & Ring** | `/product/black-clover-necklace-set` |
| Open Heart Pendant Chain | **Open Heart Pendant Necklace** | `/product/open-heart-pendant-necklace` |
| Black Clover Station Necklace | **Black Clover Necklace** | `/product/black-clover-necklace` |
| Double Heart Pendant Necklace | **Double Heart Pendant Necklace** | `/product/double-heart-pendant-necklace` |
| Emerald Baguette Station Necklace | **Green Stone Station Necklace** | `/product/green-stone-station-necklace` |
| Shell Pearl Pendant Necklace | **Shell Pearl Pendant Necklace** | `/product/shell-pearl-pendant-necklace` |
| Emerald Bloom Cocktail Ring | **Green American Diamond Cocktail Ring** | `/product/green-american-diamond-cocktail-ring` |
| Starburst American Diamond Ring | **White American Diamond Cocktail Ring** | `/product/white-american-diamond-cocktail-ring` |
| Screw Motif Band Ring | **Golden Screw Band Ring** | `/product/golden-screw-band-ring` |
| Round Stone Solitaire Ring | **Round Stone Solitaire Ring** | `/product/round-stone-solitaire-ring` |
| Open Heart Ring | **Golden Open Heart Ring** | `/product/golden-open-heart-ring` |
| Nail Wrap Ring | **Golden Nail Ring** | `/product/golden-nail-ring` |
| Ruby Cross Cocktail Ring | **Red American Diamond Cocktail Ring** | `/product/red-american-diamond-cocktail-ring` |
| Blush Lotus Cocktail Ring | **Pink Flower American Diamond Cocktail Ring** | `/product/pink-flower-american-diamond-ring` |
| Solitaire & Screw Motif Ring Duo | **Solitaire & Screw Ring Set of 2** | `/product/solitaire-screw-ring-set-of-2` |
| Heart Stone Ring | **Heart Stone Ring** | `/product/heart-stone-ring` |
| Oval Stone Ring | **Oval Stone Ring** | `/product/oval-stone-ring` |
| Square Stone Ring | **Square Stone Ring** | `/product/square-stone-ring` |
