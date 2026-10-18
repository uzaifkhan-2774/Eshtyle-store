/**
 * Seeds categories, collections, banners, settings and the E-SHTYLE catalogue built from the owner's photos.
 * Every seeded product is flagged isSampleData=true. Products whose price did not come from the owner's
 * folder names are also flagged priceReviewRequired=true — review them in Admin → Products before launch.
 * Stock values are SAMPLE quantities (12 per variant) and must be replaced with real counts.
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
const catalog = JSON.parse(fs.readFileSync(path.join(here, 'catalog.json'), 'utf8'));
const reset = process.argv.includes('--reset');
// Safe by default: products/banners/reels that already exist are left untouched, so price or text edits made in the admin panel survive a re-run.
// --refresh-catalog rewrites the sample catalogue from catalog.json (overwrites admin edits to those products).
const refresh = process.argv.includes('--refresh-catalog') || reset;
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
  ['Chains', 'chains', 'Snake chains and fine chains to wear alone or layered.', 'Chains for Women — Golden & Silver Snake Chain Necklaces', 'Golden and silver chains for women: flat snake chains, Y chains and minimal everyday chains, including anti-tarnish styles. Shop online at E-SHTYLE.'],
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

async function main() {
  await connectDb();
  if (process.argv.includes('--if-empty') && await Product.exists({})) {
    const needsRepair = (await Product.find({}, 'images').lean()).some((x) => broken(x.images)) || (await Banner.find({ isActive: true }, 'image mobileImage').lean()).some((x) => missingFile(x.image?.url) || missingFile(x.mobileImage?.url));
    if (!needsRepair) { console.log('Catalogue already present — skipping seed.'); await disconnectDb(); return; }
    console.log('Found products/banners with missing photos from an older version — repairing…');
  }
  if (reset && process.env.NODE_ENV === 'production') { console.error('Refusing --reset in production: it would delete the live catalogue.'); process.exit(1); }
  if (reset) {
    for (const M of [Category, Collection, Product, ProductVariant, Banner]) await M.deleteMany({});
    console.log('Catalogue collections cleared.');
  }
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
      description: `${item.line}\n\n${item.styleName !== item.name ? `We call this style “${item.styleName}”. It is designed` : 'Designed'} for everyday elegance and easy to style from office wear to party wear. Each piece is checked and packed by hand before it ships, ready to keep or to gift.`,
      seo: { title: seoTitle, description: seoDescription },
      images, video: item.video ? { url: item.video, poster: images[0]?.url } : undefined, tags,
      jewelleryType: { earrings: 'Earrings', 'earring-combos': 'Earrings', necklaces: 'Necklace', chains: 'Chain', pendants: 'Pendant', necksets: 'Neckset', rings: 'Ring', 'ring-combos': 'Ring', bracelets: 'Bracelet', bangles: 'Bangle', 'arm-cuffs': 'Cuff', 'gift-sets': 'Gift set', 'jewellery-box-sets': 'Gift set' }[item.category],
      finish: item.finish, colour: item.colour.split(' & ')[0] === 'Mixed metal' ? 'Mixed metal' : item.colour,
      claims: { antiTarnish: item.antiTarnish, note: item.antiTarnish ? 'Anti-tarnish finish as described by the supplier. Verify before publishing durability claims.' : undefined },
      specifications: [...(item.styleName !== item.name ? [{ label: 'Style', value: item.styleName }] : []), { label: 'Finish', value: item.finish }, { label: 'Colour', value: item.colour }, { label: 'SKU', value: item.sku }],
      careInstructions: CARE, packageContents: item.category.includes('combo') || item.category === 'gift-sets' ? 'Complete set as pictured, in E-SHTYLE packaging' : 'One piece (or pair, for earrings) in E-SHTYLE packaging',
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
      const colour = item.variants.length && !/combo/i.test(v.label) ? v.label : undefined;
      const vdoc = { product: p._id, title: v.label, options: { colour, design: /combo/i.test(v.label) ? v.label : undefined }, price: item.price * 100, images: v.images.map((im, i) => ({ ...im, alt: `${item.name} in ${v.label} by E-SHTYLE${i ? ` — view ${i + 1}` : ''}` })), isActive: true, sortOrder: vi };
      const ev = refresh ? null : await ProductVariant.findOne({ sku }, 'images product').lean();
      if (ev && (broken(ev.images) || String(ev.product) !== String(p._id))) await ProductVariant.updateOne({ _id: ev._id }, { $set: { images: vdoc.images, product: p._id } });
      else if (!ev) await ProductVariant.findOneAndUpdate({ sku }, refresh ? { $set: vdoc, $setOnInsert: { stock: 12, lowStockThreshold: 3 } } : { $setOnInsert: { ...vdoc, stock: 12, lowStockThreshold: 3 } }, { upsert: true, new: true });
    }
    await refreshProductStock([p._id]);
    n++;
  }
  // Category tile images from a strong product photo in each category.
  for (const [slug, id] of Object.entries(catId)) {
    const p = await Product.findOne({ category: id, status: 'published' }).sort({ isFeatured: -1, sortOrder: 1 }).lean();
    const pick = p?.images?.find((im, i) => i > 0) || p?.images?.[0];
    const cur = await Category.findById(id, 'image').lean();
    if (pick && cur?.image?.url && missingFile(cur.image.url)) await Category.updateOne({ _id: id }, { $unset: { image: 1 } });
    if (pick) await Category.updateOne({ _id: id, 'image.url': { $exists: false } }, { $set: { image: { url: pick.url, thumb: pick.thumb, alt: `${CATEGORIES.find((c) => c[1] === slug)?.[0] || slug} for women by E-SHTYLE` } } });
  }

  const cols = [
    { name: 'Bestsellers', slug: 'bestsellers', type: 'bestsellers', showInNav: true, sortOrder: 0, description: 'Ranked by real orders. Until sales data builds up, this shows our signature pieces.' },
    { name: 'New Arrivals', slug: 'new-arrivals', type: 'new_arrivals', showInNav: true, sortOrder: 1, description: 'The latest additions to the E-SHTYLE collection.' },
    { name: 'Sale', slug: 'sale', type: 'sale', showInNav: false, sortOrder: 2, description: 'Pieces with a genuine reduced price.' },
    { name: 'The Anti-Tarnish Edit', slug: 'anti-tarnish', type: 'tag', tag: 'anti-tarnish', sortOrder: 3, description: 'Pieces with an anti-tarnish finish, as specified for each product.' },
    { name: 'Earring Combos', slug: 'earring-combos-edit', type: 'tag', tag: 'combo', sortOrder: 4, description: 'More looks, one box — curated earring and jewellery combos.' },
    { name: 'Gift-Ready Sets', slug: 'gift-ready', type: 'tag', tag: 'gift', sortOrder: 5, description: 'Thoughtful sets presented beautifully — ready to give.' },
  ];
  for (const c of cols) await Collection.findOneAndUpdate({ slug: c.slug }, { $setOnInsert: { ...c, isPublished: true } }, { upsert: true });

  // Editorial banners built from the model photography (scripts/build_banners.py). Upserted by seedKey so
  // re-running the seed refreshes them without touching banners the owner created in the admin.
  await Banner.deleteMany({ seedKey: { $exists: false }, title: { $in: ['Everyday Elegance. Made to Shine.', 'The Earring Edit'] } });
  const B = (n, s2) => `/uploads/seed/banners/${n}-${s2}.webp`;
  const seedBanners = [
    { seedKey: 'hero-everyday', placement: 'hero', sortOrder: 0, title: 'Everyday Elegance. Made to Shine.', subtitle: 'Jewellery designed to complement your style, from everyday essentials to statement pieces.', ctaLabel: 'Shop now', ctaUrl: '/shop', image: { url: B('hero-everyday', 'desktop'), alt: 'Models wearing E-SHTYLE clover necklace, blue flower earrings and a golden flower cuff' }, mobileImage: { url: B('hero-everyday', 'mobile'), alt: 'Model wearing the E-SHTYLE black clover necklace' } },
    { seedKey: 'hero-earrings', placement: 'hero', sortOrder: 1, title: 'The Earring Edit', subtitle: 'Sculpted golds, soft rose and statement drops, from ₹120.', ctaLabel: 'Shop earrings', ctaUrl: '/category/earrings', image: { url: B('hero-earrings', 'desktop'), alt: 'Models wearing golden chunky oval, tri-tone and black rose gold earrings' }, mobileImage: { url: B('hero-earrings', 'mobile'), alt: 'Model wearing golden chunky oval earrings' } },
    { seedKey: 'hero-rings', placement: 'hero', sortOrder: 2, title: 'After-Dark Sparkle', subtitle: 'American diamond cocktail rings made for weddings, parties and every celebration.', ctaLabel: 'Shop rings', ctaUrl: '/category/rings', image: { url: B('hero-rings', 'desktop'), alt: 'Models wearing green, white and red American diamond cocktail rings' }, mobileImage: { url: B('hero-rings', 'mobile'), alt: 'Model wearing a green American diamond cocktail ring' } },
    { seedKey: 'hero-office', placement: 'hero', sortOrder: 3, title: 'From Desk to Dinner', subtitle: 'Snake chains, clover necklaces and bold cuffs for the working week.', ctaLabel: 'Shop necklaces', ctaUrl: '/category/necklaces', image: { url: B('hero-office', 'desktop'), alt: 'Models wearing a snake chain, a ribbed cuff and a clover necklace at work' }, mobileImage: { url: B('hero-office', 'mobile'), alt: 'Model wearing gold and silver snake chains with a black blazer' } },
    { seedKey: 'edit-korean', placement: 'editorial', sortOrder: 0, title: 'Korean Earrings', subtitle: 'Dainty studs and combos for every day.', ctaLabel: 'Shop combos', ctaUrl: '/category/earring-combos', image: { url: B('edit-korean', 'portrait'), alt: 'Model wearing dainty Korean stud earrings' } },
    { seedKey: 'edit-rings', placement: 'editorial', sortOrder: 1, title: 'Cocktail Rings', subtitle: 'One ring, all the attention.', ctaLabel: 'Shop rings', ctaUrl: '/category/rings', image: { url: B('edit-rings', 'portrait'), alt: 'Model wearing a pink flower American diamond cocktail ring' } },
    { seedKey: 'look-clover', placement: 'look', sortOrder: 0, title: 'Shop the look: Black Clover', subtitle: 'Necklace, bracelet and earrings — tap a dot to shop each piece.', ctaLabel: 'Shop the set', ctaUrl: '/product/black-clover-necklace-set', image: { url: B('look-clover', 'square'), alt: 'Model wearing the black clover necklace, bracelet and earrings' },
      hotspots: [{ x: 65, y: 34, productSlug: 'black-clover-necklace-set', label: 'Earrings (in the set)' }, { x: 45, y: 82, productSlug: 'black-clover-necklace', label: 'Necklace' }, { x: 76, y: 80, productSlug: 'black-clover-bracelet', label: 'Bracelet' }] },
  ];
  // Banners from an older version (no seedKey) whose photo files no longer exist: hide them so the
  // homepage shows the current model banners instead of empty boxes. Nothing is deleted.
  for (const ob of await Banner.find({ seedKey: { $exists: false }, isActive: true }, 'title image mobileImage').lean()) {
    if (missingFile(ob.image?.url) || (!ob.image?.url && missingFile(ob.mobileImage?.url))) { await Banner.updateOne({ _id: ob._id }, { $set: { isActive: false } }); repaired++; console.log(`Hid old banner with a missing photo: "${ob.title || ob._id}"`); }
    else if (missingFile(ob.mobileImage?.url)) await Banner.updateOne({ _id: ob._id }, { $unset: { mobileImage: 1 } });
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
    video: { url: '/uploads/seed/reels/eshtyle-shine-that-stays.mp4', poster: '/uploads/seed/reels/eshtyle-shine-that-stays-poster.webp', width: 1280, height: 720, durationSec: 31 },
    productSlugs: ['golden-chunky-oval-earrings', 'tri-tone-drop-earrings', 'blue-flower-drop-earrings', 'lily-flower-stud-earrings', 'white-american-diamond-cocktail-ring', 'green-american-diamond-cocktail-ring'],
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

  console.log(`Seeded ${n} products, ${Object.keys(catId).length} categories, ${cols.length} collections.${repaired ? ` Repaired ${repaired} item(s) left by an older version (photos/links).` : ""}`);
  await disconnectDb();
}
main().catch(async (e) => { console.error(e); await disconnectDb(); process.exit(1); });
