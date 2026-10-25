import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, teardownDb, client, seedProduct, makeUser, login, address } from './helpers.js';
import { Order, Payment, ProductVariant, Cart, User, StoreSettings, Coupon, getSettings } from '../src/models/index.js';
import { sentInTest } from '../src/services/notify/email.js';
import { sendAbandonedCartReminders, sendLowStockDigest, unsubscribeUrl } from '../src/services/reminders.js';

beforeAll(() => setupDb('esh_test_admin_tools'));
afterAll(teardownDb);

let owner, ring, earring;
const manual = (over = {}) => ({
  customer: { name: 'Riya Shah', phone: '9123456780', email: 'riya@example.com' }, address: { ...address, fullName: 'Riya Shah', phone: '9123456780' },
  items: [{ variantId: String(ring.variant._id), quantity: 2 }], channel: 'whatsapp', payment: 'cod', ...over,
});

describe('admin tools', () => {
  beforeAll(async () => {
    ring = await seedProduct({ stock: 5, price: 34900, sku: 'MAN-1', name: 'Manual Ring' });
    earring = await seedProduct({ stock: 2, price: 27900, sku: 'MAN-2', name: 'Manual Earrings' });
    await makeUser({ email: 'owner@example.com', role: 'owner' });
    owner = client(); await login(owner, 'owner@example.com');
    const s = await getSettings(); s.business.address = { line1: 'x', city: 'Warud', state: 'Maharashtra', pincode: '444906' }; await s.save();
  });

  it('creates a COD manual order with real prices, GST and stock reservation', async () => {
    const q = await owner.post('/api/v1/admin/orders/manual/quote', { items: manual().items, payment: 'cod', address: { pincode: address.pincode } });
    expect(q.status).toBe(200);
    expect(q.body.totals.subtotal).toBe(69800);
    const r = await owner.post('/api/v1/admin/orders/manual', manual({ note: 'gift wrap' }));
    expect(r.status).toBe(201);
    const o = await Order.findById(r.body.order._id).lean();
    expect(o).toMatchObject({ channel: 'whatsapp', paymentMethod: 'cod', paymentStatus: 'cod_pending', status: 'confirmed', notes: 'gift wrap' });
    expect(o.totals.total).toBe(q.body.totals.total);
    expect((await ProductVariant.findById(ring.variant._id)).stock).toBe(3);
    expect(sentInTest.some((m) => m.to === 'riya@example.com' && /order/i.test(m.subject))).toBe(true);
  });

  it('records an already-paid order, links an existing customer, and refuses more than the stock', async () => {
    const cust = await makeUser({ email: 'meera@example.com' });
    const r = await owner.post('/api/v1/admin/orders/manual', manual({ customer: { name: 'Meera', phone: cust.phone }, address: { ...address, phone: cust.phone }, payment: 'paid', paidVia: 'upi', paymentRef: 'UTR123', items: [{ variantId: String(earring.variant._id), quantity: 1 }], channel: 'instagram', freeShipping: true }));
    expect(r.status).toBe(201);
    const o = await Order.findById(r.body.order._id).lean();
    expect(String(o.user)).toBe(String(cust._id));
    expect(o).toMatchObject({ paymentStatus: 'paid', status: 'confirmed', channel: 'instagram' });
    expect(o.totals.shipping).toBe(0);
    expect(await Payment.exists({ order: o._id, provider: 'manual', status: 'paid', providerPaymentId: 'UTR123' })).toBeTruthy();
    const tooMany = await owner.post('/api/v1/admin/orders/manual', manual({ items: [{ variantId: String(earring.variant._id), quantity: 5 }] }));
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.message).toMatch(/Only 1 left/);
  });

  it('lets only staff with order permissions create manual orders', async () => {
    await makeUser({ email: 'sup@example.com', role: 'support' });
    const sup = client(); await login(sup, 'sup@example.com');
    expect((await sup.post('/api/v1/admin/orders/manual', manual())).status).toBe(403);
  });

  it('bulk-marks orders as packing, skips ones that cannot move, and prints invoices together', async () => {
    const [a, b] = await Order.find({ channel: { $in: ['whatsapp', 'instagram'] } }).lean();
    const cancelled = await Order.create({ orderNumber: 'ESHTESTCANCEL', items: [], totals: { total: 0 }, paymentMethod: 'cod', status: 'cancelled', shippingAddress: address });
    const r = await owner.post('/api/v1/admin/orders/bulk', { ids: [String(a._id), String(b._id), String(cancelled._id)], action: 'processing' });
    expect(r.status).toBe(200);
    expect(r.body.results.filter((x) => x.ok)).toHaveLength(2);
    expect(r.body.results.find((x) => !x.ok).orderNumber).toBe('ESHTESTCANCEL');
    expect((await Order.findById(a._id)).status).toBe('processing');
    const inv = await owner.get(`/api/v1/admin/orders/invoices?ids=${a._id},${b._id}`);
    expect(inv.status).toBe(200);
    expect(inv.text).toContain(a.orderNumber); expect(inv.text).toContain(b.orderNumber);
    expect((inv.text.match(/Tax Invoice/g) || []).length).toBe(2);
  });

  it('builds the sales & GST register with CGST/SGST for home-state orders and a CSV', async () => {
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    const r = await owner.get(`/api/v1/admin/reports/sales?from=${today}&to=${today}`);
    expect(r.status).toBe(200);
    expect(r.body.summary.orders).toBe(2); // cancelled excluded
    const orders = await Order.find({ status: { $ne: 'cancelled' } }).lean();
    expect(r.body.summary.total).toBe(orders.reduce((s, o) => s + o.totals.total, 0));
    expect(r.body.summary.igst).toBe(0); // Maharashtra → Maharashtra
    expect(r.body.summary.cgst + r.body.summary.sgst).toBe(r.body.summary.tax);
    const csv = await owner.get(`/api/v1/admin/reports/sales.csv?from=${today}&to=${today}`);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toMatch(/Invoice no\.,Order date/);
    expect((await owner.get('/api/v1/admin/reports/sales?from=2026-12-01&to=2026-01-01')).status).toBe(400);
  });

  it('sends one abandoned-bag reminder only to opted-in customers and honours unsubscribe', async () => {
    const yes = await makeUser({ email: 'yes@example.com' }); await User.updateOne({ _id: yes._id }, { $set: { 'marketingConsent.email': true } });
    const no = await makeUser({ email: 'no@example.com' });
    const old = new Date(Date.now() - 5 * 3600e3);
    for (const u of [yes, no]) {
      const c = await Cart.create({ user: u._id, items: [{ product: ring.product._id, variant: ring.variant._id, quantity: 1 }] });
      await Cart.collection.updateOne({ _id: c._id }, { $set: { updatedAt: old } });
    }
    const before = sentInTest.length;
    expect(await sendAbandonedCartReminders()).toBe(1);
    const mail = sentInTest.slice(before).find((m) => m.subject.includes('left something'));
    expect(mail.to).toBe('yes@example.com');
    expect(mail.html).toContain('Manual Ring');
    expect(await sendAbandonedCartReminders()).toBe(0); // not twice
    const url = new URL(unsubscribeUrl(yes._id));
    const bad = await client().get(`${url.pathname}?u=${yes._id}&t=forged`);
    expect(bad.status).toBe(400);
    const ok = await client().get(url.pathname + url.search);
    expect(ok.status).toBe(200);
    expect((await User.findById(yes._id)).marketingConsent.email).toBe(false);
  });

  it('emails a daily low-stock digest to the owner, without repeating it', async () => {
    await StoreSettings.updateOne({ key: 'store' }, { $unset: { alerts: 1 } });
    const before = sentInTest.length;
    expect(await sendLowStockDigest()).toBeGreaterThan(0); // Manual Earrings: 1 left
    const mail = sentInTest.slice(before).find((m) => m.to === 'alerts@example.com');
    expect(mail.subject).toMatch(/Stock alert/); expect(mail.html).toContain('MAN-2');
    expect(await sendLowStockDigest()).toBeNull();
  });

  it('emails a personal one-time thank-you coupon when an order is delivered', async () => {
    const buyer = await makeUser({ email: 'thanks@example.com' });
    const r = await owner.post('/api/v1/admin/orders/manual', manual({ customer: { name: 'Tara', phone: buyer.phone, email: 'thanks@example.com' }, address: { ...address, phone: buyer.phone }, items: [{ variantId: String(ring.variant._id), quantity: 1 }] }));
    const id = r.body.order._id;
    const before = sentInTest.length;
    // Delivered twice (e.g. duplicate courier event) → still exactly one coupon.
    expect((await owner.post(`/api/v1/admin/orders/${id}/status`, { status: 'delivered', manualOverride: true })).status).toBe(200);
    await new Promise((res) => setTimeout(res, 300));
    const o = await Order.findById(id).lean();
    expect(o.thankYouCoupon).toMatch(/^THANKS[A-Z2-9]{6}$/);
    expect(await Coupon.countDocuments({ campaign: 'thank-you', 'assignedTo.email': 'thanks@example.com' })).toBe(1);
    const mail = sentInTest.slice(before).find((m) => m.to === 'thanks@example.com' && /Delivered/.test(m.subject));
    expect(mail.html).toContain(o.thankYouCoupon);
    const { sendDeliveredEmail } = await import('../src/services/loyalty.js');
    await sendDeliveredEmail(await Order.findById(id));
    expect(await Coupon.countDocuments({ campaign: 'thank-you', 'assignedTo.email': 'thanks@example.com' })).toBe(1);
    // Only the owner of the coupon can use it, and only above the minimum.
    const other = client(); await makeUser({ email: 'other@example.com' }); await login(other, 'other@example.com');
    await other.post('/api/v1/cart/items', { variantId: String(ring.variant._id), quantity: 2 });
    expect((await other.post('/api/v1/cart/coupon', { code: o.thankYouCoupon })).status).toBe(400);
    const me = client(); await login(me, 'thanks@example.com');
    await me.post('/api/v1/cart/items', { variantId: String(ring.variant._id), quantity: 1 });
    const low = await me.post('/api/v1/cart/coupon', { code: o.thankYouCoupon });
    expect(low.status).toBe(400); expect(low.body.error.message).toMatch(/more to use this coupon/);
    await me.post('/api/v1/cart/items', { variantId: String(ring.variant._id), quantity: 1 });
    const ok = await me.post('/api/v1/cart/coupon', { code: o.thankYouCoupon });
    expect(ok.status).toBe(200);
  });

  it('cancels a fraud order, restores stock and blocks the customer; bulk-cancels others', async () => {
    const fraud = await makeUser({ email: 'fraud@example.com' });
    const before = (await ProductVariant.findById(ring.variant._id)).stock;
    const r = await owner.post('/api/v1/admin/orders/manual', manual({ customer: { name: 'Fake', phone: fraud.phone }, address: { ...address, phone: fraud.phone }, items: [{ variantId: String(ring.variant._id), quantity: 1 }] }));
    expect(r.status).toBe(201);
    const id = r.body.order._id;
    expect(String((await Order.findById(id)).user)).toBe(String(fraud._id));
    const c = await owner.post(`/api/v1/admin/orders/${id}/cancel`, { reason: 'Fraud / fake order', blockCustomer: true });
    expect(c.status).toBe(200); expect(c.body.blocked).toBe(true);
    expect((await Order.findById(id)).status).toBe('cancelled');
    expect((await User.findById(fraud._id)).status).toBe('suspended');
    expect((await ProductVariant.findById(ring.variant._id)).stock).toBe(before);
    const a = await owner.post('/api/v1/admin/orders/manual', manual({ items: [{ variantId: String(ring.variant._id), quantity: 1 }] }));
    const b = await owner.post('/api/v1/admin/orders/bulk', { ids: [a.body.order._id, id], action: 'cancel', reason: 'Duplicate orders' });
    expect(b.status).toBe(200);
    expect(b.body.results.find((x) => x.id === a.body.order._id).ok).toBe(true);
    expect(b.body.results.find((x) => x.id === id).ok).toBe(false); // already cancelled
    expect((await ProductVariant.findById(ring.variant._id)).stock).toBe(before);
  });
});
