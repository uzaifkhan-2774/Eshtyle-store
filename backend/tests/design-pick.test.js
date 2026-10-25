import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Product } from '../src/models/index.js';
import { setupDb, teardownDb, client, seedProduct } from './helpers.js';

beforeAll(() => setupDb('esh_designpick'));
afterAll(teardownDb);

describe('pick-your-designs combos', () => {
  it('requires exactly N designs, keeps different picks as separate lines', async () => {
    const { product, variant } = await seedProduct({ name: 'Pick Earrings', sku: 'PICK-1', price: 35000, stock: 10 });
    await Product.updateOne({ _id: product._id }, { designPick: { count: 2 }, images: [0, 1, 2, 3].map((i) => ({ url: `/x${i}.webp` })) });
    const c = client(); const vid = String(variant._id);
    expect((await c.post('/api/v1/cart/items', { variantId: vid, quantity: 1 })).status).toBe(400);
    expect((await c.post('/api/v1/cart/items', { variantId: vid, quantity: 1, designs: [1] })).status).toBe(400);
    expect((await c.post('/api/v1/cart/items', { variantId: vid, quantity: 1, designs: [1, 9] })).status).toBe(400);
    const a = await c.post('/api/v1/cart/items', { variantId: vid, quantity: 1, designs: [3, 1] });
    expect(a.status).toBe(201);
    expect(a.body.items[0].designs.map((d) => d.label)).toEqual(['Design 2', 'Design 4']);
    const b = await c.post('/api/v1/cart/items', { variantId: vid, quantity: 1, designs: [1, 3] });
    expect(b.body.items).toHaveLength(1); expect(b.body.items[0].quantity).toBe(2);
    const d = await c.post('/api/v1/cart/items', { variantId: vid, quantity: 1, designs: [0, 2] });
    expect(d.body.items).toHaveLength(2);
    const list = await c.get('/api/v1/catalog/products');
    const card = list.body.items.find((x) => x.slug === product.slug);
    expect(card.pickCount).toBe(2); expect(card.quickVariantId).toBeNull();
  });
});
