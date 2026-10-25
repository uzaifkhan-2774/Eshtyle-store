import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Product, ProductVariant } from '../src/models/index.js';
import { priceLines } from '../src/services/pricing.js';
import { getSettings } from '../src/services/orderService.js';
import { setupDb, teardownDb, client, seedProduct } from './helpers.js';

beforeAll(() => setupDb('esh_freeship'));
afterAll(teardownDb);

describe('free shipping on every order, ₹49 extra only for COD', () => {
  it('charges no shipping on prepaid and adds ₹49 on COD by default', async () => {
    const settings = await getSettings();
    const variant = { price: 100, _id: 'x' }; const product = { _id: 'p', codAvailable: true, name: 'T' };
    const lines = [{ product, variant, quantity: 1 }];
    const pre = await priceLines(lines, { settings, paymentMethod: 'razorpay' });
    const cod = await priceLines(lines, { settings, paymentMethod: 'cod' });
    expect(pre.totals.shipping).toBe(0); expect(pre.totals.codFee).toBe(0); expect(pre.totals.total).toBe(100);
    expect(cod.totals.shipping).toBe(0); expect(cod.totals.codFee).toBe(4900); expect(cod.totals.total).toBe(5000);
  });
  it('hides unlisted products from the shop but keeps their direct link working', async () => {
    const { product } = await seedProduct({ name: 'Visible Ring', sku: 'VIS-1' });
    const hidden = await seedProduct({ name: 'Payment Test', sku: 'HID-1', price: 100, stock: 1 });
    await Product.updateOne({ _id: hidden.product._id }, { isListed: false });
    const c = client();
    const list = await c.get('/api/v1/catalog/products');
    const slugs = list.body.items.map((p) => p.slug);
    expect(slugs).toContain(product.slug); expect(slugs).not.toContain('payment-test');
    const one = await c.get('/api/v1/catalog/products/payment-test');
    expect(one.status).toBe(200); expect(one.body.product.isListed).toBe(false);
    expect(await ProductVariant.countDocuments({ product: hidden.product._id })).toBe(1);
  });
});
