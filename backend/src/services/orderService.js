import crypto from 'node:crypto';
import { Order, Payment, Coupon, Product, Cart, Shipment, Refund, getSettings } from '../models/index.js';
import { reserveStock, releaseStock } from './inventory.js';
import { notifyEmail, notifyAdmin, notifySms } from './notify/index.js';
import { getPaymentAdapter, adapterByName } from './payments/index.js';
import * as shiprocket from './shipping/shiprocket.js';
import { badRequest, conflict, unavailable } from '../lib/errors.js';
import { sendPurchase } from './metaCapi.js';
import logger from '../lib/logger.js';
import env from '../config/env.js';

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  let r = ''; const bytes = crypto.randomBytes(5);
  for (const b of bytes) r += ALPH[b % ALPH.length];
  return `ESH${ymd}${r}`;
}
export function pushStatus(order, status, note, by) {
  order.status = status;
  order.statusHistory.push({ status, note, by });
}

export function buildOrderItems(priced) {
  return priced.lines.map((l) => {
    const img = l.variant.images?.[0] || l.product.images?.[0];
    return {
      product: l.product._id, variant: l.variant._id, name: l.product.name, slug: l.product.slug, sku: l.variant.sku, variantTitle: l.variant.title,
      image: img?.thumb || img?.url, hsnCode: l.product.hsnCode, unitPrice: l.unitPrice, compareAtPrice: l.variant.compareAtPrice, quantity: l.quantity,
      lineSubtotal: l.lineSubtotal, lineDiscount: l.lineDiscount, lineTotal: l.lineTotal, taxRate: l.taxRate, taxAmount: l.taxAmount,
      returnable: l.product.returnable, returnWindowDays: l.product.returnWindowDays,
    };
  });
}

/** Called once an order is definitively confirmed (COD placed, or online payment verified). Idempotent per order. */
async function onConfirmed(order) {
  await Product.bulkWrite(order.items.map((i) => ({ updateOne: { filter: { _id: i.product }, update: { $inc: { salesCount: i.quantity } } } })));
  if (order.coupon?.code) await Coupon.updateOne({ code: order.coupon.code }, { $inc: { usedCount: 1 } });
  if (order.user) await Cart.updateOne({ user: order.user }, { $set: { items: [], couponCode: null } });
  notifyEmail('orderConfirmation', order.email, { order }, { order: order._id, user: order.user });
  notifySms(order.phone, { order: order.orderNumber, amount: (order.totals.total / 100).toFixed(0) }, { template: 'order_confirmed', order: order._id });
  notifyAdmin('adminOrderAlert', { order });
  sendPurchase(order._id); // fire-and-forget; only runs with marketing consent + token
}

export async function startOnlinePayment(order, customer) {
  const adapter = getPaymentAdapter();
  if (!adapter) throw unavailable('Online payment is not configured yet. Please choose Cash on Delivery or try later.', 'PAYMENT_NOT_CONFIGURED');
  const existing = await Payment.findOne({ order: order._id, provider: adapter.name, status: { $in: ['created', 'pending'] } });
  let p = existing;
  let session;
  if (!p) {
    const receipt = `${order.orderNumber}-${Date.now().toString(36)}`.slice(0, 40);
    const r = await adapter.createOrder({ amount: order.totals.total, receipt, notes: { orderNumber: order.orderNumber }, customer, returnUrl: `${env.APP_URL}/checkout/return?order=${order.orderNumber}` });
    p = await Payment.create({ order: order._id, provider: adapter.name, providerOrderId: r.providerOrderId, amount: order.totals.total, status: 'created' });
    session = r.paymentSessionId;
  }
  order.paymentProvider = adapter.name;
  await order.save();
  return adapter.checkoutPayload({ providerOrderId: p.providerOrderId, paymentSessionId: session, amount: p.amount, order, prefill: { name: customer.name, email: customer.email, contact: customer.phone } });
}

/** Mark paid. Safe to call repeatedly (signature verify + webhook + reconcile may all arrive). */
export async function markPaid(payment, { providerPaymentId, method, verifiedBy, amount }) {
  if (amount != null && amount !== payment.amount) {
    logger.error({ payment: payment._id, expected: payment.amount, got: amount }, 'Payment amount mismatch');
    throw conflict('Payment amount mismatch — flagged for review.');
  }
  const updated = await Payment.findOneAndUpdate({ _id: payment._id, status: { $ne: 'paid' } }, { $set: { status: 'paid', providerPaymentId, method, verifiedBy } }, { new: true });
  if (!updated) return Order.findById(payment.order); // already processed
  const order = await Order.findById(payment.order);
  if (order.paymentStatus === 'paid') return order;
  if (['expired', 'cancelled', 'payment_failed'].includes(order.status) && !order.stockReserved) {
    // Payment arrived after the reservation lapsed: try to re-reserve; if impossible, flag for refund.
    try { await reserveStock(order.items); order.stockReserved = true; } catch {
      order.paymentStatus = 'refund_pending'; pushStatus(order, 'cancelled', 'Paid after reservation expired and stock unavailable — refund required');
      await order.save(); return order;
    }
  }
  order.paymentStatus = 'paid';
  order.reservationExpiresAt = undefined;
  pushStatus(order, 'confirmed', `Payment verified (${verifiedBy})`);
  await order.save();
  await onConfirmed(order);
  return order;
}
export async function markPaymentFailed(payment, reason) {
  await Payment.updateOne({ _id: payment._id, status: { $nin: ['paid'] } }, { $set: { status: 'failed', failureReason: reason?.slice(0, 200) } });
  const order = await Order.findById(payment.order);
  if (order && order.paymentStatus === 'pending') {
    order.paymentStatus = 'failed';
    order.statusHistory.push({ status: 'payment_failed', note: reason?.slice(0, 200) });
    await order.save(); // keep reservation until expiry so the customer can retry
    notifyEmail('paymentFailed', order.email, { order }, { order: order._id });
  }
  return order;
}

export async function confirmCodOrder(order) {
  order.paymentStatus = 'cod_pending';
  pushStatus(order, 'confirmed', 'Cash on Delivery order placed');
  await order.save();
  await Payment.create({ order: order._id, provider: 'cod', amount: order.totals.total, status: 'pending' });
  await onConfirmed(order);
}

/** Release stock for unpaid online orders whose reservation has lapsed. */
export async function expireStaleOrders() {
  const stale = await Order.find({ status: 'pending_payment', paymentStatus: { $in: ['pending', 'failed'] }, reservationExpiresAt: { $lt: new Date() } }).limit(200);
  for (const o of stale) {
    // Reconcile with the gateway first — never expire an order that was actually paid.
    const pay = await Payment.findOne({ order: o._id, provider: { $ne: 'cod' } }).sort({ createdAt: -1 });
    const adapter = pay && getPaymentAdapter(pay.provider);
    if (adapter) {
      try {
        const r = await adapter.fetchOrderPayments(pay.providerOrderId);
        if (r.status === 'paid') { await markPaid(pay, { providerPaymentId: r.providerPaymentId, method: r.method, verifiedBy: 'reconcile', amount: r.amount }); continue; }
      } catch (e) { logger.warn({ err: e.message }, 'reconcile failed; will retry next run'); continue; }
    }
    const claimed = await Order.findOneAndUpdate({ _id: o._id, status: 'pending_payment', stockReserved: true }, { $set: { status: 'expired', stockReserved: false }, $push: { statusHistory: { status: 'expired', note: 'Payment not completed in time' } } });
    if (claimed) await releaseStock(o.items);
  }
  return stale.length;
}

export async function cancelOrder(order, { reason, by, byCustomer }) {
  const cancellable = ['pending_payment', 'confirmed', 'processing', 'payment_failed'];
  if (!cancellable.includes(order.status)) throw badRequest(byCustomer ? 'This order can no longer be cancelled online. Please contact support.' : `Orders in status "${order.status}" cannot be cancelled here.`);
  const shipment = await Shipment.findOne({ order: order._id, kind: 'forward' });
  if (shipment?.awb && byCustomer) throw badRequest('Your order is being packed for dispatch and can no longer be cancelled online.');
  if (shipment?.providerOrderId && shiprocket.isConfigured()) {
    try { await shiprocket.cancelOrders([shipment.providerOrderId]); shipment.status = 'cancelled'; await shipment.save(); } catch (e) { throw badRequest(`Could not cancel the Shiprocket shipment: ${e.message}`); }
  }
  const claimed = await Order.findOneAndUpdate({ _id: order._id, stockReserved: true }, { $set: { stockReserved: false } });
  if (claimed) await releaseStock(order.items);
  order.stockReserved = false;
  order.cancelReason = reason;
  if (order.paymentStatus === 'paid') order.paymentStatus = 'refund_pending';
  pushStatus(order, 'cancelled', reason, by);
  await order.save();
  notifyEmail('cancelled', order.email, { order }, { order: order._id });
  return order;
}

export async function issueRefund(order, { amount, reason, by, returnRequest, method = 'gateway' }) {
  const paid = await Payment.findOne({ order: order._id, status: { $in: ['paid', 'partially_refunded'] }, provider: { $ne: 'cod' } });
  const refunded = (await Refund.find({ order: order._id, status: { $ne: 'failed' } })).reduce((s, r) => s + r.amount, 0);
  const max = order.totals.total - refunded;
  if (amount <= 0 || amount > max) throw badRequest(`Refund amount must be between ₹1 and ₹${(max / 100).toFixed(2)}.`);
  const idempotencyKey = `rf_${order.orderNumber}_${refunded}_${amount}`;
  const existing = await Refund.findOne({ idempotencyKey });
  if (existing) return existing;
  const refund = await Refund.create({ order: order._id, payment: paid?._id, returnRequest, amount, reason, method: paid && method === 'gateway' ? 'gateway' : method === 'gateway' ? 'bank_transfer' : method, initiatedBy: by, idempotencyKey });
  if (refund.method === 'gateway') {
    const adapter = adapterByName(paid.provider);
    if (!adapter?.isConfigured()) throw unavailable('Payment gateway is not configured, cannot issue a gateway refund.');
    try {
      const r = await adapter.refund({ providerPaymentId: paid.providerPaymentId, providerOrderId: paid.providerOrderId, amount, idempotencyKey });
      refund.providerRefundId = r.providerRefundId; refund.status = r.status;
    } catch (e) { refund.status = 'failed'; await refund.save(); throw badRequest(e.message); }
  } else {
    refund.status = 'pending'; // manual (COD) refunds are marked processed by staff after transfer
  }
  await refund.save();
  const total = refunded + amount;
  order.paymentStatus = total >= order.totals.total ? (refund.status === 'processed' ? 'refunded' : 'refund_pending') : 'partially_refunded';
  order.statusHistory.push({ status: order.status, note: `Refund ₹${(amount / 100).toFixed(2)} ${refund.status}`, by });
  await order.save();
  if (paid) await Payment.updateOne({ _id: paid._id }, { $set: { status: total >= paid.amount ? 'refunded' : 'partially_refunded' } });
  notifyEmail('refund', order.email, { order, amount, status: refund.status === 'processed' ? 'processed' : 'initiated' }, { order: order._id });
  return refund;
}

export async function nextInvoiceNumber() {
  const S = (await import('../models/StoreSettings.js')).default;
  const s = await S.findOneAndUpdate({ key: 'store' }, { $inc: { 'tax.nextInvoiceNumber': 1 } }, { new: false, upsert: true });
  const n = s?.tax?.nextInvoiceNumber || 1;
  const prefix = s?.tax?.invoicePrefix || 'ESH';
  const fy = (() => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${String(y).slice(2)}${String(y + 1).slice(2)}`; })();
  return `${prefix}/${fy}/${String(n).padStart(5, '0')}`;
}
export { getSettings };
