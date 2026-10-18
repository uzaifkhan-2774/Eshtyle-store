import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { stringify } from 'csv-stringify/sync';
import { Reel, User, Order, Address, Category, Collection, Coupon, Banner, Page, NewsletterSubscription, Review, Product, AuditLog, SupportTicket, StoreSettings, Notification, getSettings } from '../../models/index.js';
import { ah, badRequest, notFound, forbidden } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requirePerm, PERMISSIONS } from '../../middleware/auth.js';
import { audit } from '../../lib/audit.js';
import { escapeRegex, pageParams, slugify } from '../../lib/util.js';
import { hashPassword, revokeAllSessions } from '../../services/authService.js';
import { STAFF_ROLES } from '../../models/User.js';
import multer from 'multer';
import { storeVideo } from '../../services/storage.js';
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 80 * 1024 * 1024, files: 1 } });

const r = Router();
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
const imgObj = z.object({ url: z.string().max(500), thumb: z.string().max(500).optional(), alt: z.string().max(160).optional() }).partial();
const optDate = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.null()]).optional().transform((v) => (v ? new Date(v) : null));

/** Generic CRUD helper for simple admin-managed collections. */
function crud(path, Model, schema, perm, { sort = { sortOrder: 1, createdAt: -1 }, before } = {}) {
  r.get(path, requirePerm(perm), ah(async (_req, res) => res.json({ items: await Model.find().sort(sort).lean() })));
  r.post(path, requirePerm(perm), validate(schema), ah(async (req, res) => {
    const data = before ? await before(req.body) : req.body;
    const doc = await Model.create(data);
    await audit(req, `${Model.modelName.toLowerCase()}.create`, Model.modelName, doc._id);
    res.status(201).json({ item: doc });
  }));
  r.put(`${path}/:id`, requirePerm(perm), validate(schema), ah(async (req, res) => {
    const data = before ? await before(req.body, req.params.id) : req.body;
    const doc = await Model.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!doc) throw notFound();
    await audit(req, `${Model.modelName.toLowerCase()}.update`, Model.modelName, doc._id, data);
    res.json({ item: doc });
  }));
  r.delete(`${path}/:id`, requirePerm(perm), ah(async (req, res) => {
    await Model.findByIdAndDelete(req.params.id);
    await audit(req, `${Model.modelName.toLowerCase()}.delete`, Model.modelName, req.params.id);
    res.json({ ok: true });
  }));
}

// ---- Categories
const catSchema = z.object({ name: z.string().trim().min(2).max(60), slug: z.string().trim().max(60).optional(), parent: oid.nullable().optional(), description: z.string().max(600).optional(), image: imgObj.optional(), sortOrder: z.number().int().optional(), isPublished: z.boolean().optional(), showInNav: z.boolean().optional(), seo: z.object({ title: z.string().max(70), description: z.string().max(170) }).partial().optional() });
r.delete('/categories/:id', requirePerm('categories:write'), ah(async (req, res) => {
  const used = await Product.countDocuments({ $or: [{ category: req.params.id }, { subcategory: req.params.id }] });
  if (used) throw badRequest(`This category has ${used} products. Move them first, or hide the category instead.`);
  if (await Category.exists({ parent: req.params.id })) throw badRequest('Remove or move subcategories first.');
  await Category.findByIdAndDelete(req.params.id); await audit(req, 'category.delete', 'Category', req.params.id);
  res.json({ ok: true });
}));
crud('/categories', Category, catSchema, 'categories:write', { before: async (b, id) => ({ ...b, slug: slugify(b.slug || b.name), parent: b.parent && b.parent !== id ? b.parent : null }) });
r.post('/categories-reorder', requirePerm('categories:write'), validate(z.object({ ids: z.array(oid).max(200) })), ah(async (req, res) => {
  await Category.bulkWrite(req.body.ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: i } } } })));
  res.json({ ok: true });
}));

// ---- Collections
crud('/collections', Collection, z.object({ name: z.string().trim().min(2).max(60), slug: z.string().trim().max(60).optional(), type: z.enum(['manual', 'new_arrivals', 'bestsellers', 'sale', 'tag']), tag: z.string().max(30).optional(), products: z.array(oid).max(200).optional(), description: z.string().max(600).optional(), image: imgObj.optional(), isPublished: z.boolean().optional(), showInNav: z.boolean().optional(), sortOrder: z.number().int().optional() }), 'marketing:write', { before: async (b) => ({ ...b, slug: slugify(b.slug || b.name) }) });

// ---- Coupons (values in paise; percent value is 0–100)
crud('/coupons', Coupon, z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/), description: z.string().max(160).optional(), type: z.enum(['percent', 'flat', 'free_shipping']), value: z.number().min(0), maxDiscount: z.number().int().min(0).nullable().optional(), minOrderValue: z.number().int().min(0).optional(), startsAt: optDate, endsAt: optDate, usageLimit: z.number().int().min(1).nullable().optional(), perUserLimit: z.number().int().min(0).optional(), firstOrderOnly: z.boolean().optional(), categories: z.array(oid).optional(), campaign: z.string().max(60).optional(), isActive: z.boolean().optional() }).refine((c) => c.type !== 'percent' || c.value <= 90, { message: 'Percent discount cannot exceed 90%', path: ['value'] }), 'marketing:write', { sort: { createdAt: -1 } });

// ---- Banners
crud('/banners', Banner, z.object({ placement: z.enum(['hero', 'promo', 'announcement', 'editorial', 'look']), hotspots: z.array(z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), productSlug: z.string().max(120), label: z.string().max(60).optional() })).max(8).optional(), title: z.string().max(120).optional(), subtitle: z.string().max(240).optional(), ctaLabel: z.string().max(30).optional(), ctaUrl: z.string().max(300).regex(/^(\/|https:\/\/)/, 'Use a site path like /shop or an https:// link').optional().or(z.literal('')), image: imgObj.optional(), mobileImage: imgObj.optional(), theme: z.enum(['light', 'dark']).optional(), startsAt: optDate, endsAt: optDate, isActive: z.boolean().optional(), sortOrder: z.number().int().optional() }), 'marketing:write');

// ---- Reels & brand films
r.post('/reels/upload', requirePerm('marketing:write'), videoUpload.single('video'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Please choose a video file.');
  res.status(201).json({ video: await storeVideo(req.file.buffer) });
}));
crud('/reels', Reel, z.object({ title: z.string().max(80).optional(), caption: z.string().max(200).optional(), video: z.object({ url: z.string().min(1).max(500), poster: z.string().max(500).optional(), width: z.number().optional(), height: z.number().optional(), durationSec: z.number().optional() }), orientation: z.enum(['portrait', 'landscape']), productSlugs: z.array(z.string().max(120)).max(6).optional(), ctaLabel: z.string().max(30).optional(), ctaUrl: z.string().max(300).optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() }), 'marketing:write');

// ---- Campaign pages
crud('/pages', Page, z.object({ slug: z.string().trim().min(2).max(60), title: z.string().trim().min(2).max(120), heroImage: imgObj.optional(), intro: z.string().max(600).optional(), body: z.string().max(8000).optional(), linkedCollection: oid.nullable().optional(), couponCode: z.string().max(24).optional(), isPublished: z.boolean().optional(), seo: z.object({ title: z.string().max(70), description: z.string().max(170) }).partial().optional() }), 'marketing:write', { sort: { createdAt: -1 }, before: async (b) => ({ ...b, slug: slugify(b.slug) }) });

// ---- Newsletter
r.get('/newsletter', requirePerm('marketing:write'), ah(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 200);
  const f = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([NewsletterSubscription.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-unsubscribeToken -ip').lean(), NewsletterSubscription.countDocuments(f)]);
  res.json({ items, total });
}));
r.get('/newsletter/export', requirePerm('marketing:write'), ah(async (req, res) => {
  const items = await NewsletterSubscription.find({ status: 'subscribed' }).lean();
  await audit(req, 'newsletter.export', 'NewsletterSubscription', null, { count: items.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
  res.send(stringify([['email', 'consent_at', 'source'], ...items.map((i) => [i.email, i.consentAt?.toISOString(), i.source])]));
}));

// ---- Reviews moderation
r.get('/reviews', requirePerm('reviews:write'), ah(async (req, res) => {
  const items = await Review.find(req.query.status ? { status: req.query.status } : {}).sort({ createdAt: -1 }).limit(200).populate('product', 'name slug').lean();
  res.json({ items });
}));
r.post('/reviews/:id', requirePerm('reviews:write'), validate(z.object({ status: z.enum(['approved', 'rejected', 'pending']), featured: z.boolean().optional() })), ah(async (req, res) => {
  const rv = await Review.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!rv) throw notFound();
  const agg = await Review.find({ product: rv.product, status: 'approved' }).select('rating').lean();
  await Product.updateOne({ _id: rv.product }, { $set: { ratingCount: agg.length, ratingAvg: agg.length ? Math.round((agg.reduce((s, x) => s + x.rating, 0) / agg.length) * 10) / 10 : 0 } });
  await audit(req, 'review.moderate', 'Review', rv._id, req.body);
  res.json({ review: rv });
}));

// ---- Customers
r.get('/customers', requirePerm('customers:read'), ah(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 100);
  const f = { role: 'customer', status: { $ne: 'deleted' } };
  if (req.query.q) { const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i'); f.$or = [{ name: rx }, { email: rx }, { phone: rx }]; }
  if (req.query.status) f.status = req.query.status;
  const [items, total] = await Promise.all([User.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(f)]);
  const stats = await Order.find({ user: { $in: items.map((u) => u._id) }, status: { $nin: ['cancelled', 'expired', 'payment_failed', 'pending_payment'] } }).select('user totals.total').lean();
  const by = stats.reduce((m, o) => { const k = String(o.user); m[k] ||= { orders: 0, spent: 0 }; m[k].orders++; m[k].spent += o.totals.total; return m; }, {});
  res.json({ items: items.map((u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, status: u.status, emailVerified: u.emailVerified, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, ...(by[String(u._id)] || { orders: 0, spent: 0 }) })), total });
}));
r.get('/customers/:id', requirePerm('customers:read'), ah(async (req, res) => {
  const u = await User.findById(req.params.id).lean(); if (!u) throw notFound();
  const [orders, addresses, tickets] = await Promise.all([Order.find({ user: u._id }).sort({ createdAt: -1 }).select('orderNumber placedAt status paymentStatus totals').lean(), Address.find({ user: u._id }).lean(), SupportTicket.find({ user: u._id }).sort({ createdAt: -1 }).lean()]);
  delete u.passwordHash;
  res.json({ customer: u, orders, addresses, tickets });
}));
r.post('/customers/:id/status', requirePerm('customers:write'), validate(z.object({ status: z.enum(['active', 'suspended']) })), ah(async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: 'customer' });
  if (!u) throw notFound();
  u.status = req.body.status; await u.save();
  if (req.body.status === 'suspended') await revokeAllSessions(u._id);
  await audit(req, 'customer.status', 'User', u._id, req.body);
  res.json({ ok: true });
}));

// ---- Support tickets
r.get('/tickets', requirePerm('customers:read'), ah(async (req, res) => res.json({ items: await SupportTicket.find(req.query.status ? { status: req.query.status } : {}).sort({ createdAt: -1 }).limit(200).lean() })));
r.post('/tickets/:id', requirePerm('customers:read'), validate(z.object({ status: z.enum(['open', 'in_progress', 'resolved']).optional(), note: z.string().max(1000).optional() })), ah(async (req, res) => {
  const t = await SupportTicket.findById(req.params.id); if (!t) throw notFound();
  if (req.body.status) t.status = req.body.status;
  if (req.body.note) t.notes.push({ by: req.user._id, text: req.body.note });
  await t.save(); res.json({ item: t });
}));

// ---- Store settings (read: managers; write: owner only)
r.get('/settings', requirePerm('settings:read'), ah(async (_req, res) => res.json({ settings: await getSettings() })));
const settingsSchema = z.object({
  business: z.object({ name: z.string().max(80), legalName: z.string().max(120), ownerName: z.string().max(120), gstin: z.string().regex(/^$|^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GSTIN format'), pan: z.string().max(10), email: z.string().max(160), phone: z.string().max(15), whatsapp: z.string().max(15), address: z.object({ line1: z.string().max(160), line2: z.string().max(160), city: z.string().max(60), state: z.string().max(60), pincode: z.string().max(6) }).partial(), instagram: z.string().max(200), facebook: z.string().max(200), youtube: z.string().max(200) }).partial().optional(),
  announcement: z.object({ text: z.string().max(160), link: z.string().max(200), isActive: z.boolean() }).partial().optional(),
  tax: z.object({ rate: z.number().min(0).max(28), pricesIncludeTax: z.boolean(), invoicePrefix: z.string().max(10) }).partial().optional(),
  shipping: z.object({ flatRate: z.number().int().min(0), freeAbove: z.number().int().min(0), estimateDaysMin: z.number().int().min(1), estimateDaysMax: z.number().int().min(1), defaultWeightGrams: z.number().int().min(1), blockedPincodes: z.array(z.string().regex(/^\d{6}$/)) }).partial().optional(),
  cod: z.object({ enabled: z.boolean(), fee: z.number().int().min(0), maxOrderValue: z.number().int().min(0), minOrderValue: z.number().int().min(0) }).partial().optional(),
  returns: z.object({ windowDays: z.number().int().min(0).max(60), policySummary: z.string().max(1000), reasons: z.array(z.string().max(80)).max(12), requireVideo: z.boolean() }).partial().optional(),
  orders: z.object({ reservationMinutes: z.number().int().min(10).max(1440), maxQtyPerItem: z.number().int().min(1).max(50) }).partial().optional(),
  seo: z.object({ defaultTitle: z.string().max(70), defaultDescription: z.string().max(170) }).partial().optional(),
  analytics: z.object({ gaMeasurementId: z.string().regex(/^$|^G-[A-Z0-9]+$/), metaPixelId: z.string().regex(/^$|^\d{6,20}$/) }).partial().optional(),
});
r.put('/settings', requirePerm('settings:write'), validate(settingsSchema), ah(async (req, res) => {
  const set = {};
  for (const [k, v] of Object.entries(req.body)) for (const [k2, v2] of Object.entries(v || {})) set[`${k}.${k2}`] = v2;
  const s = await StoreSettings.findOneAndUpdate({ key: 'store' }, { $set: set }, { new: true, upsert: true });
  await audit(req, 'settings.update', 'StoreSettings', s._id, set);
  res.json({ settings: s });
}));

// ---- Staff (owner only)
r.get('/staff', requirePerm('staff:manage'), ah(async (_req, res) => res.json({ items: (await User.find({ role: { $in: STAFF_ROLES } }).lean()).map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, status: u.status, lastLoginAt: u.lastLoginAt })), permissions: PERMISSIONS })));
r.post('/staff', requirePerm('staff:manage'), validate(z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), role: z.enum(['manager', 'inventory', 'support']), password: z.string().min(12, 'Staff passwords need at least 12 characters').max(128) })), ah(async (req, res) => {
  const existing = await User.findOne({ email: req.body.email });
  if (existing && existing.role !== 'customer') throw badRequest('This person is already a staff member.');
  const u = existing || new User({ email: req.body.email });
  Object.assign(u, { name: req.body.name, role: req.body.role, emailVerified: true, status: 'active', passwordHash: await hashPassword(req.body.password) });
  await u.save(); await revokeAllSessions(u._id);
  await audit(req, 'staff.create', 'User', u._id, { role: u.role, email: u.email });
  res.status(201).json({ ok: true });
}));
r.post('/staff/:id', requirePerm('staff:manage'), validate(z.object({ role: z.enum(['manager', 'inventory', 'support', 'customer']).optional(), status: z.enum(['active', 'suspended']).optional() })), ah(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw forbidden('You cannot change your own access.');
  const u = await User.findById(req.params.id);
  if (!u || u.role === 'owner') throw forbidden('Owner accounts can only be changed from the server.');
  Object.assign(u, req.body); await u.save(); await revokeAllSessions(u._id);
  await audit(req, 'staff.update', 'User', u._id, req.body);
  res.json({ ok: true });
}));

// ---- Audit log & notifications
r.get('/audit', requirePerm('audit:read'), ah(async (req, res) => {
  const { limit, skip } = pageParams(req.query, 200);
  res.json({ items: await AuditLog.find(req.query.entity ? { entity: req.query.entity } : {}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean() });
}));
r.get('/notifications', requirePerm('audit:read'), ah(async (_req, res) => res.json({ items: await Notification.find().sort({ createdAt: -1 }).limit(200).lean() })));
export default r;
