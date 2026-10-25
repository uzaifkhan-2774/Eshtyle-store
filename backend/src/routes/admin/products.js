import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { Product, ProductVariant, Category } from '../../models/index.js';
import { ah, badRequest, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requirePerm, can } from '../../middleware/auth.js';
import { audit } from '../../lib/audit.js';
import { escapeRegex, pageParams, slugify } from '../../lib/util.js';
import { storeImage } from '../../services/storage.js';
import { refreshProductStock } from '../../services/inventory.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 10 } });
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
const paise = z.number().int().min(0);
const img = z.object({ url: z.string().min(1), thumb: z.string().optional(), alt: z.string().max(160).optional(), width: z.number().optional(), height: z.number().optional(), publicId: z.string().optional() });

const variantSchema = z.object({
  _id: oid.optional(), sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9-_]+$/, 'SKU: letters, numbers, - and _ only'), title: z.string().trim().min(1).max(80).default('Default'),
  options: z.object({ colour: z.string().max(40), size: z.string().max(40), design: z.string().max(40), finish: z.string().max(40), quantity: z.string().max(40) }).partial().optional(),
  price: paise.min(100, 'Price must be at least ₹1'), compareAtPrice: paise.nullable().optional(), costPrice: paise.nullable().optional(), stock: z.number().int().min(0).max(100000), lowStockThreshold: z.number().int().min(0).max(1000).optional(),
  images: z.array(img).max(10).optional(), weightGrams: z.number().min(0).max(5000).optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional(),
}).refine((v) => !v.compareAtPrice || v.compareAtPrice > v.price, { message: 'Compare-at price must be higher than the price (or empty).', path: ['compareAtPrice'] });

const productSchema = z.object({
  name: z.string().trim().min(2).max(140), slug: z.string().trim().max(100).optional(), sku: z.string().trim().min(2).max(40),
  category: oid, subcategory: oid.nullable().optional(), status: z.enum(['draft', 'published', 'archived']).default('draft'),
  shortDescription: z.string().max(300).optional(), description: z.string().max(5000).optional(), images: z.array(img).max(15).default([]),
  video: z.object({ url: z.string(), poster: z.string().optional() }).nullable().optional(), tags: z.array(z.string().trim().toLowerCase().max(30)).max(20).default([]),
  jewelleryType: z.string().max(40).optional(), material: z.string().max(80).optional(), finish: z.string().max(80).optional(), colour: z.string().max(40).optional(),
  claims: z.object({ antiTarnish: z.boolean(), hypoallergenic: z.boolean(), waterResistant: z.boolean(), note: z.string().max(200) }).partial().optional(),
  specifications: z.array(z.object({ label: z.string().max(40), value: z.string().max(200) })).max(20).optional(),
  dimensions: z.string().max(120).optional(), weightGrams: z.number().min(0).max(5000).optional(), packageContents: z.string().max(200).optional(), careInstructions: z.string().max(1500).optional(),
  isFeatured: z.boolean().optional(), isListed: z.boolean().optional(), designPick: z.object({ count: z.number().int().min(0).max(6) }).optional(), codAvailable: z.boolean().optional(), returnable: z.boolean().optional(), returnWindowDays: z.number().int().min(0).max(60).optional(), hsnCode: z.string().max(10).optional(),
  sortOrder: z.number().int().optional(), seo: z.object({ title: z.string().max(70), description: z.string().max(170) }).partial().optional(), related: z.array(oid).max(12).optional(), priceReviewRequired: z.boolean().optional(),
  variants: z.array(variantSchema).min(1, 'Add at least one variant').max(60),
});

r.get('/', requirePerm('products:read'), ah(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 100);
  const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.query.category && mongoose.isValidObjectId(req.query.category)) f.category = req.query.category;
  if (req.query.q) { const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i'); const vs = await ProductVariant.find({ sku: rx }).select('product').lean(); f.$or = [{ name: rx }, { sku: rx }, { _id: { $in: vs.map((v) => v.product) } }]; }
  if (req.query.stock === 'out') f.inStock = false;
  if (req.query.stock === 'low') { const low = (await ProductVariant.find({ isActive: true, stock: { $lte: 10 } }).select('product stock lowStockThreshold').lean()).filter((v) => v.stock <= (v.lowStockThreshold ?? 3)); f._id = { $in: low.map((v) => v.product) }; }
  if (req.query.review === 'true') f.priceReviewRequired = true;
  const [items, total] = await Promise.all([Product.find(f).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('category', 'name').lean(), Product.countDocuments(f)]);
  const vs = await ProductVariant.find({ product: { $in: items.map((p) => p._id) } }).select('product stock sku').lean();
  const stock = vs.reduce((m, v) => ((m[v.product] = (m[v.product] || 0) + v.stock), m), {});
  const vcount = vs.reduce((m, v) => ((m[v.product] = (m[v.product] || 0) + 1), m), {});
  const showCost = can(req.user.role, 'costs:read');
  if (!showCost) items.forEach((p) => delete p.costPrice);
  res.json({ items: items.map((p) => ({ ...p, totalStock: stock[p._id] || 0, variantCount: vcount[p._id] || 0 })), total, page, pages: Math.ceil(total / limit) });
}));

r.get('/:id', requirePerm('products:read'), ah(async (req, res) => {
  const showCost = can(req.user.role, 'costs:read');
  const p = await Product.findById(req.params.id).lean();
  if (!p) throw notFound();
  const variants = await ProductVariant.find({ product: p._id }).sort({ sortOrder: 1 }).lean();
  if (!showCost) { delete p.costPrice; variants.forEach((v) => delete v.costPrice); }
  res.json({ product: { ...p, variants } });
}));

async function saveVariants(product, variants, req) {
  const keep = [];
  for (const [i, v] of variants.entries()) {
    const data = { ...v, sku: v.sku.toUpperCase(), sortOrder: v.sortOrder ?? i, product: product._id };
    if (!can(req.user.role, 'costs:read')) delete data.costPrice;
    if (data.compareAtPrice === null) data.compareAtPrice = undefined;
    let doc;
    if (v._id) doc = await ProductVariant.findOneAndUpdate({ _id: v._id, product: product._id }, { $set: data }, { new: true, runValidators: true });
    if (!doc) { delete data._id; doc = await ProductVariant.create(data); }
    keep.push(doc._id);
  }
  // Variants removed in the editor are deactivated, never hard-deleted (old orders reference them).
  await ProductVariant.updateMany({ product: product._id, _id: { $nin: keep } }, { $set: { isActive: false } });
  await refreshProductStock([product._id]);
}

r.post('/', requirePerm('products:write'), validate(productSchema), ah(async (req, res) => {
  const { variants, ...data } = req.body;
  data.slug = slugify(data.slug || data.name);
  if (await Product.exists({ slug: data.slug })) data.slug = `${data.slug}-${Date.now().toString(36).slice(-4)}`;
  if (!(await Category.exists({ _id: data.category }))) throw badRequest('Category not found.');
  const p = await Product.create({ ...data, sku: data.sku.toUpperCase(), price: Math.min(...variants.map((v) => v.price)) });
  try { await saveVariants(p, variants, req); } catch (e) { await ProductVariant.deleteMany({ product: p._id }); await p.deleteOne(); throw e; }
  await audit(req, 'product.create', 'Product', p._id, { name: p.name });
  res.status(201).json({ product: await Product.findById(p._id).lean() });
}));
r.put('/:id', requirePerm('products:write'), validate(productSchema), ah(async (req, res) => {
  const { variants, ...data } = req.body;
  const p = await Product.findById(req.params.id);
  if (!p) throw notFound();
  const before = { price: p.price, status: p.status, name: p.name };
  if (data.slug) data.slug = slugify(data.slug);
  Object.assign(p, data, { sku: data.sku.toUpperCase() });
  await p.save();
  await saveVariants(p, variants, req);
  await audit(req, 'product.update', 'Product', p._id, { before, after: { status: p.status, name: p.name, variantPrices: variants.map((v) => `${v.sku}:${v.price}`) } });
  res.json({ product: await Product.findById(p._id).lean() });
}));
r.patch('/:id/status', requirePerm('products:write'), validate(z.object({ status: z.enum(['draft', 'published', 'archived']) })), ah(async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true });
  if (!p) throw notFound();
  await audit(req, `product.${req.body.status}`, 'Product', p._id);
  res.json({ product: p });
}));
r.patch('/variants/:variantId/stock', requirePerm('inventory:write'), validate(z.object({ stock: z.number().int().min(0).max(100000).optional(), adjust: z.number().int().min(-100000).max(100000).optional(), reason: z.string().max(120).optional() })), ah(async (req, res) => {
  let v;
  if (req.body.adjust != null) v = await ProductVariant.findOneAndUpdate({ _id: req.params.variantId, stock: { $gte: -req.body.adjust } }, { $inc: { stock: req.body.adjust } }, { new: true });
  else v = await ProductVariant.findByIdAndUpdate(req.params.variantId, { $set: { stock: req.body.stock } }, { new: true });
  if (!v) throw badRequest('Stock cannot go below zero.');
  await refreshProductStock([v.product]);
  await audit(req, 'inventory.adjust', 'ProductVariant', v._id, { sku: v.sku, ...req.body, result: v.stock });
  res.json({ variant: v });
}));

r.post('/images', requirePerm('products:write'), upload.array('images', 10), ah(async (req, res) => {
  if (!req.files?.length) throw badRequest('Please choose at least one image.');
  const out = [];
  for (const f of req.files) out.push(await storeImage(f.buffer, 'products'));
  res.status(201).json({ images: out });
}));

// CSV: one row per variant. Columns documented in docs/CSV_IMPORT.md
const CSV_COLS = ['product_sku', 'name', 'slug', 'category_slug', 'status', 'short_description', 'tags', 'colour', 'finish', 'material', 'variant_sku', 'variant_title', 'price_inr', 'compare_at_inr', 'stock', 'image_urls'];
r.get('/export/csv', requirePerm('products:read'), ah(async (_req, res) => {
  const ps = await Product.find().populate('category', 'slug').lean();
  const vs = await ProductVariant.find({ isActive: true }).lean();
  const rows = [];
  for (const p of ps) for (const v of vs.filter((x) => String(x.product) === String(p._id))) rows.push([p.sku, p.name, p.slug, p.category?.slug, p.status, p.shortDescription, (p.tags || []).join('|'), p.colour, p.finish, p.material, v.sku, v.title, v.price / 100, v.compareAtPrice ? v.compareAtPrice / 100 : '', v.stock, (p.images || []).map((i) => i.url).join('|')]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="eshtyle-products-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(stringify([CSV_COLS, ...rows]));
}));
r.post('/import/csv', requirePerm('products:write'), upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Please upload a CSV file.');
  let rows;
  try { rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true }); } catch (e) { throw badRequest(`Could not read CSV: ${e.message}`); }
  if (rows.length > 5000) throw badRequest('Maximum 5000 rows per import.');
  const dryRun = req.query.dryRun === 'true';
  const cats = new Map((await Category.find().lean()).map((c) => [c.slug, c._id]));
  const errors = []; const groups = new Map();
  rows.forEach((row, i) => {
    const line = i + 2; const e = (m) => errors.push({ line, message: m });
    if (!row.product_sku || !row.name || !row.variant_sku) return e('product_sku, name and variant_sku are required');
    if (!cats.has(row.category_slug)) return e(`Unknown category_slug "${row.category_slug}"`);
    const price = Math.round(Number(row.price_inr) * 100); if (!(price >= 100)) return e('price_inr must be a number ≥ 1');
    const cmp = row.compare_at_inr ? Math.round(Number(row.compare_at_inr) * 100) : undefined; if (cmp && cmp <= price) return e('compare_at_inr must be greater than price_inr');
    const stock = parseInt(row.stock, 10); if (!(stock >= 0)) return e('stock must be a whole number ≥ 0');
    const g = groups.get(row.product_sku.toUpperCase()) || { row, variants: [] };
    g.variants.push({ sku: row.variant_sku.toUpperCase(), title: row.variant_title || 'Default', price, compareAtPrice: cmp, stock });
    groups.set(row.product_sku.toUpperCase(), g);
  });
  if (errors.length || dryRun) return res.json({ ok: !errors.length, dryRun, errors: errors.slice(0, 200), products: groups.size, rows: rows.length });
  let created = 0; let updated = 0;
  for (const [sku, g] of groups) {
    const row = g.row;
    const data = { name: row.name, category: cats.get(row.category_slug), status: ['draft', 'published', 'archived'].includes(row.status) ? row.status : 'draft', shortDescription: row.short_description, tags: row.tags ? row.tags.split('|').map((t) => t.trim().toLowerCase()) : [], colour: row.colour, finish: row.finish, material: row.material };
    if (row.image_urls) data.images = row.image_urls.split('|').filter((u) => /^https:\/\//.test(u) || u.startsWith('/uploads/')).map((url) => ({ url, thumb: url }));
    let p = await Product.findOne({ sku });
    if (p) { Object.assign(p, data); await p.save(); updated++; } else { p = await Product.create({ ...data, sku, slug: slugify(row.slug || row.name) + (await Product.exists({ slug: slugify(row.slug || row.name) }) ? `-${sku.toLowerCase()}` : ''), price: g.variants[0].price }); created++; }
    for (const v of g.variants) await ProductVariant.findOneAndUpdate({ sku: v.sku }, { $set: { ...v, product: p._id, isActive: true } }, { upsert: true });
    await refreshProductStock([p._id]);
  }
  await audit(req, 'product.import', 'Product', null, { created, updated, rows: rows.length });
  res.json({ ok: true, created, updated, rows: rows.length });
}));
export default r;
