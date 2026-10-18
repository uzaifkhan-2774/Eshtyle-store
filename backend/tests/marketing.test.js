import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { setupDb, teardownDb, client, seedProduct, makeUser, login, address } from './helpers.js';
import { buildPurchaseEvent } from '../src/services/metaCapi.js';
import { Order } from '../src/models/index.js';

beforeAll(() => setupDb('esh_test_marketing'));
afterAll(teardownDb);
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');

describe('ads & attribution', () => {
  it('stores ad attribution, respects consent, and reports orders by source', async () => {
    const { variant } = await seedProduct({ sku: 'ADS-1', name: 'Ads Ring' });
    await makeUser({ email: 'ads@example.com' });
    const c = client(); await login(c, 'ads@example.com');
    await c.post('/api/v1/cart/items', { variantId: String(variant._id), quantity: 1 });
    const r = await c.post('/api/v1/checkout/orders', { address, paymentMethod: 'cod', idempotencyKey: crypto.randomUUID(), acceptTerms: true, adConsent: false, attribution: { utmSource: 'instagram', utmMedium: 'paid_social', utmCampaign: 'diwali', utmContent: 'reel-1' } });
    expect(r.status).toBe(201);
    const o = await Order.findOne({ orderNumber: r.body.order.orderNumber });
    expect(o.attribution.utmCampaign).toBe('diwali');
    expect(o.adTracking.consent).toBe(false);
    expect(o.adTracking.ip).toBeUndefined(); // nothing stored for ads without consent
    await makeUser({ email: 'mgr@example.com', role: 'manager' });
    const m = client(); await login(m, 'mgr@example.com');
    const rep = await m.get('/api/v1/admin/dashboard/attribution');
    expect(rep.body.bySource[0]).toMatchObject({ key: 'instagram / paid_social', orders: 1 });
    expect(rep.body.byAd[0].key).toBe('reel-1');
  });

  it('builds a Meta purchase event with hashed customer data and SKU content ids', () => {
    const ev = buildPurchaseEvent({ orderNumber: 'ESH1', placedAt: new Date(), email: 'A@B.com', phone: '9876543210', shippingAddress: { fullName: 'Asha Verma', city: 'Pune', state: 'Maharashtra', pincode: '411001' }, totals: { total: 44900 }, items: [{ sku: 'ESH-0047', quantity: 1, unitPrice: 44900 }], adTracking: { consent: true } }, '123');
    expect(ev.event_id).toBe('ESH1');
    expect(ev.user_data.em[0]).toBe(sha('a@b.com'));
    expect(ev.user_data.ph[0]).toBe(sha('919876543210'));
    expect(JSON.stringify(ev)).not.toContain('9876543210"');
    expect(ev.custom_data).toMatchObject({ currency: 'INR', value: 449, content_ids: ['ESH-0047'] });
  });

  it('serves the Meta catalog feed with variant SKUs as ids', async () => {
    const c = client();
    const res = await c.get('/feeds/meta.csv');
    expect(res.status).toBe(200);
    expect(res.text.split('\n')[0]).toContain('id,item_group_id,title');
    expect(res.text).toContain('ADS-1-V');
  });
});
