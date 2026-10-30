import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Address, Wishlist, Product, Order, Shipment, ReturnRequest, Review, User, Session, getSettings } from '../models/index.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { card } from './catalog.js';
import { cancelOrder } from '../services/orderService.js';
import { endSession } from '../services/authService.js';
import multer from 'multer';
import { storeVideo } from '../services/storage.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });

const r = Router();
r.use(requireAuth);
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
export const addressSchema = z.object({
  label: z.string().trim().max(30).optional(), fullName: z.string().trim().min(2).max(80), phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  line1: z.string().trim().min(3).max(160), line2: z.string().trim().max(160).optional().or(z.literal('')), landmark: z.string().trim().max(100).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(60), state: z.string().trim().min(2).max(60), pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'), isDefault: z.boolean().optional(),
});

r.patch('/profile', validate(z.object({ name: z.string().trim().min(2).max(80).optional(), marketingConsent: z.object({ email: z.boolean(), sms: z.boolean(), whatsapp: z.boolean() }).partial().optional() })), ah(async (req, res) => {
  if (req.body.name) req.user.name = req.body.name;
  if (req.body.marketingConsent) req.user.marketingConsent = { ...req.user.marketingConsent?.toObject?.(), ...req.body.marketingConsent, updatedAt: new Date() };
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
}));

// Addresses
r.get('/addresses', ah(async (req, res) => res.json({ items: await Address.find({ user: req.user._id }).sort({ isDefault: -1, updatedAt: -1 }).lean() })));
r.post('/addresses', validate(addressSchema), ah(async (req, res) => {
  const count = await Address.countDocuments({ user: req.user._id });
  if (count >= 20) throw badRequest('You can save up to 20 addresses.');
  const isDefault = req.body.isDefault || count === 0;
  if (isDefault) await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
  res.status(201).json({ address: await Address.create({ ...req.body, isDefault, user: req.user._id }) });
}));
r.put('/addresses/:id', validate(addressSchema), ah(async (req, res) => {
  if (req.body.isDefault) await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
  const a = await Address.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: req.body }, { new: true });
  if (!a) throw notFound('Address not found.');
  res.json({ address: a });
}));
r.delete('/addresses/:id', ah(async (req, res) => { await Address.deleteOne({ _id: req.params.id, user: req.user._id }); res.json({ ok: true }); }));

// Wishlist
r.get('/wishlist', ah(async (req, res) => {
  const w = await Wishlist.findOne({ user: req.user._id }).lean();
  const ps = w ? await Product.find({ _id: { $in: w.products }, status: 'published' }).lean() : [];
  res.json({ items: ps.map(card), ids: (w?.products || []).map(String) });
}));
r.post('/wishlist', validate(z.object({ productId: oid })), ah(async (req, res) => {
  if (!(await Product.exists({ _id: req.body.productId, status: 'published' }))) throw notFound('Product not found.');
  const w = await Wishlist.findOneAndUpdate({ user: req.user._id }, { $addToSet: { products: req.body.productId } }, { upsert: true, new: true });
  res.json({ ids: w.products.map(String) });
}));
r.post('/wishlist/merge', validate(z.object({ productIds: z.array(oid).max(100) })), ah(async (req, res) => {
  const valid = (await Product.find({ _id: { $in: req.body.productIds }, status: 'published' }).select('_id').lean()).map((p) => p._id);
  const w = await Wishlist.findOneAndUpdate({ user: req.user._id }, { $addToSet: { products: { $each: valid } } }, { upsert: true, new: true });
  res.json({ ids: w.products.map(String) });
}));
r.delete('/wishlist/:productId', ah(async (req, res) => {
  const w = await Wishlist.findOneAndUpdate({ user: req.user._id }, { $pull: { products: req.params.productId } }, { new: true });
  res.json({ ids: (w?.products || []).map(String) });
}));

// Orders
const publicOrder = (o, shipment) => ({
  id: o._id, orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, shippingStatus: o.shippingStatus,
  items: o.items, totals: o.totals, coupon: o.coupon, shippingAddress: o.shippingAddress, placedAt: o.placedAt, statusHistory: o.statusHistory?.map((s) => ({ status: s.status, at: s.at, note: s.note && !/admin/i.test(s.note) ? s.note : undefined })),
  invoiceNumber: o.invoiceNumber, thankYouCoupon: o.thankYouCoupon,
  shipment: shipment ? { awb: shipment.awb, courierName: shipment.courierName, trackingUrl: shipment.trackingUrl, status: shipment.status, events: shipment.events?.slice(-20), deliveredAt: shipment.deliveredAt } : null,
});
export { publicOrder };
r.get('/orders', ah(async (req, res) => {
  const items = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ items: items.map((o) => publicOrder(o)) });
}));
r.get('/orders/:orderNumber', ah(async (req, res) => {
  const o = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id }).lean();
  if (!o) throw notFound('Order not found.');
  const s = await Shipment.findOne({ order: o._id, kind: 'forward' }).lean();
  const returns = (await ReturnRequest.find({ order: o._id }).lean()).map((x) => ({ ...x, video: x.video?.key ? { uploaded: true, durationSec: x.video.durationSec } : undefined }));
  const settings = await getSettings();
  const deliveredAt = s?.deliveredAt || o.statusHistory?.find((h) => h.status === 'delivered')?.at;
  const returnDeadline = deliveredAt ? new Date(new Date(deliveredAt).getTime() + settings.returns.windowDays * 86400000) : null;
  res.json({ order: publicOrder(o, s), returns, canCancel: ['pending_payment', 'confirmed', 'processing', 'payment_failed'].includes(o.status) && !s?.awb, canReturn: o.status === 'delivered' && returnDeadline && returnDeadline > new Date() && !returns.some((x) => !['rejected', 'closed'].includes(x.status)), returnDeadline, returnReasons: settings.returns.reasons, returnWindowDays: settings.returns.windowDays, returnRequiresVideo: settings.returns.requireVideo !== false });
}));
r.post('/orders/:orderNumber/cancel', validate(z.object({ reason: z.string().trim().min(3).max(200) })), ah(async (req, res) => {
  const o = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!o) throw notFound('Order not found.');
  await cancelOrder(o, { reason: `Customer: ${req.body.reason}`, by: req.user._id, byCustomer: true });
  res.json({ order: publicOrder(o) });
}));
// Return policy (enforced here, not just written on a page):
//  • only for items received damaged / defective / wrong / missing — no change-of-mind returns
//  • within settings.returns.windowDays (7) of delivery
//  • the customer must upload the unboxing video recorded when opening the parcel
//  • the customer confirms the tag is intact, the piece is unused and in its original packaging
//  • nothing is picked up or refunded until a staff member has watched the video and approved.
const returnSchema = z.object({
  type: z.enum(['return', 'exchange']).default('return'),
  items: z.array(z.object({ orderItem: oid, quantity: z.number().int().min(1).max(10) })).min(1),
  reason: z.string().trim().min(3).max(80),
  comments: z.string().trim().min(10, 'Please describe the damage or defect.').max(1000),
  confirmations: z.object({ tagIntact: z.literal(true), unused: z.literal(true), originalPackaging: z.literal(true), unboxingVideo: z.literal(true) }, { errorMap: () => ({ message: 'Please confirm all the return conditions.' }) }),
});
r.post('/orders/:orderNumber/returns', uploadLimiter, evidenceUpload.single('video'), ah(async (req, res) => {
  let raw = req.body;
  if (typeof raw?.data === 'string') { try { raw = JSON.parse(raw.data); } catch { throw badRequest('Invalid request.'); } }
  const parsed = returnSchema.safeParse(raw);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || 'Invalid request.');
  const body = parsed.data;
  const o = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!o) throw notFound('Order not found.');
  if (o.status !== 'delivered') throw badRequest('Returns can be requested after delivery.');
  const settings = await getSettings();
  if (!settings.returns.reasons.includes(body.reason)) throw badRequest('Returns are accepted only for damaged, defective, wrong or missing items.');
  const s = await Shipment.findOne({ order: o._id, kind: 'forward' });
  const deliveredAt = s?.deliveredAt || o.statusHistory.find((h) => h.status === 'delivered')?.at;
  if (!deliveredAt || Date.now() - new Date(deliveredAt).getTime() > settings.returns.windowDays * 86400000) throw badRequest(`The ${settings.returns.windowDays}-day return window for this order has closed.`);
  if (await ReturnRequest.exists({ order: o._id, status: { $nin: ['rejected', 'closed'] } })) throw badRequest('A return request is already open for this order.');
  for (const it of body.items) {
    const oi = o.items.id(it.orderItem);
    if (!oi) throw badRequest('Invalid item.');
    if (oi.returnable === false) throw badRequest(`${oi.name} is not eligible for return.`);
    if (it.quantity > oi.quantity) throw badRequest('Invalid quantity.');
  }
  if (settings.returns.requireVideo !== false && !req.file) throw badRequest('Please upload the unboxing video you recorded when opening the parcel.');
  const video = req.file ? await storeVideo(req.file.buffer, { private: true }) : undefined;
  const rr = await ReturnRequest.create({ ...body, video: video && { key: video.key, size: video.size, durationSec: video.durationSec, uploadedAt: new Date() }, order: o._id, user: req.user._id });
  o.statusHistory.push({ status: 'return_requested', note: body.reason }); o.status = 'return_requested'; await o.save();
  res.status(201).json({ returnRequest: { ...rr.toObject(), video: rr.video?.key ? { uploaded: true, durationSec: rr.video.durationSec } : undefined } });
}));

// Reviews — any signed-in customer can review; buyers with a delivered order get a "Verified purchase" badge. Moderated before publishing.
r.post('/reviews', validate(z.object({ productId: oid, rating: z.number().int().min(1).max(5), title: z.string().trim().max(100).optional(), body: z.string().trim().min(10).max(2000) })), ah(async (req, res) => {
  if (!(await Product.exists({ _id: req.body.productId }))) throw badRequest('Product not found.');
  if (await Review.exists({ product: req.body.productId, user: req.user._id })) throw badRequest('You have already reviewed this product.');
  const order = await Order.findOne({ user: req.user._id, status: 'delivered', 'items.product': req.body.productId }).select('_id');
  const review = await Review.create({ product: req.body.productId, user: req.user._id, order: order?._id, rating: req.body.rating, title: req.body.title, body: req.body.body, authorName: (req.user.name || 'Customer').split(' ')[0], verifiedPurchase: Boolean(order) });
  res.status(201).json({ review, message: 'Thank you! Your review will appear after moderation.' });
}));

// Data deletion (DPDP-friendly): anonymises the account; order records are retained for tax/accounting law.
r.post('/delete', validate(z.object({ confirm: z.literal('DELETE') })), ah(async (req, res) => {
  const u = await User.findById(req.user._id);
  u.status = 'deleted'; u.name = 'Deleted user'; u.email = undefined; u.phone = undefined; u.passwordHash = undefined; u.marketingConsent = { email: false, sms: false, whatsapp: false, updatedAt: new Date() };
  await u.save();
  await Address.deleteMany({ user: u._id }); await Wishlist.deleteMany({ user: u._id }); await Session.updateMany({ user: u._id }, { $set: { revokedAt: new Date() } });
  await endSession(req, res);
  res.json({ ok: true });
}));
export default r;
