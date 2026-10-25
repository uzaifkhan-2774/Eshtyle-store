/** Orders entered by staff for customers who ordered on WhatsApp, Instagram, phone or in person.
 *  Uses the same pricing, GST, stock reservation and notifications as website checkout. */
import { Order, Payment, Product, ProductVariant, User, getSettings } from '../models/index.js';
import { priceLines } from './pricing.js';
import { quotePincode } from './shippingQuote.js';
import { reserveStock, releaseStock } from './inventory.js';
import { newOrderNumber, buildOrderItems, confirmCodOrder, onConfirmed, pushStatus } from './orderService.js';
import { badRequest } from '../lib/errors.js';

async function linesFor(items) {
  const variants = await ProductVariant.find({ _id: { $in: items.map((i) => i.variantId) } }).lean();
  const products = await Product.find({ _id: { $in: variants.map((v) => v.product) } }).lean();
  const vm = new Map(variants.map((v) => [String(v._id), v])); const pm = new Map(products.map((p) => [String(p._id), p]));
  const merged = new Map();
  for (const i of items) merged.set(i.variantId, (merged.get(i.variantId) || 0) + i.quantity);
  const lines = [];
  for (const [variantId, quantity] of merged) {
    const v = vm.get(variantId); const p = v && pm.get(String(v.product));
    if (!v || !p || !v.isActive || p.status === 'archived') throw badRequest('One of the selected products is no longer available.');
    if (v.stock < quantity) throw badRequest(`Only ${v.stock} left of ${p.name}${v.title !== 'Default' ? ` (${v.title})` : ''}.`);
    lines.push({ product: p, variant: v, quantity });
  }
  if (!lines.length) throw badRequest('Add at least one product.');
  return lines;
}

async function findCustomer(c) {
  const or = [{ phone: c.phone }]; if (c.email) or.push({ email: c.email.toLowerCase() });
  return User.findOne({ $or: or, status: 'active' });
}

export async function quoteManual(b) {
  const settings = await getSettings();
  const lines = await linesFor(b.items);
  const user = await findCustomer(b.customer);
  const quote = await quotePincode(b.address.pincode, settings);
  const paymentMethod = b.payment === 'cod' ? 'cod' : 'online';
  const priced = await priceLines(lines, { settings, couponCode: b.couponCode || undefined, paymentMethod, user, pincodeQuote: quote });
  if (b.freeShipping) priced.totals.shipping = 0;
  if (b.waiveCodFee) priced.totals.codFee = 0;
  const t = priced.totals;
  t.total = t.subtotal - t.discount + t.shipping + t.codFee + (t.taxInclusive ? 0 : t.tax);
  return { priced, quote, user, settings, paymentMethod };
}

export async function createManual(b, staff) {
  const { priced, quote, user, paymentMethod } = await quoteManual(b);
  if (!quote.serviceable && !b.ignoreServiceability) throw badRequest(quote.reason || 'This pincode is not serviceable by the courier.');
  if (priced.couponError) throw badRequest(priced.couponError);
  const a = b.address;
  const shippingAddress = { fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pincode: a.pincode, country: 'India' };
  const items = buildOrderItems(priced);
  await reserveStock(items);
  const label = { whatsapp: 'WhatsApp', instagram: 'Instagram', phone: 'Phone', store: 'In store', other: 'Other' }[b.channel];
  let order;
  try {
    order = await Order.create({
      orderNumber: newOrderNumber(), user: user?._id, email: b.customer.email?.toLowerCase() || user?.email, phone: b.customer.phone,
      items, shippingAddress, billingAddress: shippingAddress, totals: priced.totals, coupon: priced.coupon || undefined,
      paymentMethod, paymentProvider: paymentMethod === 'online' ? 'manual' : undefined, status: 'pending_payment', paymentStatus: 'pending',
      statusHistory: [], stockReserved: true, notes: b.note, channel: b.channel, createdBy: staff._id,
      attribution: { utmSource: b.channel, utmMedium: 'manual-order' },
    });
  } catch (e) { await releaseStock(items); throw e; }
  order.statusHistory.push({ status: 'created', note: `Order entered by staff (${label})`, by: staff._id });
  if (paymentMethod === 'cod') { await confirmCodOrder(order); return order; }
  // Already paid outside the website (UPI / bank transfer / cash in store).
  order.paymentStatus = 'paid';
  pushStatus(order, 'confirmed', `Payment received via ${b.paidVia || 'UPI'}${b.paymentRef ? ` (ref ${b.paymentRef})` : ''}`, staff._id);
  await order.save();
  await Payment.create({ order: order._id, provider: 'manual', amount: order.totals.total, status: 'paid', method: b.paidVia || 'upi', providerPaymentId: b.paymentRef || undefined });
  await onConfirmed(order);
  return order;
}
