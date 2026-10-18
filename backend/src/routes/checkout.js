import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Address, Order, Payment, getSettings } from '../models/index.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { checkoutLimiter } from '../middleware/rateLimit.js';
import { getCart, loadLines } from '../services/cartService.js';
import { priceLines } from '../services/pricing.js';
import { quotePincode } from '../services/shippingQuote.js';
import { reserveStock, releaseStock } from '../services/inventory.js';
import { newOrderNumber, buildOrderItems, startOnlinePayment, confirmCodOrder, markPaid, markPaymentFailed } from '../services/orderService.js';
import { getPaymentAdapter, adapterByName } from '../services/payments/index.js';
import { addressSchema, publicOrder } from './account.js';
import logger from '../lib/logger.js';

const r = Router();
r.use(requireAuth);
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

async function resolveAddress(req, body) {
  if (body.addressId) {
    const a = await Address.findOne({ _id: body.addressId, user: req.user._id }).lean();
    if (!a) throw badRequest('Please choose a delivery address.');
    return a;
  }
  if (body.address) return body.address;
  return null;
}

r.post('/quote', validate(z.object({ addressId: oid.optional(), pincode: z.string().optional(), paymentMethod: z.enum(['online', 'cod']).default('online') })), ah(async (req, res) => {
  const settings = await getSettings();
  const cart = await getCart(req, res);
  const { lines, issues } = await loadLines(cart);
  const addr = await resolveAddress(req, req.body);
  const pincode = addr?.pincode || req.body.pincode;
  const quote = pincode ? await quotePincode(pincode, settings) : null;
  const priced = await priceLines(lines.filter((l) => !l.outOfStock), { settings, couponCode: cart?.couponCode, paymentMethod: req.body.paymentMethod, user: req.user, pincodeQuote: quote });
  res.json({ totals: priced.totals, coupon: priced.coupon, couponError: priced.couponError, cod: priced.cod, serviceability: quote, issues, onlinePayment: Boolean(getPaymentAdapter()) });
}));

const placeSchema = z.object({
  addressId: oid.optional(), address: addressSchema.optional(), saveAddress: z.boolean().optional(),
  paymentMethod: z.enum(['online', 'cod']), idempotencyKey: z.string().min(16).max(64), acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms to continue.' }) }),
  notes: z.string().trim().max(300).optional(), attribution: z.object({ utmSource: z.string().max(60), utmMedium: z.string().max(60), utmCampaign: z.string().max(80), utmContent: z.string().max(80), fbclid: z.string().max(300), gclid: z.string().max(300), landingPage: z.string().max(300) }).partial().optional(),
  adConsent: z.boolean().optional(), sourceUrl: z.string().max(300).optional(),
});

r.post('/orders', checkoutLimiter, validate(placeSchema), ah(async (req, res) => {
  const b = req.body;
  // Idempotency: a double-clicked or retried submit returns the same order.
  const prior = await Order.findOne({ user: req.user._id, idempotencyKey: b.idempotencyKey });
  if (prior) {
    let payment = null;
    if (prior.status === 'pending_payment' && prior.paymentMethod === 'online') payment = await startOnlinePayment(prior, customerOf(req.user, prior));
    return res.json({ order: publicOrder(prior), payment, replay: true });
  }
  const settings = await getSettings();
  const cart = await getCart(req, res);
  const { lines } = await loadLines(cart);
  if (!lines.length) throw badRequest('Your bag is empty.');
  if (lines.some((l) => l.outOfStock)) throw badRequest('Some items in your bag are out of stock. Please review your bag.');
  const address = await resolveAddress(req, b);
  if (!address) throw badRequest('Please add a delivery address.');
  if (b.address && b.saveAddress) await Address.create({ ...b.address, user: req.user._id, isDefault: !(await Address.exists({ user: req.user._id })) }).catch(() => {});
  const quote = await quotePincode(address.pincode, settings);
  if (!quote.serviceable) throw badRequest(quote.reason || 'We cannot deliver to this pincode yet.');
  const priced = await priceLines(lines, { settings, couponCode: cart.couponCode, paymentMethod: b.paymentMethod, user: req.user, pincodeQuote: quote });
  if (priced.couponError) throw badRequest(`${priced.couponError} Please remove the coupon to continue.`);
  if (b.paymentMethod === 'cod' && !priced.cod.ok) throw badRequest(priced.cod.reason);
  if (b.paymentMethod === 'online' && !getPaymentAdapter()) throw badRequest('Online payment is not available right now. Please choose Cash on Delivery.');
  if (!req.user.email && !req.user.phone) throw badRequest('Please add an email or phone to your account.');

  const shippingAddress = { fullName: address.fullName, phone: address.phone, line1: address.line1, line2: address.line2, landmark: address.landmark, city: address.city, state: address.state, pincode: address.pincode, country: 'India' };
  const items = buildOrderItems(priced);
  await reserveStock(items);
  let order;
  try {
    order = await Order.create({
      orderNumber: newOrderNumber(), user: req.user._id, email: req.user.email, phone: req.user.phone || address.phone, items, shippingAddress, billingAddress: shippingAddress,
      totals: priced.totals, coupon: priced.coupon || undefined, paymentMethod: b.paymentMethod, status: 'pending_payment', paymentStatus: 'pending',
      statusHistory: b.paymentMethod === 'online' ? [{ status: 'pending_payment', note: 'Order created' }] : [], stockReserved: true,
      reservationExpiresAt: b.paymentMethod === 'online' ? new Date(Date.now() + settings.orders.reservationMinutes * 60000) : undefined,
      idempotencyKey: b.idempotencyKey, notes: b.notes, attribution: b.attribution,
      adTracking: b.adConsent ? { consent: true, fbp: req.cookies?._fbp, fbc: req.cookies?._fbc || (b.attribution?.fbclid ? `fb.1.${Date.now()}.${b.attribution.fbclid}` : undefined), ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 300), sourceUrl: b.sourceUrl } : { consent: false },
    });
  } catch (e) {
    await releaseStock(items);
    if (e.code === 11000) { const o = await Order.findOne({ user: req.user._id, idempotencyKey: b.idempotencyKey }); if (o) return res.json({ order: publicOrder(o), replay: true }); }
    throw e;
  }
  if (b.paymentMethod === 'cod') {
    await confirmCodOrder(order);
    return res.status(201).json({ order: publicOrder(order), payment: null });
  }
  try {
    const payment = await startOnlinePayment(order, customerOf(req.user, order));
    return res.status(201).json({ order: publicOrder(order), payment });
  } catch (e) {
    logger.error({ err: e.message, order: order.orderNumber }, 'payment init failed');
    await Order.updateOne({ _id: order._id, stockReserved: true }, { $set: { status: 'payment_failed', stockReserved: false }, $push: { statusHistory: { status: 'payment_failed', note: 'Payment could not be started' } } });
    await releaseStock(items);
    throw badRequest('We could not start the payment. No money was charged. Please try again or choose Cash on Delivery.');
  }
}));

function customerOf(user, order) {
  return { id: String(user._id), name: user.name || order.shippingAddress.fullName, email: user.email || undefined, phone: order.shippingAddress.phone };
}

// Retry payment for an order whose stock is still reserved.
r.post('/orders/:orderNumber/pay', checkoutLimiter, ah(async (req, res) => {
  const o = await Order.findOne({ orderNumber: req.params.orderNumber, user: req.user._id });
  if (!o) throw notFound('Order not found.');
  if (o.paymentStatus === 'paid') return res.json({ order: publicOrder(o), payment: null });
  if (o.status !== 'pending_payment' || !o.stockReserved) throw badRequest('This order can no longer be paid. Please place a new order.');
  if (o.paymentStatus === 'failed') { o.paymentStatus = 'pending'; await Payment.updateMany({ order: o._id, status: { $in: ['created', 'pending'] } }, { $set: { status: 'failed' } }); }
  const payment = await startOnlinePayment(o, customerOf(req.user, o));
  res.json({ order: publicOrder(o), payment });
}));

// Razorpay: verify the checkout signature on the server. Never trusts a client "success".
r.post('/payments/razorpay/verify', validate(z.object({ orderNumber: z.string(), razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() })), ah(async (req, res) => {
  const o = await Order.findOne({ orderNumber: req.body.orderNumber, user: req.user._id });
  if (!o) throw notFound('Order not found.');
  const pay = await Payment.findOne({ order: o._id, provider: 'razorpay', providerOrderId: req.body.razorpay_order_id });
  const adapter = adapterByName('razorpay');
  if (!pay || !adapter.isConfigured() || !adapter.verifyClientPayment(req.body)) throw badRequest('Payment verification failed. If money was deducted, it will be confirmed automatically or refunded.');
  const order = await markPaid(pay, { providerPaymentId: req.body.razorpay_payment_id, verifiedBy: 'signature' });
  res.json({ order: publicOrder(order) });
}));
r.post('/payments/failed', validate(z.object({ orderNumber: z.string(), reason: z.string().max(200).optional() })), ah(async (req, res) => {
  const o = await Order.findOne({ orderNumber: req.body.orderNumber, user: req.user._id });
  if (!o) throw notFound('Order not found.');
  const pay = await Payment.findOne({ order: o._id, status: { $in: ['created', 'pending'] } }).sort({ createdAt: -1 });
  if (pay) await markPaymentFailed(pay, req.body.reason || 'Customer closed or payment declined');
  res.json({ ok: true });
}));
// Cashfree (and a generic "check status" for any provider): server asks the gateway.
r.post('/payments/confirm', validate(z.object({ orderNumber: z.string() })), ah(async (req, res) => {
  const o = await Order.findOne({ orderNumber: req.body.orderNumber, user: req.user._id });
  if (!o) throw notFound('Order not found.');
  if (o.paymentStatus === 'paid') return res.json({ order: publicOrder(o), status: 'paid' });
  const pay = await Payment.findOne({ order: o._id, provider: { $ne: 'cod' } }).sort({ createdAt: -1 });
  const adapter = pay && adapterByName(pay.provider);
  if (!adapter?.isConfigured()) return res.json({ order: publicOrder(o), status: 'pending' });
  const st = await adapter.fetchOrderPayments(pay.providerOrderId);
  if (st.status === 'paid') { const order = await markPaid(pay, { providerPaymentId: st.providerPaymentId, method: st.method, verifiedBy: 'reconcile', amount: st.amount }); return res.json({ order: publicOrder(order), status: 'paid' }); }
  if (st.status === 'failed') await markPaymentFailed(pay, 'Declined at gateway');
  res.json({ order: publicOrder(await Order.findById(o._id)), status: st.status });
}));
export default r;
