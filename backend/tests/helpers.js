import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Category, Product, ProductVariant, User, Coupon } from '../src/models/index.js';
import { sentInTest } from '../src/services/notify/email.js';
import { hashPassword } from '../src/services/authService.js';
import { refreshProductStock } from '../src/services/inventory.js';

export async function setupDb(name) {
  const base = process.env.MONGODB_URI.replace(/\/[^/]*$/, '');
  await mongoose.connect(`${base}/${name}`);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init().catch(() => {})));
}
export async function teardownDb() { await mongoose.connection.db.dropDatabase(); await mongoose.disconnect(); }

export function client() {
  const agent = request.agent(createApp());
  let csrf;
  const ensure = async () => { if (!csrf) { const r = await agent.get('/api/v1/auth/csrf'); csrf = r.body.csrfToken; } return csrf; };
  const wrap = (m) => async (url, body) => { const t = await ensure(); let req = agent[m](url).set('X-CSRF-Token', t); if (body !== undefined) req = req.send(body); return req; };
  return { agent, get: (u) => agent.get(u), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), del: wrap('delete') };
}
export const lastCode = (to) => { const m = [...sentInTest].reverse().find((e) => e.to === to); return m?.text?.match(/\b(\d{6})\b/)?.[1]; };

export async function seedProduct({ stock = 5, price = 49900, name = 'Test Ring', sku = 'TST-1', codAvailable = true } = {}) {
  const cat = (await Category.findOne({ slug: 'rings' })) || (await Category.create({ name: 'Rings', slug: 'rings' }));
  const p = await Product.create({ name, slug: name.toLowerCase().replace(/\s+/g, '-'), sku, category: cat._id, status: 'published', price, images: [{ url: '/x.webp' }], codAvailable });
  const v = await ProductVariant.create({ product: p._id, sku: `${sku}-V`, title: 'Default', price, stock });
  await refreshProductStock([p._id]);
  return { product: p, variant: v, category: cat };
}
export async function makeUser({ email = 'buyer@example.com', role = 'customer', password = 'Password123' } = {}) {
  return User.create({ email, name: 'Test Buyer', role, emailVerified: true, phone: role === 'customer' ? `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}` : undefined, passwordHash: await hashPassword(password) });
}
export async function login(c, email, password = 'Password123') {
  const r = await c.post('/api/v1/auth/login', { email, password });
  if (r.status !== 200) throw new Error(`login failed ${r.status} ${JSON.stringify(r.body)}`);
  return r;
}
export const address = { fullName: 'Asha Verma', phone: '9876543210', line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001' };
export { Coupon };

/** FerretDB (used in some CI sandboxes) does not make conditional updates atomic; concurrency tests need real MongoDB. */
export async function isRealMongo() {
  const m = await import('mongoose');
  const c = await m.default.createConnection(process.env.MONGODB_URI).asPromise();
  const info = await c.db.admin().command({ buildInfo: 1 });
  await c.close();
  return !info.ferretdbVersion && !info.ferretdbFeatures;
}
