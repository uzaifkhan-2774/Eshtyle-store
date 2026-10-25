/**
 * Seeds categories, collections, banners, settings and the E-SHTYLE catalogue built from the owner's photos.
 * catalog.json = the owner's catalogue (SKU, price, stock, photos). It carries a version: the first time a
 * database sees a new version, prices/stock/photos of those SKUs are applied and seeded products that are no
 * longer in the catalogue are archived (hidden, never deleted). After that, re-runs never overwrite admin edits.
 *
 * Usage: npm run seed            (adds/updates; never deletes orders or users)
 *        npm run seed -- --reset (drops catalogue collections first — DEV ONLY)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { Category, Collection, Product, ProductVariant, Banner, Coupon, Reel, getSettings, StoreSettings } from '../src/models/index.js';
import { RETURN_REASONS } from '../src/models/StoreSettings.js';
import { refreshProductStock } from '../src/services/inventory.js';
import { isProd } from '../src/config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawCatalog = JSON.parse(fs.readFileSync(path.join(here, 'catalog.json'), 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.products;
const CATALOG_VERSION = Array.isArray(rawCatalog) ? null : rawCatalog.version;
const reset = process.argv.includes('--reset');
// Safe by default: products/banners/reels that already exist are left untouched, so price or text edits made in the admin panel survive a re-run.
// --refresh-catalog rewrites the sample catalogue from catalog.json (overwrites admin edits to those products).
let refresh = process.argv.includes('--refresh-catalog') || reset;
const W = (doc) => (refresh ? { $set: doc } : { $setOnInsert: doc });
// Repair: data seeded by an older version can point at photo files that no longer exist (renamed for SEO).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const missingFile = (u) => typeof u === 'string' && u.startsWith('/uploads/') && !fs.existsSync(path.join(ROOT, decodeURIComponent(u.split('?')[0])));
const broken = (imgs) => (imgs || []).some((im) => missingFile(im?.url) || missingFile(im?.thumb));
let repaired = 0;
if (reset && isProd) { console.error('Refusing --reset in production.'); process.exit(1); }

// [name, slug, description, seo title, meta description] — written around what shoppers in India search for.
const CATEGORIES = [
  ['Earrings', 'earrings', 'Studs, drops, hoops, Korean-style and statement earrings for every mood — from office wear to party wear.', 'Earrings for Women Online — Stylish Studs, Drops & Korean Earrings', 'Shop stylish earrings for women: Korean earrings, golden drop earrings, studs, huggies, jhumkas and statement earrings. Cash on Delivery across India.'],
  ['Earring Combos', 'earring-combos', 'Curated earring sets — more looks, one box. Great value and easy to gift.', 'Earrings Combo Sets for Women — Korean Earring Combo Packs', 'Earring combo packs and sets for women: Korean stud combos, daily-wear earring sets and gift boxes. Delivered across India with COD.'],
  ['Necklaces', 'necklaces', 'Clover necklaces, station necklaces and everyday layering pieces.', 'Necklaces for Women Online — Clover & Stylish Necklaces', 'Shop necklaces for women: four leaf clover necklaces, green stone and station necklaces for office and party wear. COD available across India.'],
  ['Chains', 'chains', 'Snake chains and fine chains to wear alone or layered.', 'Chains for Women — Golden & Silver Snake Chain Necklaces', 'Golden and silver chains for women: flat snake chains and minimal everyday chains to wear alone or layered. Shop online at E-SHTYLE with Cash on Delivery.'],
  ['Pendants', 'pendants', 'Hearts, bows, butterflies and pearls on delicate chains.', 'Pendant Necklaces for Women — Heart, Butterfly & Pearl Pendants', 'Chains with pendants for women: heart, butterfly, bow and pearl pendant necklaces. Perfect gifts. Shop online with Cash on Delivery.'],
  ['Necksets', 'necksets', 'Coordinated necklace sets for a complete look.', 'Necklace Sets for Women — Clover Jewellery Sets', 'Coordinated necklace sets with earrings, bracelet and ring — ready to wear and to gift. Shop jewellery sets online at E-SHTYLE.'],
  ['Rings', 'rings', 'American diamond cocktail rings, solitaires and stackable bands.', 'Rings for Women Online — AD Cocktail Rings & Stone Rings', 'Shop rings for women: American diamond (AD) cocktail rings, stone rings, heart rings and stacking rings. Delivered across India with COD.'],
  ['Ring Combos', 'ring-combos', 'Ring pairs designed to stack.', 'Ring Sets for Women — Stacking Ring Combos', 'Stacking ring sets and ring combos for women. Shop online at E-SHTYLE with Cash on Delivery.'],
  ['Bracelets', 'bracelets', 'Clover, tulip and charm bracelets — and stacks that work together.', 'Bracelets for Women Online — Clover, Charm & Stone Bracelets', 'Shop bracelets for women: clover bracelets, stone tulip bracelets, charm bracelets and bracelet sets. Cash on Delivery across India.'],
  ['Bangles', 'bangles', 'Polished bangles for everyday stacking.', 'Bangles & Kada for Women — Golden Bangle Bracelets', 'Golden bangle bracelets and kada for women: screw bangles, bamboo bangles and stackable sets. Shop online at E-SHTYLE.'],
  ['Arm Cuffs', 'arm-cuffs', 'Bold sculpted cuffs.', 'Cuff Bracelets for Women — Golden Wide Cuffs', 'Bold golden cuff bracelets for women: broad, ribbed and sculpted cuffs for statement styling. Shop online with COD.'],
  ['Anklets', 'anklets', 'Delicate anklets.', 'Anklets for Women', 'Delicate anklets for women from E-SHTYLE.'],
  ['Jewellery Box Sets', 'jewellery-box-sets', 'Boxed collections ready to gift.', 'Jewellery Gift Boxes — Earring Box Sets', 'Jewellery gift boxes and earring box sets, ready to gift. Shop online at E-SHTYLE.'],
  ['Jewellery Gift Sets', 'gift-sets', 'Matching sets, presented beautifully.', 'Jewellery Gift Sets for Women — Gifts for Her', 'Jewellery gift sets for women: matching necklace & ring sets and earring & bracelet sets. Thoughtful gifts for her, delivered across India.'],
];
const CATEGORY_KEYWORDS = {
  earrings: ['earrings for women', 'stylish earrings', 'earrings online'], 'earring-combos': ['earrings for women', 'earrings combo', 'earring set'],
  necklaces: ['necklace for women', 'stylish necklace'], chains: ['chain for women', 'necklace for women'], pendants: ['pendant for women', 'necklace for women', 'chain with pendant'],
  necksets: ['necklace set', 'jewellery set'], rings: ['ring for women', 'finger ring'], 'ring-combos': ['ring for women', 'ring set'],
  bracelets: ['bracelet for women', 'hand jewellery'], bangles: ['bangles for women', 'bracelet for women', 'kada for women'], 'arm-cuffs': ['bracelet for women', 'cuff bracelet'],
  'gift-sets': ['jewellery gift set', 'gift for her', 'gift for girlfriend'], 'jewellery-box-sets': ['gift for her', 'jewellery gift box'],
};
const SUBCATS = [['Bracelet Combos', 'bracelet-combos', 'bracelets']];

const CARE = 'Keep away from perfume, sanitiser, lotions and water. Put your jewellery on last and take it off first. Wipe gently with a soft dry cloth after wear and store each piece separately in its pouch or box, away from humidity.';

/** One-time store changes. Safe to run every time: each runs once per database. */
async function runMigrations() {
  const s = await getSettings();
  const done = new Set(s.migrations || []);
  const mark = (k) => StoreSettings.updateOne({ key: 'store' }, { $addToSet: { migrations: k } });
  if (!done.has('free-shipping-cod49')) {
    // Owner's rule: shipping is free on every order; Cash on Delivery pays ₹49 extra.
    await StoreSettings.updateOne({ key: 'store' }, { $set: { 'shipping.freeAbove': 0, 'shipping.flatRate': 0, 'cod.fee': 4900, 'cod.enabled': true } });
    await StoreSettings.updateOne({ key: 'store', 'announcement.text': { $in: ['', 'Free shipping on orders above ₹499 · Cash on Delivery available'] } },
      { $set: { announcement: { text: 'Free shipping on every order · ₹100 off your first order with code WELCOME100', link: '/shop', isActive: true } } });
    await mark('free-shipping-cod49'); console.log('Shipping is now free on all orders; COD fee ₹49.');
  }
  if (!done.has('welcome100')) {
    if (!(await Coupon.exists({ code: 'WELCOME100' }))) await Coupon.create({ code: 'WELCOME100', description: '₹100 off your first order of ₹599 or more', type: 'flat', value: 10000, minOrderValue: 59900, firstOrderOnly: true, perUserLimit: 1, campaign: 'welcome', isActive: true });
    await mark('welcome100'); console.log('Created first-order coupon WELCOME100 (₹100 off ₹599+).');
  }
  // ₹1 product for testing online payments. Hidden from the shop; open it by its link. Archive it in Admin when done.
  if (!(await Product.exists({ sku: 'ESH-TEST-001' }))) {
    const cat = await Category.findOne({ slug: 'gift-sets' }) || await Category.findOne({});
    if (cat) {
      const p = await Product.create({ name: 'Payment Test Product (₹1)', slug: 'payment-test-product', sku: 'ESH-TEST-001', category: cat._id, status: 'published', isListed: false, price: 100,
        shortDescription: 'For testing online payments only. Not a real product.', description: 'This item exists only to test the payment gateway with a ₹1 order. It is hidden from the shop. Cancel and refund test orders from Admin → Orders.',
        images: [{ url: '/brand/logo.png', alt: 'E-SHTYLE payment test' }], returnable: false, codAvailable: true, seo: { title: 'Payment test', description: 'Payment test product' } });
      await ProductVariant.create({ product: p._id, sku: 'ESH-TEST-001', title: 'Default', price: 100, stock: 1 });
      await refreshProductStock([p._id]);
      console.log('Added hidden ₹1 payment-test product: /product/payment-test-product');
    }
  }
}

async function main() {
  await connectDb();
  if (process.argv.includes('--if-empty') && await Product.exists({}) && (!CATALOG_VERSION || (await getSettings()).catalogVersion === CATALOG_VERSION)) {
    const needsRepair = (await Product.find({ status: { $ne: 'archived' } }, 'images').lean()).some((x) => broken(x.images)) || (await Banner.find({ isActive: true }, 'image mobileImage').lean()).some((x) => missingFile(x.image?.url) || missingFile(x.mobileImage?.url));
    if (!needsRepair) { await runMigrations(); console.log('Catalogue already present — skipping seed.'); await disconnectDb(); return; }
    console.log('Found products/banners with missing photos from an older version — repairing…');
  }
  if (reset && process.env.NODE_ENV === 'production') { console.error('Refusing --reset in production: it would delete the live catalogue.'); process.exit(1); }
  if (reset) {
    for (const M of [Category, Collection, Product, ProductVariant, Banner]) await M.deleteMany({});
    console.log('Catalogue collections cleared.');
  }
  // New catalogue version (owner sent a new price/stock list) → apply it once to this database.
  const settingsDoc = await getSettings();
  const newVersion = CATALOG_VERSION && settingsDoc.catalogVersion !== CATALOG_VERSION;
  if (newVersion) { refresh = true; console.log(`Applying catalogue ${CATALOG_VERSION}: new prices, stock and photos.`); }
  // Product photos are used straight from the links in the owner's product sheet (change a link → change the photo).
  for (const item of catalog) for (const im of item.images || []) { if (im.src) { im.url = im.src; delete im.src; } }
  const catId = {};
  for (const [i, [name, slug, description, seoTitle, seoDescription]] of CATEGORIES.entries()) {
    const c = await Category.findOneAndUpdate({ slug }, { $setOnInsert: { name, slug, description, sortOrder: i, isPublished: slug !== 'anklets', showInNav: true, seo: { title: seoTitle, description: seoDescription } } }, { upsert: true, new: true });
    catId[slug] = c._id;
  }
  for (const [name, slug, parent] of SUBCATS) {
    const c = await Category.findOneAndUpdate({ slug }, { $setOnInsert: { name, slug, parent: catId[parent], isPublished: true, showInNav: false } }, { upsert: true, new: true });
    catId[slug] = c._id;
  }

  const now = Date.now();
  let n = 0;
  for (const [idx, item] of catalog.entries()) {
    const isNew = item.tags.includes('new');
    const createdAt = new Date(now - (isNew ? idx * 3600e3 : (40 + idx) * 86400e3));
    const tags = [...new Set([...item.tags, ...(item.keywords || []), ...(CATEGORY_KEYWORDS[item.category] || []), ...item.variants.filter((v) => !/combo/i.test(v.label)).map((v) => v.label.toLowerCase()), ...(item.antiTarnish ? ['anti-tarnish'] : []), ...(item.category === 'gift-sets' || item.category === 'jewellery-box-sets' || item.tags.includes('gift') ? ['gift'] : []), ...(item.category.includes('combo') || item.tags.includes('combo') ? ['combo'] : [])])];
    const alt = (i) => `${item.name} by E-SHTYLE${i ? ` — view ${i + 1}` : ''}`;
    const titleBase = `${item.name}${/set|combo|box/i.test(item.name) ? '' : ' for Women'}`;
    const seoTitle = (titleBase.length <= 58 ? `${titleBase} | E-SHTYLE` : `${item.name} | E-SHTYLE`).slice(0, 70);
    let seoDescription = `${item.line} Buy ${item.name} online at E-SHTYLE with Cash on Delivery across India.`;
    if (seoDescription.length > 165) seoDescription = `Buy ${item.name} online at E-SHTYLE. ${item.line}`.slice(0, 160).replace(/\s+\S*$/, '') + '…';
    const images = item.images.map((im, i) => ({ ...im, alt: alt(i) }));
    const doc = {
      name: item.name, slug: item.slug, sku: item.sku, category: catId[item.category], subcategory: item.subcategory ? catId[item.subcategory] : null,
      status: 'published', shortDescription: item.line,
      description: item.description ? `${item.line}\n\n${item.description}` : `${item.line}\n\n${item.styleName !== item.name ? `We call this style “${item.styleName}”. It is designed` : 'Designed'} for everyday elegance and easy to style from office wear to party wear. Each piece is checked and packed by hand before it ships, ready to keep or to gift.`,
      seo: { title: seoTitle, description: seoDescription },
      images, video: item.video ? { url: item.video, poster: images[0]?.url } : undefined, tags,
      jewelleryType: { earrings: 'Earrings', 'earring-combos': 'Earrings', necklaces: 'Necklace', chains: 'Chain', pendants: 'Pendant', necksets: 'Neckset', rings: 'Ring', 'ring-combos': 'Ring', bracelets: 'Bracelet', bangles: 'Bangle', 'arm-cuffs': 'Cuff', 'gift-sets': 'Gift set', 'jewellery-box-sets': 'Gift set' }[item.category],
      material: item.material || undefined,
      finish: item.finish, colour: item.colour.split(' & ')[0] === 'Mixed metal' ? 'Mixed metal' : item.colour,
      claims: { antiTarnish: item.antiTarnish, note: item.antiTarnish ? 'Anti-tarnish finish as described by the supplier. Verify before publishing durability claims.' : undefined },
      specifications: [...(item.styleName !== item.name ? [{ label: 'Style', value: item.styleName }] : []), { label: 'Finish', value: item.finish }, ...(item.material ? [{ label: 'Material', value: item.material }] : []), { label: 'Colour', value: item.colour }, ...(item.packOf > 1 ? [{ label: 'Pack of', value: String(item.packOf) }] : []), { label: 'SKU', value: item.sku }],
      careInstructions: CARE, packageContents: item.pick ? `${item.pick} designs of your choice, in E-SHTYLE packaging` : item.category.includes('combo') || item.category === 'gift-sets' ? 'Complete set as pictured, in E-SHTYLE packaging' : 'One piece (or pair, for earrings) in E-SHTYLE packaging',
      designPick: { count: item.pick || 0 },
      hsnCode: item.hsn || undefined,
      isFeatured: item.tags.includes('bestseller'), sortOrder: idx, isSampleData: true, priceReviewRequired: !item.priceKnown, price: item.price * 100, createdAt,
    };
    // Match by SKU (stable) or slug, so products seeded by an older version are updated instead of duplicated.
    const existing = await Product.findOne({ $or: [{ sku: item.sku }, { slug: item.slug }] }, '_id images slug sku').lean();
    let p;
    if (!existing) p = await Product.findOneAndUpdate({ sku: item.sku }, { $setOnInsert: doc }, { upsert: true, new: true, timestamps: false });
    else if (refresh) p = await Product.findByIdAndUpdate(existing._id, { $set: doc }, { new: true, timestamps: false });
    else if (broken(existing.images) || existing.sku !== item.sku) {
      // Old sample data: fix photos, link and SKU; keep any name/price/description edits made in admin.
      p = await Product.findByIdAndUpdate(existing._id, { $set: { images, video: doc.video, slug: item.slug, sku: item.sku } }, { new: true, timestamps: false });
      repaired++;
    } else p = existing;
    const variants = item.variants.length ? item.variants : [{ label: 'Default', sku: item.sku, images: [] }];
    for (const [vi, v] of variants.entries()) {
      const sku = (v.sku || `${item.sku}-${String(vi + 1).padStart(2, '0')}`).toUpperCase();
      const isSize = /^size\b/i.test(v.label);
      const colour = item.variants.length && !/combo/i.test(v.label) && !isSize ? v.label : undefined;
      const vdoc = { product: p._id, title: v.label, options: { colour, size: isSize ? v.label.replace(/^size\s*/i, '') : undefined, design: /combo/i.test(v.label) ? v.label : undefined }, price: item.price * 100, images: v.images.map((im, i) => ({ ...im, alt: `${item.name} in ${v.label} by E-SHTYLE${i ? ` — view ${i + 1}` : ''}` })), isActive: true, sortOrder: vi };
      const ev = refresh ? null : await ProductVariant.findOne({ sku }, 'images product').lean();
      if (ev && (broken(ev.images) || String(ev.product) !== String(p._id))) await ProductVariant.updateOne({ _id: ev._id }, { $set: { images: vdoc.images, product: p._id } });
      else if (!ev) await ProductVariant.findOneAndUpdate({ sku }, refresh ? { $set: { ...vdoc, isActive: true, ...((v.stock ?? item.stock) != null ? { stock: v.stock ?? item.stock } : {}) }, $setOnInsert: { ...((v.stock ?? item.stock) != null ? {} : { stock: 12 }), lowStockThreshold: 3 } } : { $setOnInsert: { ...vdoc, stock: item.stock ?? 12, lowStockThreshold: 3 } }, { upsert: true, new: true });
    }
    // Variants left over from an older version of this product (different SKU) are switched off, not deleted (orders keep their history).
    if (refresh) await ProductVariant.updateMany({ product: p._id, sku: { $nin: variants.map((v, vi) => (v.sku || `${item.sku}-${String(vi + 1).padStart(2, '0')}`).toUpperCase()) } }, { $set: { isActive: false } });
    await refreshProductStock([p._id]);
    n++;
  }
  if (newVersion || refresh) {
    // Seeded products that are not in the owner's current catalogue are hidden (archived), never deleted.
    const skus = catalog.map((i) => i.sku);
    const r = await Product.updateMany({ isSampleData: true, sku: { $nin: skus }, status: { $ne: 'archived' } }, { $set: { status: 'archived' } });
    if (r.modifiedCount) console.log(`Archived ${r.modifiedCount} old product(s) that are not in the current catalogue.`);
    // Categories that now have products (e.g. Anklets) are made visible.
    const usedCats = [...new Set(catalog.flatMap((i) => [catId[i.category], i.subcategory ? catId[i.subcategory] : null]).filter(Boolean).map(String))];
    await Category.updateMany({ _id: { $in: usedCats }, isPublished: false }, { $set: { isPublished: true } });
    // No piece in the current catalogue is sold as anti-tarnish: hide that collection and remove the claim from copy.
    await Collection.updateOne({ slug: 'anti-tarnish' }, { $set: { isPublished: false } });
    await Category.updateOne({ slug: 'chains', 'seo.description': /anti-tarnish/i }, { $set: { 'seo.description': 'Golden and silver chains for women: flat snake chains and minimal everyday chains to wear alone or layered. Shop online at E-SHTYLE with Cash on Delivery.' } });
    await StoreSettings.updateOne({ key: 'store', 'seo.defaultDescription': /anti-tarnish/i }, { $set: { 'seo.defaultDescription': 'Fashion jewellery from E-SHTYLE: earring combos, clover necklaces, tulip bracelets, rings and gift sets, delivered across India.' } });
  }
  // Category tile images from a strong product photo in each category.
  for (const [slug, id] of Object.entries(catId)) {
    const p = await Product.findOne({ category: id, status: 'published' }).sort({ isFeatured: -1, sortOrder: 1 }).lean();
    const pick = p?.images?.find((im, i) => i > 0) || p?.images?.[0];
    const cur = await Category.findById(id, 'image').lean();
    if (pick && cur?.image?.url && missingFile(cur.image.url)) await Category.updateOne({ _id: id }, { $unset: { image: 1 } });
    const model = { earrings: 'earrings', rings: 'rings', bracelets: 'bracelets', necklaces: 'necklaces' }[slug];
    if (refresh && (model || pick)) {
      const image = model ? { url: `/uploads/seed/banners/cat-v3-${model}.webp?v=${(CATALOG_VERSION || '1').replace(/-/g, '')}`, alt: `${CATEGORIES.find((c) => c[1] === slug)?.[0] || slug} for women by E-SHTYLE` } : { url: pick.url, thumb: pick.thumb, alt: `${CATEGORIES.find((c) => c[1] === slug)?.[0] || slug} for women by E-SHTYLE` };
      await Category.updateOne({ _id: id }, { $set: { image } });
      continue;
    }
    if (pick) await Category.updateOne({ _id: id, 'image.url': { $exists: false } }, { $set: { image: { url: pick.url, thumb: pick.thumb, alt: `${CATEGORIES.find((c) => c[1] === slug)?.[0] || slug} for women by E-SHTYLE` } } });
  }

  const cols = [
    { name: 'Bestsellers', slug: 'bestsellers', type: 'bestsellers', showInNav: true, sortOrder: 0, description: 'Ranked by real orders. Until sales data builds up, this shows our signature pieces.' },
    { name: 'New Arrivals', slug: 'new-arrivals', type: 'new_arrivals', showInNav: true, sortOrder: 1, description: 'The latest additions to the E-SHTYLE collection.' },
    { name: 'Sale', slug: 'sale', type: 'sale', showInNav: false, sortOrder: 2, description: 'Pieces with a genuine reduced price.' },
    { name: 'Earring Combos', slug: 'earring-combos-edit', type: 'tag', tag: 'combo', sortOrder: 4, description: 'More looks, one box — curated earring and jewellery combos.' },
    { name: 'Gift-Ready Sets', slug: 'gift-ready', type: 'tag', tag: 'gift', sortOrder: 5, description: 'Thoughtful sets presented beautifully — ready to give.' },
  ];
  for (const c of cols) await Collection.findOneAndUpdate({ slug: c.slug }, { $setOnInsert: { ...c, isPublished: true } }, { upsert: true });

  // Editorial banners built from the model photography (scripts/build_banners.py). Upserted by seedKey so
  // re-running the seed refreshes them without touching banners the owner created in the admin.
  await Banner.deleteMany({ seedKey: { $exists: false }, title: { $in: ['Everyday Elegance. Made to Shine.', 'The Earring Edit'] } });
  // ?v= changes whenever the banner photos are rebuilt, so browsers never show a cached old banner.
  const B = (n, s2) => `/uploads/seed/banners/${n}-${s2}.webp?v=${(CATALOG_VERSION || '1').replace(/-/g, '')}`;
  const seedBanners = [
    { seedKey: 'hero-v3-1', placement: 'hero', sortOrder: 0, title: 'Everyday Elegance. Made to Shine.', subtitle: 'Layered chains, stone pendants and stacking rings — gold-tone jewellery for every day.', ctaLabel: 'Shop now', ctaUrl: '/shop', image: { url: B('hero-v3-1', 'desktop'), alt: 'Model in a beige blazer wearing layered E-SHTYLE necklaces and rings' }, mobileImage: { url: B('hero-v3-1', 'mobile'), alt: 'Model wearing layered gold-tone necklaces' } },
    { seedKey: 'hero-v3-2', placement: 'hero', sortOrder: 1, title: 'The New Collection', subtitle: 'Fresh pendants, earrings and bracelets — just landed.', ctaLabel: 'Shop new arrivals', ctaUrl: '/collections/new-arrivals', image: { url: B('hero-v3-2', 'desktop'), alt: 'Gold-tone necklaces, bracelets, rings and earrings laid out on silk' }, mobileImage: { url: B('hero-v3-2', 'mobile'), alt: 'Gold-tone jewellery laid out on silk' } },
    { seedKey: 'hero-v3-3', placement: 'hero', sortOrder: 2, title: 'Stack Your Wrist', subtitle: 'Charm bracelets, bangles and cuffs made to layer.', ctaLabel: 'Shop bracelets', ctaUrl: '/category/bracelets', image: { url: B('hero-v3-3', 'desktop'), alt: 'Rows of gold-tone bracelets and bangles with white roses' }, mobileImage: { url: B('hero-v3-3', 'mobile'), alt: 'Gold-tone bracelets displayed on rolls' } },
    { seedKey: 'hero-v3-4', placement: 'hero', sortOrder: 3, title: 'Rings & Layers', subtitle: 'Pick any 2 ring designs, or stack the classics.', ctaLabel: 'Shop rings', ctaUrl: '/category/rings', image: { url: B('hero-v3-4', 'desktop'), alt: 'Hands wearing stacked gold-tone rings with layered necklaces' }, mobileImage: { url: B('hero-v3-4', 'mobile'), alt: 'Stacked rings and layered necklaces' } },
    { seedKey: 'hero-v3-5', placement: 'hero', sortOrder: 4, title: 'From Desk to Dinner', subtitle: 'Necklaces that move from the morning meeting to the evening plan.', ctaLabel: 'Shop necklaces', ctaUrl: '/category/necklaces', image: { url: B('hero-v3-5', 'desktop'), alt: 'Model in a white blazer wearing gold-tone necklaces and rings' }, mobileImage: { url: B('hero-v3-5', 'mobile'), alt: 'Model wearing gold-tone necklaces' } },
    { seedKey: 'edit-v3-stack', placement: 'editorial', sortOrder: 0, title: 'Bold Stacks', subtitle: 'Bangles, cuffs and statement rings.', ctaLabel: 'Shop bangles', ctaUrl: '/category/bangles', image: { url: B('edit-v3-stack', 'portrait'), alt: 'Model wearing stacked gold-tone bangles and rings' } },
    { seedKey: 'edit-v3-colour', placement: 'editorial', sortOrder: 1, title: 'Colour Pop', subtitle: 'Multicolour stone pendants and layered chains.', ctaLabel: 'Shop pendants', ctaUrl: '/category/pendants', image: { url: B('edit-v3-colour', 'portrait'), alt: 'Layered multicolour stone necklaces and rings on silk' } },
    { seedKey: 'look-v3-heart', placement: 'look', sortOrder: 0, title: 'Shop the look: Dripping Heart', subtitle: 'Earrings and necklace — tap a dot to shop each piece.', ctaLabel: 'Shop the earrings', ctaUrl: '/product/golden-dripping-heart-earrings', image: { url: B('look-v3', 'heart'), alt: 'Model wearing gold-tone dripping heart earrings and a heart pendant necklace' },
      hotspots: [{ x: 41, y: 25, productSlug: 'golden-dripping-heart-earrings', label: 'Dripping heart earrings' }, { x: 57, y: 85, productSlug: 'golden-heart-necklace-earrings-set-80', label: 'Heart necklace set' }] },
  ];
  // Banners from an older version (no seedKey) whose photo files no longer exist: hide them so the
  // homepage shows the current model banners instead of empty boxes. Nothing is deleted.
  for (const ob of await Banner.find({ seedKey: { $exists: false }, isActive: true }, 'title image mobileImage').lean()) {
    if (missingFile(ob.image?.url) || (!ob.image?.url && missingFile(ob.mobileImage?.url))) { await Banner.updateOne({ _id: ob._id }, { $set: { isActive: false } }); repaired++; console.log(`Hid old banner with a missing photo: "${ob.title || ob._id}"`); }
    else if (missingFile(ob.mobileImage?.url)) await Banner.updateOne({ _id: ob._id }, { $unset: { mobileImage: 1 } });
  }
  // On a catalogue refresh, banners left over from an older seed (old photos under /uploads/seed/, no seedKey)
  // are hidden so only the current banners show. Banners the owner uploaded in admin are left alone.
  if (refresh) {
    const old = await Banner.updateMany({ seedKey: { $exists: false }, isActive: true, $or: [{ 'image.url': /^\/uploads\/seed\// }, { 'mobileImage.url': /^\/uploads\/seed\// }] }, { $set: { isActive: false } });
    if (old.modifiedCount) console.log(`Hid ${old.modifiedCount} old banner(s) from an earlier catalogue.`);
    const stale = await Banner.updateMany({ seedKey: { $exists: true, $nin: seedBanners.map((x) => x.seedKey) }, isActive: true }, { $set: { isActive: false } });
    if (stale.modifiedCount) console.log(`Hid ${stale.modifiedCount} banner(s) no longer in this catalogue.`);
  }
  for (const b of seedBanners) {
    const eb = refresh ? null : await Banner.findOne({ seedKey: b.seedKey }, 'image mobileImage').lean();
    if (eb && (missingFile(eb.image?.url) || missingFile(eb.mobileImage?.url))) { await Banner.updateOne({ _id: eb._id }, { $set: { image: b.image, mobileImage: b.mobileImage } }); repaired++; }
    else await Banner.findOneAndUpdate({ seedKey: b.seedKey }, W({ ...b, isActive: true }), { upsert: true });
  }
  // The owner's brand film (landscape). Vertical reels are added from Admin → Marketing → Reels.
  const er = await Reel.findOne({ seedKey: 'film-shine-that-stays' }, 'video').lean();
  const reelRefresh = refresh || (er && (missingFile(er.video?.url) || missingFile(er.video?.poster)));
  await Reel.findOneAndUpdate({ seedKey: 'film-shine-that-stays' }, { [reelRefresh ? '$set' : '$setOnInsert']: {
    seedKey: 'film-shine-that-stays', title: 'Shine That Stays', caption: 'Made to be worn — from every day to every celebration.', orientation: 'landscape', isActive: true, sortOrder: 0,
    video: { url: '/uploads/seed/reels/eshtyle-shine-that-stays.mp4', poster: `/uploads/seed/reels/eshtyle-shine-that-stays-poster.webp?v=${(CATALOG_VERSION || '1').replace(/-/g, '')}`, width: 1280, height: 720, durationSec: 31 },
    productSlugs: ['black-clover-necklace-set', 'pink-stone-tulip-bracelet', 'golden-puffed-heart-pendant-necklace', 'bow-butterfly-pearl-earrings-combo', 'golden-broad-cuff-bracelet', 'green-clover-jewellery-set'],
    ctaLabel: 'Shop the collection', ctaUrl: '/shop',
  } }, { upsert: true });
  await getSettings();
  // Owner / business details: fill only the fields that are still empty (admin edits always win).
  const biz = JSON.parse(fs.readFileSync(new URL('./business.json', import.meta.url), 'utf8'));
  const cur = (await getSettings()).toObject().business || {};
  const fill = {};
  for (const [k, v] of Object.entries(biz)) {
    if (k.startsWith('_') || v === '') continue;
    if (k === 'address') { for (const [ak, av] of Object.entries(v)) if (av && !cur.address?.[ak]) fill[`business.address.${ak}`] = av; }
    else if (!cur[k] || (k === 'name' && cur[k] === 'E-SHTYLE')) fill[`business.${k}`] = v;
  }
  if (Object.keys(fill).length) await StoreSettings.updateOne({ key: 'store' }, { $set: fill });
  // Return policy: 7 days, damaged/defective/wrong/missing only, unboxing video mandatory.
  // Only replaces the old default reason list (which allowed 'Item not as described'); admin edits are kept.
  await StoreSettings.updateOne({ key: 'store', $or: [{ 'returns.reasons': 'Item not as described' }, { 'returns.reasons': { $size: 0 } }] }, { $set: { 'returns.windowDays': 7, 'returns.reasons': RETURN_REASONS, 'returns.requireVideo': true } });
  await StoreSettings.updateOne({ key: 'store', 'announcement.text': '' }, { $set: { announcement: { text: 'Free shipping on orders above ₹499 · Cash on Delivery available', link: '/shipping-policy', isActive: true } } });
  if (!(await Coupon.exists({ code: 'WELCOME10' }))) await Coupon.create({ code: 'WELCOME10', description: 'SAMPLE: 10% off your first order (max ₹150). Review before launch.', type: 'percent', value: 10, maxDiscount: 15000, minOrderValue: 29900, firstOrderOnly: true, perUserLimit: 1, isActive: false });

  await runMigrations();
  if (newVersion) await StoreSettings.updateOne({ key: 'store' }, { $set: { catalogVersion: CATALOG_VERSION } });
  console.log(`Seeded ${n} products, ${Object.keys(catId).length} categories, ${cols.length} collections.${repaired ? ` Repaired ${repaired} item(s) left by an older version (photos/links).` : ""}`);
  await disconnectDb();
}
main().catch(async (e) => { console.error(e); await disconnectDb(); process.exit(1); });
