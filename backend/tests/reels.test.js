import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { setupDb, teardownDb, client, makeUser, login, seedProduct } from './helpers.js';

beforeAll(() => setupDb('esh_test_reels'));
afterAll(teardownDb);
const SAMPLE = path.resolve('uploads/seed/reels/eshtyle-shine-that-stays.mp4');

describe('reels', () => {
  it('rejects files that are not real videos, accepts MP4, and shows shoppable reels on the homepage', async () => {
    await seedProduct({ sku: 'RL-1', name: 'Reel Ring' });
    await makeUser({ email: 'mk@example.com', role: 'manager' });
    const c = client(); await login(c, 'mk@example.com');
    const csrf = (await c.agent.get('/api/v1/auth/csrf')).body.csrfToken;
    const bad = await c.agent.post('/api/v1/admin/reels/upload').set('X-CSRF-Token', csrf).attach('video', Buffer.from('not a video at all'), 'fake.mp4');
    expect(bad.status).toBe(400);
    const hasSample = fs.existsSync(SAMPLE);
    let video = { url: '/uploads/seed/reels/eshtyle-shine-that-stays.mp4' };
    if (hasSample) {
      const ok = await c.agent.post('/api/v1/admin/reels/upload').set('X-CSRF-Token', csrf).attach('video', SAMPLE);
      expect(ok.status).toBe(201);
      expect(ok.body.video.url).toMatch(/^\/uploads\/reels\/.+\.mp4$/);
      video = ok.body.video;
    }
    const created = await c.post('/api/v1/admin/reels', { video, orientation: 'portrait', title: 'Try-on', productSlugs: ['reel-ring', 'does-not-exist'], isActive: true });
    expect(created.status).toBe(201);
    const support = client(); await makeUser({ email: 'sp@example.com', role: 'support' }); await login(support, 'sp@example.com');
    expect((await support.post('/api/v1/admin/reels', { video, orientation: 'portrait' })).status).toBe(403);
    const home = await client().get('/api/v1/catalog/home');
    const reel = home.body.reels.find((r) => r.title === 'Try-on');
    expect(reel.products.map((p) => p.slug)).toEqual(['reel-ring']); // unknown slugs are dropped
  }, 120000);

  it('marks single-variant in-stock products for one-tap add to bag', async () => {
    const res = await client().get('/api/v1/catalog/products?q=reel');
    expect(res.body.items[0].quickVariantId).toBeTruthy();
    expect(res.body.items[0].variantCount).toBe(1);
  });
});
