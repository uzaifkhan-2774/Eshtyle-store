/** Background reminders:
 *  1. Abandoned bag email — only to signed-in customers who opted in to marketing emails, once per bag change
 *     and at most once a week, 3–48 hours after the bag was last touched. Every email has a one-click unsubscribe.
 *  2. Daily low-stock / sold-out digest to the owner (ADMIN_ALERT_EMAIL). */
import { Cart, User, Product, ProductVariant, StoreSettings, getSettings } from '../models/index.js';
import { notifyEmail, notifyAdmin } from './notify/index.js';
import { hmac } from '../lib/crypto.js';
import env from '../config/env.js';
import logger from '../lib/logger.js';

const HOUR = 3600e3;
export const unsubscribeToken = (userId) => hmac(env.JWT_ACCESS_SECRET, `marketing-unsub:${userId}`);
export const unsubscribeUrl = (userId) => `${env.API_URL}/api/v1/marketing/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;

export async function sendAbandonedCartReminders(now = Date.now()) {
  const carts = await Cart.find({ user: { $ne: null }, updatedAt: { $lte: new Date(now - 3 * HOUR), $gte: new Date(now - 48 * HOUR) } }).limit(300).lean();
  let sent = 0;
  for (const c of carts) {
    if (!c.items?.length) continue;
    const last = c.abandonedNotifiedAt ? new Date(c.abandonedNotifiedAt).getTime() : 0;
    if (last && (last >= new Date(c.updatedAt).getTime() - 60e3 || last > now - 7 * 24 * HOUR)) continue;
    const u = await User.findById(c.user).lean();
    if (!u || u.status !== 'active' || u.devOnly || !u.email || !u.emailVerified || !u.marketingConsent?.email) continue;
    const variants = await ProductVariant.find({ _id: { $in: c.items.map((i) => i.variant) }, isActive: true, stock: { $gt: 0 } }).lean();
    if (!variants.length) continue; // nothing left to buy
    const products = await Product.find({ _id: { $in: variants.map((v) => v.product) }, status: 'published' }).select('name').lean();
    const pm = new Map(products.map((p) => [String(p._id), p.name]));
    const items = variants.filter((v) => pm.has(String(v.product))).map((v) => ({ name: pm.get(String(v.product)), price: v.price }));
    if (!items.length) continue;
    await Cart.updateOne({ _id: c._id }, { $set: { abandonedNotifiedAt: new Date(now) } }, { timestamps: false });
    await notifyEmail('abandonedCart', u.email, { name: (u.name || '').split(' ')[0], items, unsubscribeUrl: unsubscribeUrl(u._id) }, { kind: 'marketing', user: u._id });
    sent++;
  }
  if (sent) logger.info({ sent }, 'abandoned bag reminders sent');
  return sent;
}

export async function sendLowStockDigest(now = Date.now()) {
  const s = await getSettings();
  if (s.alerts?.lowStockSentAt && now - new Date(s.alerts.lowStockSentAt).getTime() < 20 * HOUR) return null;
  const variants = await ProductVariant.find({ isActive: true, stock: { $lte: 10 } }).lean();
  const low = variants.filter((v) => v.stock <= (v.lowStockThreshold ?? 3));
  if (!low.length) return null;
  const products = await Product.find({ _id: { $in: low.map((v) => v.product) }, status: 'published' }).select('name').lean();
  const pm = new Map(products.map((p) => [String(p._id), p.name]));
  const items = low.filter((v) => pm.has(String(v.product))).map((v) => ({ name: pm.get(String(v.product)) + (v.title !== 'Default' ? ` (${v.title})` : ''), sku: v.sku, stock: v.stock })).sort((a, b) => a.stock - b.stock);
  if (!items.length) return null;
  const signature = items.map((i) => `${i.sku}:${i.stock}`).join(',');
  // Same list as last time and sent within 3 days → don't nag.
  if (s.alerts?.lowStockSignature === signature && s.alerts?.lowStockSentAt && now - new Date(s.alerts.lowStockSentAt).getTime() < 72 * HOUR) return null;
  await StoreSettings.updateOne({ key: 'store' }, { $set: { 'alerts.lowStockSentAt': new Date(now), 'alerts.lowStockSignature': signature } });
  await notifyAdmin('lowStockDigest', { items });
  return items.length;
}
