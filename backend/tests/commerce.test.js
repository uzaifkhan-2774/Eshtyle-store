import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const SAMPLE = path.resolve('uploads/seed/reels/eshtyle-shine-that-stays.mp4');
import { setupDb, teardownDb, client, seedProduct, makeUser, login, address, isRealMongo } from './helpers.js';

const REAL_MONGO = await isRealMongo();
if (!REAL_MONGO) console.warn('⚠ Running on a non-MongoDB server (FerretDB): concurrency tests are SKIPPED. Run against MongoDB 7+ for full coverage.');
import { Order, ProductVariant, Payment, Coupon, Shipment, WebhookEvent, Refund, ReturnRequest } from '../src/models/index.js';
import { expireStaleOrders } from '../src/services/orderService.js';

beforeAll(() => setupDb('esh_test_commerce'));
afterAll(teardownDb);
const key = () => crypto.randomBytes(12).toString('hex');

async function buyer(email) {
  await makeUser({ email });
  const c = client(); await login(c, email);
  return c;
}

describe('cart & pricing', () => {
  it('calculates totals on the server and ignores client prices', async () => {
    const { variant } = await seedProduct({ price: 30000, sku: 'PR-1', name: 'Price Ring' });
    const c = client();
    const r = await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1, price: 1 });
    expect(r.status).toBe(201);
    expect(r.body.totals.subtotal).toBe(30000);
    expect(r.body.totals.shipping).toBe(5900); // below free threshold of ₹499
    expect(r.body.totals.tax).toBe(Math.round((30000 * 3) / 103));
    const r2 = await c.patch(`/api/v1/cart/items/${r.body.items[0].id}`, { quantity: 2 });
    expect(r2.body.totals.subtotal).toBe(60000);
    expect(r2.body.totals.shipping).toBe(0);
  });

  it('caps quantity at available stock', async () => {
    const { variant } = await seedProduct({ stock: 2, sku: 'CAP-1', name: 'Cap Ring' });
    const c = client();
    const r = await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 5 });
    expect(r.body.items[0].quantity).toBe(2);
    expect(r.body.notice).toMatch(/Only 2/);
  });

  it('validates coupons (min order, expiry, first-order)', async () => {
    const { variant } = await seedProduct({ price: 20000, sku: 'CP-1', name: 'Coupon Ring' });
    await Coupon.create({ code: 'TENOFF', type: 'percent', value: 10, maxDiscount: 1500, minOrderValue: 30000, isActive: true });
    await Coupon.create({ code: 'OLD', type: 'flat', value: 5000, endsAt: new Date(Date.now() - 1000), isActive: true });
    const c = await buyer('coupon@example.com');
    await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1 });
    expect((await c.post('/api/v1/cart/coupon', { code: 'TENOFF' })).status).toBe(400);
    expect((await c.post('/api/v1/cart/coupon', { code: 'OLD' })).body.error.message).toMatch(/expired/);
    const cart = await c.get('/api/v1/cart');
    await c.patch(`/api/v1/cart/items/${cart.body.items[0].id}`, { quantity: 2 });
    const ok = await c.post('/api/v1/cart/coupon', { code: 'tenoff' });
    expect(ok.status).toBe(200);
    expect(ok.body.totals.discount).toBe(1500); // 10% of 40000 = 4000, capped at 1500
  });

  it('merges a guest cart into the account cart on login', async () => {
    const { variant } = await seedProduct({ sku: 'MG-1', name: 'Merge Ring' });
    await makeUser({ email: 'merge@example.com' });
    const c = client();
    await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1 });
    await login(c, 'merge@example.com');
    const cart = await c.get('/api/v1/cart');
    expect(cart.body.items.some((i) => i.sku === 'MG-1-V')).toBe(true);
  });
});

describe('checkout & inventory', () => {
  it('places a COD order, decrements stock, and replays idempotently', async () => {
    const { variant } = await seedProduct({ stock: 3, price: 50000, sku: 'COD-1', name: 'Cod Ring' });
    const c = await buyer('cod@example.com');
    await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 2 });
    const k = key();
    const r = await c.post('/api/v1/checkout/orders', { address, paymentMethod: 'cod', idempotencyKey: k, acceptTerms: true });
    expect(r.status).toBe(201);
    expect(r.body.order.status).toBe('confirmed');
    expect(r.body.order.paymentStatus).toBe('cod_pending');
    expect(r.body.order.totals.codFee).toBe(4900);
    expect((await ProductVariant.findById(variant._id)).stock).toBe(1);
    const again = await c.post('/api/v1/checkout/orders', { address, paymentMethod: 'cod', idempotencyKey: k, acceptTerms: true });
    expect(again.body.replay).toBe(true);
    expect(await Order.countDocuments({ idempotencyKey: k })).toBe(1);
    const cart = await c.get('/api/v1/cart');
    expect(cart.body.items.length).toBe(0);
  });

  it.skipIf(!REAL_MONGO)('never oversells under concurrent purchases of the last unit', async () => {
    const { variant } = await seedProduct({ stock: 1, sku: 'LAST-1', name: 'Last Ring' });
    const clients = await Promise.all([1, 2, 3, 4].map((i) => buyer(`race${i}@example.com`)));
    for (const c of clients) await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1 });
    const results = await Promise.all(clients.map((c) => c.post('/api/v1/checkout/orders', { address, paymentMethod: 'cod', idempotencyKey: key(), acceptTerms: true })));
    expect(results.filter((r) => r.status === 201).length).toBe(1);
    expect((await ProductVariant.findById(variant._id)).stock).toBe(0);
  });

  it('requires terms acceptance and a serviceable pincode', async () => {
    const { variant } = await seedProduct({ sku: 'TRM-1', name: 'Terms Ring' });
    const c = await buyer('terms@example.com');
    await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1 });
    expect((await c.post('/api/v1/checkout/orders', { address, paymentMethod: 'cod', idempotencyKey: key(), acceptTerms: false })).status).toBe(400);
    expect((await c.post('/api/v1/checkout/orders', { address: { ...address, pincode: '012345' }, paymentMethod: 'cod', idempotencyKey: key(), acceptTerms: true })).status).toBe(400);
  });

  it('customer cancellation restores stock', async () => {
    const { variant } = await seedProduct({ stock: 4, sku: 'CAN-1', name: 'Cancel Ring' });
    const c = await buyer('cancel@example.com');
    await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 2 });
    const r = await c.post('/api/v1/checkout/orders', { address, paymentMethod: 'cod', idempotencyKey: key(), acceptTerms: true });
    expect((await ProductVariant.findById(variant._id)).stock).toBe(2);
    const x = await c.post(`/api/v1/account/orders/${r.body.order.orderNumber}/cancel`, { reason: 'Changed my mind' });
    expect(x.status).toBe(200);
    expect((await ProductVariant.findById(variant._id)).stock).toBe(4);
    const twice = await c.post(`/api/v1/account/orders/${r.body.order.orderNumber}/cancel`, { reason: 'again' });
    expect(twice.status).toBe(400);
    expect((await ProductVariant.findById(variant._id)).stock).toBe(4);
  });
});

describe('online payments (Razorpay, mocked HTTP)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/v1/orders')) return new Response(JSON.stringify({ id: `order_${crypto.randomBytes(6).toString('hex')}`, amount: 1, status: 'created' }), { status: 200 });
      if (String(url).includes('/payments')) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      return new Response('{}', { status: 404 });
    }));
  });
  const sign = (s, v) => crypto.createHmac('sha256', s).update(v).digest('hex');

  async function pendingOrder(email, sku) {
    const { variant } = await seedProduct({ stock: 2, price: 60000, sku, name: `Pay ${sku}` });
    const c = await buyer(email);
    await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1 });
    const r = await c.post('/api/v1/checkout/orders', { address, paymentMethod: 'online', idempotencyKey: key(), acceptTerms: true });
    return { c, r, variant };
  }

  it('sells the last unit exactly once (sequential)', async () => {
    const { variant } = await seedProduct({ stock: 1, sku: 'SEQ-1', name: 'Seq Ring' });
    const a = await buyer('seq1@example.com'); const b = await buyer('seq2@example.com');
    await a.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1 });
    await b.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1 });
    expect((await a.post('/api/v1/checkout/orders', { address, paymentMethod: 'cod', idempotencyKey: key(), acceptTerms: true })).status).toBe(201);
    const second = await b.post('/api/v1/checkout/orders', { address, paymentMethod: 'cod', idempotencyKey: key(), acceptTerms: true });
    expect(second.status).toBe(400);
    expect((await ProductVariant.findById(variant._id)).stock).toBe(0);
  });

  it('creates a pending order and only confirms after a valid signature', async () => {
    const { c, r } = await pendingOrder('pay1@example.com', 'PAY-1');
    expect(r.status).toBe(201);
    expect(r.body.order.status).toBe('pending_payment');
    expect(r.body.payment.keyId).toBe('rzp_test_key');
    expect(JSON.stringify(r.body)).not.toContain('rzp_test_secret');
    const forged = await c.post('/api/v1/checkout/payments/razorpay/verify', { orderNumber: r.body.order.orderNumber, razorpay_order_id: r.body.payment.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'deadbeef' });
    expect(forged.status).toBe(400);
    const ok = await c.post('/api/v1/checkout/payments/razorpay/verify', { orderNumber: r.body.order.orderNumber, razorpay_order_id: r.body.payment.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: sign('rzp_test_secret', `${r.body.payment.orderId}|pay_1`) });
    expect(ok.status).toBe(200);
    expect(ok.body.order.paymentStatus).toBe('paid');
    expect(ok.body.order.status).toBe('confirmed');
  });

  it('processes webhooks once, rejects bad signatures, and checks amounts', async () => {
    const { c, r } = await pendingOrder('pay2@example.com', 'PAY-2');
    const body = JSON.stringify({ event: 'payment.captured', created_at: 1, payload: { payment: { entity: { id: 'pay_W', order_id: r.body.payment.orderId, amount: r.body.order.totals.total, method: 'upi' } } } });
    const bad = await c.agent.post('/api/v1/webhooks/razorpay').set('Content-Type', 'application/json').set('x-razorpay-signature', 'nope').send(body);
    expect(bad.status).toBe(401);
    const send = () => c.agent.post('/api/v1/webhooks/razorpay').set('Content-Type', 'application/json').set('x-razorpay-event-id', 'evt_1').set('x-razorpay-signature', sign('rzp_webhook_secret', body)).send(body);
    const first = await send(); const second = await send();
    expect(first.body.result).toBe('processed');
    expect(second.body.result).toBe('duplicate');
    const o = await Order.findOne({ orderNumber: r.body.order.orderNumber });
    expect(o.paymentStatus).toBe('paid');
    expect(o.statusHistory.filter((h) => h.status === 'confirmed').length).toBe(1);
    expect(await WebhookEvent.countDocuments({ eventId: 'evt_1' })).toBe(1);
  });

  it('expires unpaid orders and releases reserved stock', async () => {
    const { r, variant } = await pendingOrder('pay3@example.com', 'PAY-3');
    expect((await ProductVariant.findById(variant._id)).stock).toBe(1);
    await Order.updateOne({ orderNumber: r.body.order.orderNumber }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await expireStaleOrders();
    expect((await Order.findOne({ orderNumber: r.body.order.orderNumber })).status).toBe('expired');
    expect((await ProductVariant.findById(variant._id)).stock).toBe(2);
    await expireStaleOrders(); // idempotent
    expect((await ProductVariant.findById(variant._id)).stock).toBe(2);
  });
});

describe('shipping (Shiprocket, mocked HTTP) & admin permissions', () => {
  let calls;
  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const u = String(url); calls.push(u);
      const json = (b) => new Response(JSON.stringify(b), { status: 200 });
      if (u.endsWith('/auth/login')) return json({ token: 'tok' });
      if (u.includes('/courier/serviceability')) return json({ data: { available_courier_companies: [{ courier_company_id: 7, courier_name: 'Delhivery', rate: '62.5', etd: 'Oct 22', estimated_delivery_days: '4', cod: 1 }], recommended_courier_company_id: 7 } });
      if (u.endsWith('/orders/create/adhoc')) return json({ order_id: 111, shipment_id: 222, status: 'NEW' });
      if (u.endsWith('/courier/assign/awb')) return json({ response: { data: { awb_code: 'AWB123', courier_name: 'Delhivery', courier_company_id: 7 } } });
      if (u.endsWith('/courier/generate/pickup')) return json({ response: { pickup_scheduled_date: '2026-10-20 10:00:00' } });
      if (u.endsWith('/courier/generate/label')) return json({ label_created: 1, label_url: 'https://example.com/label.pdf' });
      return new Response('{}', { status: 404 });
    }));
  });

  it('enforces role permissions on admin APIs', async () => {
    const cust = await buyer('notadmin@example.com');
    expect((await cust.get('/api/v1/admin/dashboard')).status).toBe(403);
    await makeUser({ email: 'support@example.com', role: 'support' });
    const sup = client(); await login(sup, 'support@example.com');
    expect((await sup.get('/api/v1/admin/orders')).status).toBe(200);
    expect((await sup.put('/api/v1/admin/settings', { cod: { fee: 0 } })).status).toBe(403);
    expect((await sup.post('/api/v1/admin/products', {})).status).toBe(403);
    await makeUser({ email: 'inv@example.com', role: 'inventory' });
    const inv = client(); await login(inv, 'inv@example.com');
    const o = await Order.findOne();
    expect((await inv.post(`/api/v1/admin/orders/${o._id}/refund`, { amount: 100, reason: 'test' })).status).toBe(403);
    expect((await inv.get('/api/v1/admin/staff')).status).toBe(403);
  });

  it('creates exactly one shipment, and only courier events mark delivery', async () => {
    const { variant } = await seedProduct({ stock: 3, price: 60000, sku: 'SHP-1', name: 'Ship Ring' });
    const c = await buyer('ship@example.com');
    await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1 });
    const placed = await c.post('/api/v1/checkout/orders', { address, paymentMethod: 'cod', idempotencyKey: key(), acceptTerms: true });
    expect(placed.status).toBe(201);
    await makeUser({ email: 'owner@example.com', role: 'owner' });
    const admin = client(); await login(admin, 'owner@example.com');
    const order = await Order.findOne({ orderNumber: placed.body.order.orderNumber });
    const ship = () => admin.post(`/api/v1/admin/orders/${order._id}/ship`, {});
    const [a, b] = REAL_MONGO ? await Promise.all([ship(), ship()]) : [await ship(), await ship()];
    expect([a.status, b.status]).toContain(200);
    expect(await Shipment.countDocuments({ order: order._id, kind: 'forward' })).toBe(1);
    expect(calls.filter((u) => u.endsWith('/orders/create/adhoc')).length).toBe(1);
    let o = await Order.findById(order._id);
    expect(o.status).toBe('ready_to_ship'); // label generated ≠ delivered
    expect(o.invoiceNumber).toMatch(/^ESH\//);
    const hook = (status) => c.agent.post('/api/v1/webhooks/shiprocket').set('Content-Type', 'application/json').set('x-api-key', 'sr-hook-token').send(JSON.stringify({ awb: 'AWB123', current_status: status, current_status_id: status.length, current_timestamp: status }));
    expect((await c.agent.post('/api/v1/webhooks/shiprocket').set('x-api-key', 'wrong').send('{}')).status).toBe(401);
    await hook('IN TRANSIT');
    expect((await Order.findById(order._id)).status).toBe('shipped');
    await hook('DELIVERED');
    o = await Order.findById(order._id);
    expect(o.status).toBe('delivered');
    expect(o.paymentStatus).toBe('cod_collected');
    // Manual "delivered" is refused for Shiprocket-tracked orders.
    const manual = await admin.post(`/api/v1/admin/orders/${order._id}/status`, { status: 'delivered', manualOverride: true });
    expect(manual.status).toBe(400);
  });

  it('enforces the return policy: damaged/wrong only, tag + unboxing video, 7 days, staff approval after watching', async () => {
    const o = await Order.findOne({ status: 'delivered' });
    const c = client(); await login(c, 'ship@example.com');
    const csrf = (await c.agent.get('/api/v1/auth/csrf')).body.csrfToken;
    const items = [{ orderItem: String(o.items[0]._id), quantity: 1 }];
    const confirmations = { tagIntact: true, unused: true, originalPackaging: true, unboxingVideo: true };
    const good = { items, reason: 'Received damaged', comments: 'The stone fell out of the ring in the box.', confirmations };
    const send = (data, file) => { let q = c.agent.post(`/api/v1/account/orders/${o.orderNumber}/returns`).set('X-CSRF-Token', csrf).field('data', JSON.stringify(data)); if (file) q = q.attach('video', file, 'unboxing.mp4'); return q; };
    // change-of-mind reasons are refused
    expect((await send({ ...good, reason: 'Did not like the colour' }, SAMPLE)).status).toBe(400);
    // the tag/unused confirmations are mandatory
    expect((await send({ ...good, confirmations: { ...confirmations, tagIntact: false } }, SAMPLE)).status).toBe(400);
    // the video is mandatory, and must be a real video
    const noVideo = await send(good);
    expect(noVideo.status).toBe(400); expect(noVideo.body.error.message).toMatch(/unboxing video/i);
    expect((await send(good, Buffer.from('not a video'))).status).toBe(400);
    // outside the 7-day window
    const real = o.statusHistory.find((h) => h.status === 'delivered').at;
    await Shipment.updateOne({ order: o._id, kind: 'forward' }, { $set: { deliveredAt: new Date(Date.now() - 8 * 86400000) } });
    expect((await send(good, SAMPLE)).status).toBe(400);
    await Shipment.updateOne({ order: o._id, kind: 'forward' }, { $set: { deliveredAt: real || new Date() } });
    // valid request
    const rr = await send(good, SAMPLE);
    expect(rr.status).toBe(201);
    expect(rr.body.returnRequest.video).toEqual(expect.objectContaining({ uploaded: true }));
    expect(JSON.stringify(rr.body)).not.toMatch(/returns\/[a-f0-9]{20}/); // private key never sent to the customer
    const saved = await ReturnRequest.findById(rr.body.returnRequest._id).lean();
    expect(saved.video.key).toMatch(/^returns\/[a-f0-9]{20}\.mp4$/);
    expect(fs.existsSync(path.resolve('private-uploads', saved.video.key))).toBe(true);
    // not reachable through public static uploads; customers can't stream it; staff can
    expect((await client().get(`/uploads/${saved.video.key}`)).status).toBe(404);
    expect((await c.get(`/api/v1/admin/orders/returns/${saved._id}/video`)).status).toBe(403);
    const staff = client(); await login(staff, 'owner@example.com');
    const v = await staff.get(`/api/v1/admin/orders/returns/${saved._id}/video`);
    expect(v.status).toBe(200); expect(v.headers['content-type']).toMatch(/video\/mp4/); expect(v.headers['cache-control']).toMatch(/no-store/);
    // a request without a video can never be approved
    const legacy = await ReturnRequest.create({ order: o._id, user: saved.user, items: saved.items, reason: 'Received damaged', status: 'requested' });
    expect((await staff.post(`/api/v1/admin/orders/returns/${legacy._id}`, { status: 'approved' })).status).toBe(400);
    await ReturnRequest.deleteOne({ _id: legacy._id });
    const ok = await staff.post(`/api/v1/admin/orders/returns/${saved._id}`, { status: 'approved' });
    expect(ok.status).toBe(200);
    expect(String((await ReturnRequest.findById(saved._id)).videoReviewedBy)).toBeTruthy();
    fs.rmSync(path.resolve('private-uploads', saved.video.key), { force: true });
    const admin = client(); await login(admin, 'owner@example.com');
    const refund = await admin.post(`/api/v1/admin/orders/${o._id}/refund`, { amount: 1000, reason: 'Damaged', method: 'upi' });
    expect(refund.status).toBe(200);
    expect(refund.body.refund.method).toBe('upi');
    expect(refund.body.refund.status).toBe('pending');
    expect(await Refund.countDocuments({ order: o._id })).toBe(1);
    const tooMuch = await admin.post(`/api/v1/admin/orders/${o._id}/refund`, { amount: o.totals.total, reason: 'x', method: 'upi' });
    expect(tooMuch.status).toBe(400);
  });
});
