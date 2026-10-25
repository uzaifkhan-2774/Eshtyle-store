import { Router } from 'express';
import mongoose from 'mongoose';
import { Product, ProductVariant, Category, Collection, Banner, Review, Page, Reel, getSettings , Testimonial } from '../models/index.js';
import { ah, notFound } from '../lib/errors.js';
import { escapeRegex, pageParams } from '../lib/util.js';
import { searchFilter, relevance } from '../lib/search.js';
import { quotePincode } from '../services/shippingQuote.js';
import env from '../config/env.js';

const r = Router();
const PUBLIC_FIELDS = 'name slug sku isListed designPick category subcategory shortDescription images tags jewelleryType material finish colour claims price compareAtPrice inStock isFeatured ratingAvg ratingCount createdAt codAvailable';

export const card = (p) => ({
  id: p._id, name: p.name, slug: p.slug, price: p.price, compareAtPrice: p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : null,
  image: p.images?.[0] ? { url: p.images[0].url, thumb: p.images[0].thumb, alt: p.images[0].alt || p.name } : null,
  hoverImage: p.images?.[1] ? { url: p.images[1].url, thumb: p.images[1].thumb, alt: p.images[1].alt || p.name } : null,
  pickCount: p.designPick?.count || 0,
  inStock: p.inStock, ratingAvg: p.ratingAvg, ratingCount: p.ratingCount, tags: p.tags, colour: p.colour, antiTarnish: Boolean(p.claims?.antiTarnish),
  isNew: p.createdAt && Date.now() - new Date(p.createdAt).getTime() < 30 * 24 * 3600 * 1000,
});

/** Adds quickVariantId to cards whose product has exactly one buyable variant (enables one-tap "Add to bag"). */
export async function withQuickAdd(cards) {
  if (!cards.length) return cards;
  const vs = await ProductVariant.find({ product: { $in: cards.map((c) => c.id) }, isActive: true }).select('product stock').lean();
  const by = new Map();
  for (const v of vs) { const k = String(v.product); by.set(k, [...(by.get(k) || []), v]); }
  return cards.map((c) => { const list = by.get(String(c.id)) || []; return { ...c, variantCount: list.length, quickVariantId: list.length === 1 && list[0].stock > 0 && !c.pickCount ? list[0]._id : null }; });
}

async function resolveCategory(slug) {
  if (!slug) return null;
  return Category.findOne({ slug, isPublished: true }).lean();
}

/** Build a Mongo filter from validated query params (shared by listing + collections). */
export async function buildFilter(q) {
  const f = { status: 'published', isListed: { $ne: false } };
  if (q.category) {
    const c = await resolveCategory(q.category);
    if (!c) return null;
    const kids = await Category.find({ parent: c._id }).select('_id').lean();
    const ids = [c._id, ...kids.map((k) => k._id)];
    f.$or = [{ category: { $in: ids } }, { subcategory: { $in: ids } }];
  }
  if (q.q) {
    const sf = searchFilter(String(q.q).slice(0, 80));
    if (sf) f.$and = [...(f.$and || []), ...sf.$and];
  }
  const num = (v) => (v === undefined || v === '' ? undefined : Number(v));
  const min = num(q.minPrice); const max = num(q.maxPrice);
  if (Number.isFinite(min) || Number.isFinite(max)) f.price = { ...(Number.isFinite(min) ? { $gte: min * 100 } : {}), ...(Number.isFinite(max) ? { $lte: max * 100 } : {}) };
  const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12) : []);
  if (list(q.colour).length) f.colour = { $in: list(q.colour) };
  if (list(q.finish).length) f.finish = { $in: list(q.finish) };
  if (list(q.material).length) f.material = { $in: list(q.material) };
  if (list(q.type).length) f.jewelleryType = { $in: list(q.type) };
  if (q.tag) f.tags = String(q.tag).toLowerCase();
  if (q.inStock === 'true') f.inStock = true;
  if (q.onSale === 'true') f.compareAtPrice = { $gt: 0 };
  if (q.antiTarnish === 'true') f['claims.antiTarnish'] = true;
  if (q.rating) f.ratingAvg = { $gte: Number(q.rating) };
  return f;
}
const SORTS = { featured: { isFeatured: -1, sortOrder: 1, salesCount: -1, createdAt: -1 }, newest: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 }, bestselling: { salesCount: -1, createdAt: -1 }, rating: { ratingAvg: -1, ratingCount: -1 } };

r.get('/products', ah(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 48);
  const f = await buildFilter(req.query);
  if (!f) return res.json({ items: [], total: 0, page, pages: 0 });
  const sort = SORTS[req.query.sort] || SORTS.featured;
  const facetFilter = { ...f }; delete facetFilter.colour; delete facetFilter.finish; delete facetFilter.price; delete facetFilter.material; delete facetFilter.jewelleryType;
  const byRelevance = req.query.q && (!req.query.sort || req.query.sort === 'featured');
  const [items, total, facetsSrc] = await Promise.all([
    byRelevance
      ? Product.find(f).select(`${PUBLIC_FIELDS} finish`).limit(500).lean().then((all) => all.sort((a, b) => relevance(b, req.query.q) - relevance(a, req.query.q)).slice(skip, skip + limit))
      : Product.find(f).select(PUBLIC_FIELDS).sort({ inStock: -1, ...sort }).skip(skip).limit(limit).lean(),
    Product.countDocuments(f),
    Product.find(facetFilter).select('colour finish material jewelleryType price').lean(),
  ]);
  const count = (key) => Object.entries(facetsSrc.reduce((m, p) => (p[key] ? ((m[p[key]] = (m[p[key]] || 0) + 1), m) : m), {})).map(([value, n]) => ({ value, count: n })).sort((a, b) => b.count - a.count);
  const prices = facetsSrc.map((p) => p.price);
  res.json({
    items: await withQuickAdd(items.map(card)), total, page, pages: Math.ceil(total / limit),
    facets: { colour: count('colour'), finish: count('finish'), material: count('material'), type: count('jewelleryType'), price: prices.length ? { min: Math.floor(Math.min(...prices) / 100), max: Math.ceil(Math.max(...prices) / 100) } : null },
  });
}));

r.get('/search/suggest', ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ products: [], categories: [] });
  const rx = new RegExp(escapeRegex(q.slice(0, 60)), 'i');
  const sf = searchFilter(q.slice(0, 80));
  const [products, categories] = await Promise.all([
    sf ? Product.find({ status: 'published', isListed: { $ne: false }, ...sf }).select(`${PUBLIC_FIELDS} finish`).limit(200).lean().then((all) => all.sort((a, b) => relevance(b, q) - relevance(a, q)).slice(0, 6)) : [],
    Category.find({ isPublished: true, name: rx }).select('name slug').limit(4).lean(),
  ]);
  res.json({ products: products.map(card), categories });
}));

r.get('/categories', ah(async (_req, res) => {
  const cats = await Category.find({ isPublished: true }).sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await Product.aggregate([{ $match: { status: 'published', isListed: { $ne: false } } }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
  const cm = new Map(counts.map((c) => [String(c._id), c.n]));
  const tree = cats.filter((c) => !c.parent).map((c) => ({ id: c._id, name: c.name, slug: c.slug, image: c.image, description: c.description, showInNav: c.showInNav, productCount: cm.get(String(c._id)) || 0, children: cats.filter((k) => String(k.parent) === String(c._id)).map((k) => ({ id: k._id, name: k.name, slug: k.slug, productCount: cm.get(String(k._id)) || 0 })) }));
  const collections = await Collection.find({ isPublished: true }).sort({ sortOrder: 1 }).select('name slug type showInNav image description').lean();
  res.json({ categories: tree, collections });
}));
r.get('/categories/:slug', ah(async (req, res) => {
  const c = await Category.findOne({ slug: req.params.slug, isPublished: true }).lean();
  if (!c) throw notFound('Category not found.');
  const parent = c.parent ? await Category.findById(c.parent).select('name slug').lean() : null;
  const children = await Category.find({ parent: c._id, isPublished: true }).sort({ sortOrder: 1 }).select('name slug').lean();
  res.json({ category: { id: c._id, name: c.name, slug: c.slug, description: c.description, image: c.image, seo: c.seo, parent, children } });
}));

export async function collectionProducts(col, limit = 12) {
  const base = { status: 'published', isListed: { $ne: false } };
  let q;
  switch (col.type) {
    case 'new_arrivals': q = Product.find(base).sort({ inStock: -1, createdAt: -1 }); break;
    case 'bestsellers': q = Product.find(base).sort({ inStock: -1, salesCount: -1, isFeatured: -1, sortOrder: 1 }); break;
    case 'sale': q = Product.find({ ...base, compareAtPrice: { $gt: 0 } }).sort({ inStock: -1, createdAt: -1 }); break;
    case 'tag': q = Product.find({ ...base, tags: col.tag }).sort({ inStock: -1, sortOrder: 1, createdAt: -1 }); break;
    default: {
      const ps = await Product.find({ ...base, _id: { $in: col.products } }).select(PUBLIC_FIELDS).lean();
      const order = new Map(col.products.map((id, i) => [String(id), i]));
      return ps.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id))).slice(0, limit).map(card);
    }
  }
  return (await q.select(PUBLIC_FIELDS).limit(limit).lean()).map(card);
}
r.get('/collections/:slug', ah(async (req, res) => {
  const col = await Collection.findOne({ slug: req.params.slug, isPublished: true }).lean();
  if (!col) throw notFound('Collection not found.');
  const items = await withQuickAdd(await collectionProducts(col, 96));
  res.json({ collection: { name: col.name, slug: col.slug, description: col.description, image: col.image, seo: col.seo, type: col.type }, items, total: items.length });
}));

r.get('/products/:slug', ah(async (req, res) => {
  const p = await Product.findOne({ slug: req.params.slug, status: 'published' }).populate('category', 'name slug').populate('subcategory', 'name slug').lean();
  if (!p) throw notFound('This piece is no longer available.');
  const variants = await ProductVariant.find({ product: p._id, isActive: true }).sort({ sortOrder: 1 }).lean();
  let related = p.related?.length ? await Product.find({ _id: { $in: p.related }, status: 'published', isListed: { $ne: false } }).select(PUBLIC_FIELDS).limit(8).lean() : [];
  if (related.length < 4) related = related.concat(await Product.find({ status: 'published', isListed: { $ne: false }, category: p.category._id, _id: { $nin: [p._id, ...related.map((x) => x._id)] } }).select(PUBLIC_FIELDS).sort({ inStock: -1, salesCount: -1 }).limit(8 - related.length).lean());
  const together = await Product.find({ status: 'published', isListed: { $ne: false }, inStock: true, category: { $ne: p.category._id }, tags: { $in: p.tags?.filter((t) => !['new', 'bestseller'].includes(t)) || [] } }).select(PUBLIC_FIELDS).sort({ salesCount: -1 }).limit(3).lean();
  const settings = await getSettings();
  res.json({
    product: {
      id: p._id, name: p.name, slug: p.slug, sku: p.sku, isListed: p.isListed !== false, pickCount: p.designPick?.count || 0, category: p.category, subcategory: p.subcategory, shortDescription: p.shortDescription, description: p.description,
      images: p.images, video: p.video, tags: p.tags, jewelleryType: p.jewelleryType, material: p.material, finish: p.finish, colour: p.colour,
      claims: p.claims, specifications: p.specifications, dimensions: p.dimensions, weightGrams: p.weightGrams, packageContents: p.packageContents, careInstructions: p.careInstructions,
      price: p.price, compareAtPrice: p.compareAtPrice, inStock: p.inStock, ratingAvg: p.ratingAvg, ratingCount: p.ratingCount,
      codAvailable: p.codAvailable && settings.cod.enabled, returnable: p.returnable, returnWindowDays: p.returnWindowDays, seo: p.seo,
      variants: variants.map((v) => ({ id: v._id, sku: v.sku, title: v.title, options: v.options, price: v.price, compareAtPrice: v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : null, inStock: v.stock > 0, lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold ? v.stock : null, images: v.images })),
    },
    related: await withQuickAdd(related.map(card)),
    frequentlyBoughtTogether: await withQuickAdd(together.map(card)),
    shipping: { freeAbove: settings.shipping.freeAbove, flatRate: settings.shipping.flatRate, estimateDays: [settings.shipping.estimateDaysMin, settings.shipping.estimateDaysMax] },
  });
}));
r.post('/products/by-ids', ah(async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((i) => mongoose.isValidObjectId(i)).slice(0, 24);
  const ps = await Product.find({ _id: { $in: ids }, status: 'published' }).select(PUBLIC_FIELDS).lean();
  const m = new Map(ps.map((p) => [String(p._id), p]));
  res.json({ items: ids.map((i) => m.get(String(i))).filter(Boolean).map(card) });
}));

r.get('/products/:id/reviews', ah(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 20);
  const f = { product: req.params.id, status: 'approved' };
  const [items, total] = await Promise.all([Review.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).select('rating title body authorName verifiedPurchase createdAt').lean(), Review.countDocuments(f)]);
  res.json({ items, total, page });
}));

r.get('/pincode/:pincode', ah(async (req, res) => {
  const settings = await getSettings();
  res.json(await quotePincode(req.params.pincode, settings));
}));

const hasPhoto = (b) => Boolean(b.image?.url || b.mobileImage?.url);
r.get('/home', ah(async (_req, res) => {
  const now = new Date();
  const live = { isActive: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] }] };
  const [banners, cats, cols, reviews, settings, testimonials] = await Promise.all([
    Banner.find(live).sort({ sortOrder: 1 }).lean(),
    Category.find({ isPublished: true, parent: null }).sort({ sortOrder: 1 }).lean(),
    Collection.find({ isPublished: true }).sort({ sortOrder: 1 }).lean(),
    Review.find({ status: 'approved', featured: true, verifiedPurchase: true }).sort({ createdAt: -1 }).limit(6).populate('product', 'name slug').lean(),
    getSettings(),
    Testimonial.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).limit(12).select('name city quote rating source productSlug').lean(),
  ]);
  const sections = {};
  for (const c of cols.filter((c2) => ['bestsellers', 'new-arrivals', 'anti-tarnish', 'earring-combos-edit', 'gift-ready'].includes(c2.slug))) sections[c.slug] = { name: c.name, slug: c.slug, description: c.description, items: await withQuickAdd(await collectionProducts(c, 8)) };
  const reelDocs = await Reel.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).limit(12).lean();
  const reelSlugs = [...new Set(reelDocs.flatMap((x) => x.productSlugs || []))];
  const reelProducts = reelSlugs.length ? new Map((await Product.find({ slug: { $in: reelSlugs }, status: 'published' }).select(PUBLIC_FIELDS).lean()).map((p) => [p.slug, card(p)])) : new Map();
  const reels = reelDocs.map((x) => ({ id: x._id, title: x.title, caption: x.caption, video: x.video, orientation: x.orientation, ctaLabel: x.ctaLabel, ctaUrl: x.ctaUrl, products: (x.productSlugs || []).map((sl) => reelProducts.get(sl)).filter(Boolean) }));
  const looks = banners.filter((b) => b.placement === 'look');
  const lookSlugs = looks.flatMap((b) => (b.hotspots || []).map((h) => h.productSlug));
  const lookProducts = lookSlugs.length ? await Product.find({ slug: { $in: lookSlugs }, status: 'published' }).select(PUBLIC_FIELDS).lean() : [];
  const lp = new Map(lookProducts.map((p) => [p.slug, card(p)]));
  const pick = (await Product.find({ status: 'published', isListed: { $ne: false }, inStock: true, 'designPick.count': { $gt: 0 } }).select(PUBLIC_FIELDS).sort({ salesCount: -1, sortOrder: 1 }).limit(4).lean()).map(card);
  res.json({
    pick: await withQuickAdd(pick),
    testimonials: testimonials.map((t) => ({ id: t._id, name: t.name, city: t.city, quote: t.quote, rating: t.rating, source: t.source, productSlug: t.productSlug })),
    announcement: settings.announcement?.isActive ? settings.announcement : null,
    banners: {
      // A banner without a photo would show as an empty grey box, so it is not sent until a photo is added in admin.
      hero: banners.filter((b) => b.placement === 'hero' && hasPhoto(b)), promo: banners.filter((b) => b.placement === 'promo' && hasPhoto(b)), editorial: banners.filter((b) => b.placement === 'editorial' && hasPhoto(b)),
      look: looks.map((b) => ({ ...b, hotspots: (b.hotspots || []).filter((h) => lp.has(h.productSlug)).map((h) => ({ ...h, product: lp.get(h.productSlug) })) })),
    },
    categories: cats.filter((c) => c.image?.url).map((c) => ({ name: c.name, slug: c.slug, image: c.image })),
    sections,
    reels,
    reviews: reviews.map((x) => ({ rating: x.rating, title: x.title, body: x.body, authorName: x.authorName, product: x.product, createdAt: x.createdAt })),
  });
}));

r.get('/settings/public', ah(async (_req, res) => {
  const s = await getSettings();
  res.json({
    business: { name: s.business.name, legalName: s.business.legalName, ownerName: s.business.ownerName, email: s.business.email, phone: s.business.phone, whatsapp: s.business.whatsapp, address: s.business.address, instagram: s.business.instagram, facebook: s.business.facebook, youtube: s.business.youtube },
    announcement: s.announcement?.isActive ? s.announcement : null,
    shipping: { freeAbove: s.shipping.freeAbove, flatRate: s.shipping.flatRate, estimateDays: [s.shipping.estimateDaysMin, s.shipping.estimateDaysMax] },
    cod: { enabled: s.cod.enabled, fee: s.cod.fee, maxOrderValue: s.cod.maxOrderValue },
    returns: { windowDays: s.returns.windowDays, reasons: s.returns.reasons },
    tax: { rate: s.tax.rate, pricesIncludeTax: s.tax.pricesIncludeTax },
    seo: s.seo, analytics: s.analytics,
    auth: { phoneLogin: (await import('../config/env.js')).integrations.phoneLogin, otpChannel: (await import('../config/env.js')).integrations.otpChannel },
    payments: { provider: env.PAYMENT_PROVIDER, online: Boolean((await import('../services/payments/index.js')).getPaymentAdapter()) },
  });
}));

r.get('/pages/:slug', ah(async (req, res) => {
  const p = await Page.findOne({ slug: req.params.slug, isPublished: true }).lean();
  if (!p) throw notFound('Page not found.');
  const col = p.linkedCollection ? await Collection.findById(p.linkedCollection).lean() : null;
  res.json({ page: p, items: col ? await collectionProducts(col, 48) : [] });
}));
export default r;