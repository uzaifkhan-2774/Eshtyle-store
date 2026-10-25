import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { BACKEND_ROOT } from '../../config/paths.js';
import { PRIVATE_DIR } from '../../services/storage.js';
import { Router } from 'express';
import { z } from 'zod';
import { stringify } from 'csv-stringify/sync';
import { Order, Payment, Shipment, Refund, ReturnRequest, User, getSettings } from '../../models/index.js';
import { ah, badRequest, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requirePerm, can } from '../../middleware/auth.js';
import { audit } from '../../lib/audit.js';
import { escapeRegex, pageParams } from '../../lib/util.js';
import { cancelOrder, issueRefund, pushStatus, nextInvoiceNumber } from '../../services/orderService.js';
import { createForwardShipment, applyTrackingUpdate } from '../../services/shipmentService.js';
import * as shiprocket from '../../services/shipping/shiprocket.js';
import { notifyEmail } from '../../services/notify/index.js';
import { formatINR } from '../../lib/money.js';
import { releaseStock } from '../../services/inventory.js';
import { quoteManual, createManual } from '../../services/manualOrder.js';
import { revokeAllSessions } from '../../services/authService.js';
import { sendDeliveredEmail } from '../../services/loyalty.js';
import { addressSchema } from '../account.js';
import { Product, ProductVariant } from '../../models/index.js';

const r = Router();

// ---- Bulk actions on many orders at once
const idsSchema = z.array(z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id')).min(1).max(100);
r.post('/bulk', requirePerm('orders:write'), validate(z.object({ ids: idsSchema, action: z.enum(['processing', 'ship', 'cancel']), reason: z.string().trim().min(3).max(300).optional() })), ah(async (req, res) => {
  if (req.body.action === 'ship' && !can(req.user.role, 'shipping:write')) throw badRequest('You do not have permission to create shipments.');
  if (req.body.action === 'cancel' && !req.body.reason) throw badRequest('Give a reason for cancelling.');
  const orders = await Order.find({ _id: { $in: req.body.ids } }).sort({ placedAt: 1 });
  const results = [];
  for (const o of orders) {
    try {
      if (req.body.action === 'cancel') {
        await cancelOrder(o, { reason: req.body.reason, by: req.user._id });
      } else if (req.body.action === 'processing') {
        if (!(MANUAL_TRANSITIONS[o.status] || []).includes('processing')) throw new Error(`Cannot move from ${o.status.replace(/_/g, ' ')} to packing`);
        pushStatus(o, 'processing', 'Marked as packing (bulk)', req.user._id); await o.save();
      } else {
        if (await Shipment.exists({ order: o._id, kind: 'forward', awb: { $exists: true, $ne: null } })) throw new Error('Already has a shipment');
        if (!o.invoiceNumber) { o.invoiceNumber = await nextInvoiceNumber(); await o.save(); }
        await createForwardShipment(o, { by: req.user._id });
      }
      results.push({ id: o._id, orderNumber: o.orderNumber, ok: true });
    } catch (e) { results.push({ id: o._id, orderNumber: o.orderNumber, ok: false, error: e.message }); }
  }
  await audit(req, `order.bulk_${req.body.action}`, 'Order', null, { count: orders.length, ok: results.filter((x) => x.ok).length });
  res.json({ results });
}));
r.get('/invoices', requirePerm('orders:read'), ah(async (req, res) => {
  const ids = idsSchema.parse(String(req.query.ids || '').split(',').filter(Boolean));
  const orders = (await Order.find({ _id: { $in: ids } }).sort({ placedAt: 1 })).filter((o) => INVOICE_STATUSES.includes(o.status));
  if (!orders.length) throw badRequest('None of the selected orders is confirmed yet, so there is nothing to invoice.');
  for (const o of orders) if (!o.invoiceNumber) { o.invoiceNumber = await nextInvoiceNumber(); await o.save(); }
  const s = await getSettings();
  sendInvoices(res, `${orders.length} invoices`, orders.map((o) => invoiceBody(o, s)));
}));

// ---- Manual orders (WhatsApp / Instagram / phone / in-store)
r.get('/manual/products', requirePerm('orders:write'), ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const f = { status: 'published' };
  if (q) f.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { sku: { $regex: escapeRegex(q), $options: 'i' } }];
  const products = await Product.find(f).sort({ name: 1 }).limit(20).select('name sku images').lean();
  const variants = await ProductVariant.find({ product: { $in: products.map((p) => p._id) }, isActive: true }).select('product sku title price stock').lean();
  res.json({ items: products.flatMap((p) => variants.filter((v) => String(v.product) === String(p._id)).map((v) => ({
    variantId: v._id, sku: v.sku, name: p.name, variantTitle: v.title, price: v.price, stock: v.stock, image: p.images?.[0]?.thumb || p.images?.[0]?.url,
  }))) });
}));
const manualSchema = z.object({
  customer: z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'), email: z.string().trim().email().max(160).optional().or(z.literal('')).transform((v) => v || undefined) }),
  address: addressSchema,
  items: z.array(z.object({ variantId: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid product'), quantity: z.number().int().min(1).max(50) })).min(1).max(30),
  channel: z.enum(['whatsapp', 'instagram', 'phone', 'store', 'other']),
  payment: z.enum(['cod', 'paid']),
  paidVia: z.enum(['upi', 'bank_transfer', 'cash', 'card', 'other']).optional(),
  paymentRef: z.string().trim().max(60).optional(),
  couponCode: z.string().trim().max(24).optional().or(z.literal('')),
  freeShipping: z.boolean().optional(), waiveCodFee: z.boolean().optional(), ignoreServiceability: z.boolean().optional(),
  note: z.string().trim().max(300).optional(),
});
const manualQuoteSchema = z.object({
  items: manualSchema.shape.items, payment: z.enum(['cod', 'paid']).default('cod'),
  address: z.object({ pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode') }),
  customer: z.object({ phone: z.string().max(15).optional(), email: z.string().max(160).optional() }).optional(),
  couponCode: z.string().trim().max(24).optional().or(z.literal('')), freeShipping: z.boolean().optional(), waiveCodFee: z.boolean().optional(),
});
r.post('/manual/quote', requirePerm('orders:write'), validate(manualQuoteSchema), ah(async (req, res) => {
  const c = req.body.customer || {};
  const b = { ...req.body, customer: { phone: /^[6-9]\d{9}$/.test(c.phone || '') ? c.phone : '__none__', email: c.email || undefined } };
  const { priced, quote, user } = await quoteManual(b);
  res.json({ totals: priced.totals, coupon: priced.coupon, couponError: priced.couponError, cod: priced.cod, serviceability: quote, existingCustomer: user ? { name: user.name, email: user.email } : null });
}));
r.post('/manual', requirePerm('orders:write'), validate(manualSchema), ah(async (req, res) => {
  const order = await createManual(req.body, req.user);
  await audit(req, 'order.manual_create', 'Order', order._id, { channel: req.body.channel, payment: req.body.payment, total: order.totals.total });
  res.status(201).json({ order: { _id: order._id, orderNumber: order.orderNumber } });
}));

function orderFilter(q) {
  const f = { orderNumber: { $exists: true } }; // ignore records that are not E-SHTYLE orders (e.g. a shared database)
  if (q.ids) f._id = { $in: String(q.ids).split(',').filter((x) => mongoose.isValidObjectId(x)).slice(0, 500) };
  if (q.channel) f.channel = String(q.channel);
  if (q.status) f.status = { $in: String(q.status).split(',') };
  if (q.paymentStatus) f.paymentStatus = { $in: String(q.paymentStatus).split(',') };
  if (q.shippingStatus) f.shippingStatus = { $in: String(q.shippingStatus).split(',') };
  if (q.paymentMethod) f.paymentMethod = q.paymentMethod;
  if (q.from || q.to) f.placedAt = { ...(q.from ? { $gte: new Date(q.from) } : {}), ...(q.to ? { $lte: new Date(new Date(q.to).getTime() + 86399999) } : {}) };
  if (q.q) { const rx = new RegExp(escapeRegex(String(q.q).trim().slice(0, 60)), 'i'); f.$or = [{ orderNumber: rx }, { email: rx }, { phone: rx }, { 'shippingAddress.fullName': rx }, { 'shippingAddress.pincode': rx }]; }
  return f;
}
r.get('/', requirePerm('orders:read'), ah(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query, 100);
  const f = orderFilter(req.query);
  const [items, total] = await Promise.all([Order.find(f).sort({ placedAt: -1 }).skip(skip).limit(limit).select('orderNumber placedAt status channel paymentStatus paymentMethod shippingStatus totals shippingAddress.fullName shippingAddress.city items.quantity').lean(), Order.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));
r.get('/export/csv', requirePerm('reports:read'), ah(async (req, res) => {
  const items = await Order.find(orderFilter(req.query)).sort({ placedAt: -1 }).limit(20000).lean();
  const rows = items.map((o) => [o.orderNumber, o.placedAt.toISOString(), o.status, o.paymentMethod, o.paymentStatus, o.shippingStatus, o.shippingAddress?.fullName, o.shippingAddress?.city, o.shippingAddress?.state, o.shippingAddress?.pincode, o.items.reduce((s, i) => s + i.quantity, 0), o.totals.subtotal / 100, o.totals.discount / 100, o.totals.shipping / 100, o.totals.codFee / 100, o.totals.tax / 100, o.totals.total / 100, o.coupon?.code || '', o.attribution?.utmSource || '', o.attribution?.utmCampaign || '', o.invoiceNumber || '']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="eshtyle-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(stringify([['order_number', 'placed_at', 'status', 'payment_method', 'payment_status', 'shipping_status', 'customer', 'city', 'state', 'pincode', 'units', 'subtotal', 'discount', 'shipping', 'cod_fee', 'gst', 'total', 'coupon', 'utm_source', 'utm_campaign', 'invoice'], ...rows]));
}));
r.get('/:id', requirePerm('orders:read'), ah(async (req, res) => {
  const o = await Order.findById(req.params.id).lean();
  if (!o) throw notFound();
  const [payments, shipments, refunds, returns, customer] = await Promise.all([
    can(req.user.role, 'refunds:write') || can(req.user.role, 'orders:write') ? Payment.find({ order: o._id }).sort({ createdAt: -1 }).lean() : [],
    Shipment.find({ order: o._id }).lean(), Refund.find({ order: o._id }).lean(), ReturnRequest.find({ order: o._id }).lean(),
    o.user ? User.findById(o.user).select('name email phone createdAt').lean() : null,
  ]);
  res.json({ order: o, payments, shipments, refunds, returns, customer, shiprocketConfigured: shiprocket.isConfigured() });
}));

const MANUAL_TRANSITIONS = { confirmed: ['processing'], processing: ['confirmed'], ready_to_ship: ['processing'], shipped: [], out_for_delivery: [] };
r.post('/:id/status', requirePerm('orders:write'), validate(z.object({ status: z.enum(['processing', 'confirmed', 'shipped', 'delivered']), note: z.string().max(300).optional(), manualOverride: z.boolean().optional() })), ah(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound();
  const allowed = MANUAL_TRANSITIONS[o.status] || [];
  const shipment = await Shipment.findOne({ order: o._id, kind: 'forward' });
  // Shipped/delivered may only be set manually when NOT using Shiprocket for this order (e.g. self-delivery), and only by owner/manager.
  if (['shipped', 'delivered'].includes(req.body.status)) {
    if (shipment?.awb) throw badRequest('This order is tracked by Shiprocket; its status updates automatically from courier events.');
    if (!req.body.manualOverride || !can(req.user.role, 'refunds:write')) throw badRequest('Manual shipped/delivered requires a manager and the manual override flag.');
    if (o.paymentMethod === 'online' && o.paymentStatus !== 'paid') throw badRequest('Payment not verified.');
  } else if (!allowed.includes(req.body.status)) throw badRequest(`Cannot move from ${o.status} to ${req.body.status}.`);
  pushStatus(o, req.body.status, req.body.note || 'Updated by staff', req.user._id);
  if (req.body.status === 'shipped') { o.shippingStatus = 'in_transit'; notifyEmail('shipped', o.email, { order: o, shipment: null }, { order: o._id }); }
  if (req.body.status === 'delivered') { o.shippingStatus = 'delivered'; if (o.paymentMethod === 'cod') o.paymentStatus = 'cod_collected'; await sendDeliveredEmail(o); }
  await o.save();
  await audit(req, 'order.status', 'Order', o._id, { to: req.body.status, note: req.body.note });
  res.json({ order: o });
}));
r.post('/:id/notes', requirePerm('orders:notes'), validate(z.object({ note: z.string().trim().min(1).max(500) })), ah(async (req, res) => {
  const o = await Order.findById(req.params.id); if (!o) throw notFound();
  o.statusHistory.push({ status: o.status, note: `[admin note] ${req.body.note}`, by: req.user._id }); await o.save();
  res.json({ order: o });
}));
// Suspend the customer behind a fraud order: they can no longer sign in or place orders.
async function blockCustomer(req, o) {
  if (!o.user || !can(req.user.role, 'customers:write')) return false;
  const u = await User.findById(o.user); if (!u || u.role !== 'customer' || u.status === 'suspended') return false;
  u.status = 'suspended'; await u.save(); await revokeAllSessions(u._id);
  await audit(req, 'customer.suspend', 'User', u._id, { reason: `Fraud order ${o.orderNumber}` });
  return true;
}
const cancelSchema = z.object({ reason: z.string().trim().min(3).max(300), force: z.boolean().optional(), blockCustomer: z.boolean().optional() });
r.post('/:id/cancel', requirePerm('orders:write'), validate(cancelSchema), ah(async (req, res) => {
  const o = await Order.findById(req.params.id); if (!o) throw notFound();
  await cancelOrder(o, { reason: req.body.reason, by: req.user._id, force: req.body.force });
  const blocked = req.body.blockCustomer ? await blockCustomer(req, o) : false;
  await audit(req, 'order.cancel', 'Order', o._id, { reason: req.body.reason, blocked });
  res.json({ order: o, blocked });
}));
r.post('/:id/refund', requirePerm('refunds:write'), validate(z.object({ amount: z.number().int().min(100), reason: z.string().trim().min(3).max(300), method: z.enum(['gateway', 'bank_transfer', 'upi', 'store_credit']).default('gateway'), returnRequestId: z.string().optional() })), ah(async (req, res) => {
  const o = await Order.findById(req.params.id); if (!o) throw notFound();
  if (!['paid', 'partially_refunded', 'refund_pending', 'cod_collected'].includes(o.paymentStatus)) throw badRequest('There is no captured payment to refund on this order.');
  const refund = await issueRefund(o, { amount: req.body.amount, reason: req.body.reason, by: req.user._id, method: req.body.method, returnRequest: req.body.returnRequestId });
  await audit(req, 'order.refund', 'Order', o._id, { amount: req.body.amount, method: refund.method, status: refund.status });
  res.json({ refund, order: o });
}));
r.post('/refunds/:refundId/mark-processed', requirePerm('refunds:write'), validate(z.object({ reference: z.string().trim().min(3).max(80) })), ah(async (req, res) => {
  const rf = await Refund.findById(req.params.refundId); if (!rf) throw notFound();
  if (rf.method === 'gateway') throw badRequest('Gateway refunds are updated automatically.');
  rf.status = 'processed'; rf.providerRefundId = req.body.reference; await rf.save();
  const o = await Order.findById(rf.order);
  const total = (await Refund.find({ order: o._id, status: 'processed' })).reduce((s, x) => s + x.amount, 0);
  if (total >= o.totals.total) o.paymentStatus = 'refunded'; await o.save();
  notifyEmail('refund', o.email, { order: o, amount: rf.amount, status: 'processed' }, { order: o._id });
  await audit(req, 'refund.processed', 'Refund', rf._id, { reference: req.body.reference });
  res.json({ refund: rf });
}));

// Shipping (Shiprocket)
r.get('/:id/couriers', requirePerm('shipping:write'), ah(async (req, res) => {
  const o = await Order.findById(req.params.id).lean(); if (!o) throw notFound();
  if (!shiprocket.isConfigured()) return res.json({ configured: false, couriers: [] });
  const q = await shiprocket.serviceability({ pincode: o.shippingAddress.pincode, cod: o.paymentMethod === 'cod', weightKg: 0.2 });
  res.json({ configured: true, ...q });
}));
r.post('/:id/ship', requirePerm('shipping:write'), validate(z.object({ courierId: z.number().int().optional(), dims: z.object({ lengthCm: z.number(), breadthCm: z.number(), heightCm: z.number(), weightKg: z.number() }).partial().optional() })), ah(async (req, res) => {
  const o = await Order.findById(req.params.id); if (!o) throw notFound();
  if (!o.invoiceNumber) { o.invoiceNumber = await nextInvoiceNumber(); await o.save(); }
  const s = await createForwardShipment(o, { courierId: req.body.courierId, dims: req.body.dims, by: req.user._id });
  await audit(req, 'shipment.create', 'Order', o._id, { awb: s.awb, courier: s.courierName });
  res.json({ shipment: s });
}));
r.post('/:id/track-refresh', requirePerm('orders:read'), ah(async (req, res) => {
  const s = await Shipment.findOne({ order: req.params.id, kind: 'forward' });
  if (!s?.awb) throw badRequest('No AWB on this order yet.');
  const t = await shiprocket.trackAwb(s.awb);
  if (t.status) await applyTrackingUpdate(s, { statusLabel: t.status, events: t.events, source: 'manual' });
  res.json({ shipment: await Shipment.findById(s._id) });
}));
r.post('/:id/rto-received', requirePerm('orders:write'), ah(async (req, res) => {
  const o = await Order.findById(req.params.id); if (!o) throw notFound();
  if (o.status !== 'rto') throw badRequest('Order is not in RTO.');
  if (o.stockReserved) { await releaseStock(o.items); o.stockReserved = false; }
  pushStatus(o, 'returned', 'RTO received at warehouse — stock restored', req.user._id);
  if (o.paymentStatus === 'paid') o.paymentStatus = 'refund_pending';
  await o.save();
  await audit(req, 'order.rto_received', 'Order', o._id);
  res.json({ order: o });
}));

// Printable GST invoice (HTML; staff print to PDF from the browser).
const INVOICE_STATUSES = ['confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'returned', 'return_requested'];
const INVOICE_STYLE = 'body{font:13px/1.45 Arial,sans-serif;color:#241D19;max-width:820px;margin:24px auto;padding:0 16px}h1{font:600 22px Georgia,serif;color:#442B22;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #E9DCCB;padding:6px;text-align:left;vertical-align:top}th{background:#FFF8EE}.r{text-align:right}.grid{display:flex;justify-content:space-between;gap:24px;margin-top:16px}.muted{color:#7a6a5e}@media print{button{display:none}}.page{page-break-after:always}.page:last-child{page-break-after:auto}';
// Brand logo embedded in the invoice (data URI, so it prints even when saved as PDF / opened offline).
let LOGO = '';
try { LOGO = `data:image/png;base64,${fs.readFileSync(path.join(BACKEND_ROOT, 'assets', 'invoice-logo.png')).toString('base64')}`; } catch { /* invoice still works without it */ }
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function invoiceBody(o, s) {
  const b = s.business; const a = o.shippingAddress;
  const intra = b.address?.state && a.state && b.address.state.toLowerCase() === a.state.toLowerCase();
  const rows = o.items.map((i, n) => { const taxable = o.totals.taxInclusive ? i.lineTotal - i.taxAmount : i.lineTotal; return `<tr><td>${n + 1}</td><td>${esc(i.name)}${i.variantTitle !== 'Default' ? ` (${esc(i.variantTitle)})` : ''}<br><small>${esc(i.sku)}</small>${i.designs?.length ? `<br><strong>Chosen: ${i.designs.map((d) => esc(d.label)).join(', ')}</strong>` : ''}</td><td>${esc(i.hsnCode)}</td><td>${i.quantity}</td><td>${formatINR(i.unitPrice)}</td><td>${formatINR(i.lineDiscount)}</td><td>${formatINR(taxable)}</td><td>${intra ? `CGST ${i.taxRate / 2}% ${formatINR(Math.floor(i.taxAmount / 2))}<br>SGST ${i.taxRate / 2}% ${formatINR(Math.ceil(i.taxAmount / 2))}` : `IGST ${i.taxRate}% ${formatINR(i.taxAmount)}`}</td><td>${formatINR(i.lineTotal + (o.totals.taxInclusive ? 0 : i.taxAmount))}</td></tr>`; }).join('');
  return `<div class="page"><div class="grid"><div>${LOGO ? `<img src="${LOGO}" alt="${esc(b.name || 'E-SHTYLE')}" style="height:56px;width:auto;display:block;margin-bottom:10px">` : ''}<h1>Tax Invoice</h1><div class="muted">Invoice ${esc(o.invoiceNumber)} · ${new Date().toLocaleDateString('en-IN')}<br>Order ${esc(o.orderNumber)} · ${o.placedAt.toLocaleDateString('en-IN')}</div></div>
<div class="r"><strong>${esc(b.legalName || b.name)}</strong><br>${esc(b.address?.line1)} ${esc(b.address?.line2)}<br>${esc(b.address?.city)} ${esc(b.address?.state)} ${esc(b.address?.pincode)}<br>${b.phone ? 'Phone: ' + esc(b.phone) + '<br>' : ''}${b.email ? esc(b.email) + '<br>' : ''}${b.gstin ? 'GSTIN: ' + esc(b.gstin) : '<span style="color:#b00">GSTIN not set in Settings</span>'}</div></div>
<div class="grid"><div><strong>Bill / Ship to</strong><br>${esc(a.fullName)}<br>${esc(a.line1)} ${esc(a.line2)}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}<br>${esc(a.phone)}</div><div class="r">Place of supply: ${esc(a.state)}<br>Payment: ${o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Prepaid'}</div></div>
<table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Taxable</th><th>GST</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table style="width:auto;margin-left:auto"><tr><td>Subtotal</td><td class="r">${formatINR(o.totals.subtotal)}</td></tr>${o.totals.discount ? `<tr><td>Discount</td><td class="r">−${formatINR(o.totals.discount)}</td></tr>` : ''}<tr><td>Shipping</td><td class="r">${formatINR(o.totals.shipping)}</td></tr>${o.totals.codFee ? `<tr><td>COD fee</td><td class="r">${formatINR(o.totals.codFee)}</td></tr>` : ''}<tr><td>Total GST${o.totals.taxInclusive ? ' (included)' : ''}</td><td class="r">${formatINR(o.totals.tax)}</td></tr><tr><th>Grand total</th><th class="r">${formatINR(o.totals.total)}</th></tr></table>
<p class="muted">Shipping and COD charges shown are as charged; confirm their GST treatment with your accountant. This is a computer-generated invoice.</p><p style="text-align:center;color:#C6A15B;font:italic 15px Georgia,serif;margin-top:18px">Thank you for shopping with ${esc(b.name || 'E-SHTYLE')}</p></div>`;
}
function sendInvoices(res, title, bodies) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:");
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${INVOICE_STYLE}</style></head><body>
<button onclick="print()">Print / Save as PDF</button>
${bodies.join('\n')}</body></html>`);
}
r.get('/:id/invoice', requirePerm('orders:read'), ah(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound();
  if (!INVOICE_STATUSES.includes(o.status)) throw badRequest('Invoices are generated for confirmed orders only.');
  if (!o.invoiceNumber) { o.invoiceNumber = await nextInvoiceNumber(); await o.save(); }
  sendInvoices(res, `Invoice ${o.invoiceNumber}`, [invoiceBody(o, await getSettings())]);
}));

// Returns
r.get('/returns/list', requirePerm('returns:write'), ah(async (req, res) => {
  const f = req.query.status ? { status: req.query.status } : {};
  const items = await ReturnRequest.find(f).sort({ createdAt: -1 }).limit(200).populate('order', 'orderNumber totals items shippingAddress.fullName').lean();
  res.json({ items });
}));
// Stream the customer's unboxing video to staff only (it lives outside the public uploads folder).
r.get('/returns/:rid/video', requirePerm('returns:write'), ah(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rid)) throw notFound();
  const rr = await ReturnRequest.findById(req.params.rid).lean();
  if (!rr?.video?.key || !/^returns\/[a-f0-9]{20}\.(mp4|webm)$/.test(rr.video.key)) throw notFound('No video on this request.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(path.join(PRIVATE_DIR, rr.video.key), { dotfiles: 'deny' });
}));
r.post('/returns/:rid', requirePerm('returns:write'), validate(z.object({ status: z.enum(['approved', 'rejected', 'pickup_scheduled', 'received', 'closed']), adminNote: z.string().max(500).optional(), restock: z.boolean().optional(), createPickup: z.boolean().optional() })), ah(async (req, res) => {
  const rr = await ReturnRequest.findById(req.params.rid); if (!rr) throw notFound();
  if (req.body.status === 'approved' || req.body.createPickup) {
    const settings = await getSettings();
    if (settings.returns.requireVideo !== false && !rr.video?.key) throw badRequest('This request has no unboxing video, so it cannot be approved.');
    rr.videoReviewedBy = req.user._id;
  }
  const o = await Order.findById(rr.order);
  if (req.body.createPickup) {
    if (!shiprocket.isConfigured()) throw badRequest('Shiprocket is not configured, schedule the pickup manually.');
    const items = rr.items.map((x) => { const oi = o.items.id(x.orderItem); return { ...oi.toObject(), quantity: x.quantity }; });
    const rp = await shiprocket.createReturn(o, items, (await getSettings()).business);
    await Shipment.create({ order: o._id, kind: 'return', providerOrderId: rp.providerOrderId, providerShipmentId: rp.providerShipmentId, status: 'return_created' });
    rr.status = 'pickup_scheduled';
  } else rr.status = req.body.status;
  if (req.body.adminNote) rr.adminNote = req.body.adminNote;
  if (rr.status === 'received' && req.body.restock) {
    const toRelease = rr.items.map((x) => { const oi = o.items.id(x.orderItem); return { product: oi.product, variant: oi.variant, quantity: x.quantity }; });
    await releaseStock(toRelease);
  }
  if (rr.status === 'received') { pushStatus(o, 'returned', 'Return received', req.user._id); await o.save(); }
  if (rr.status === 'rejected' && o.status === 'return_requested') { pushStatus(o, 'delivered', 'Return request rejected', req.user._id); await o.save(); }
  await rr.save();
  notifyEmail('returnStatus', o.email, { order: o, status: rr.status, note: rr.adminNote }, { order: o._id });
  await audit(req, 'return.update', 'ReturnRequest', rr._id, req.body);
  res.json({ returnRequest: rr });
}));
export default r;
