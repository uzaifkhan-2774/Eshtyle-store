/** Thank-you reward: when an order is delivered, the customer gets a personal one-time coupon for the next order,
 *  shown in the "Delivered" email. Issued once per order; amount / minimum / validity come from Admin → Settings. */
import crypto from 'node:crypto';
import { Coupon, Order, getSettings } from '../models/index.js';
import { notifyEmail } from './notify/index.js';
import logger from '../lib/logger.js';

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => `THANKS${Array.from(crypto.randomBytes(6), (b) => ALPH[b % ALPH.length]).join('')}`;

export async function issueThankYouCoupon(order) {
  const s = await getSettings();
  const L = s.loyalty || {};
  if (L.thankYouEnabled === false || !L.thankYouAmount || !order.email) return null;
  if (order.thankYouCoupon) return null;
  const c = code();
  // Claim the order first so two delivery events can never issue two coupons.
  const claimed = await Order.updateOne({ _id: order._id, thankYouCoupon: { $exists: false } }, { $set: { thankYouCoupon: c } });
  if (!claimed.modifiedCount) return null;
  const endsAt = new Date(Date.now() + (L.thankYouDays || 30) * 86400e3);
  await Coupon.create({
    code: c, type: 'flat', value: L.thankYouAmount, minOrderValue: L.thankYouMinOrder || 0, endsAt, usageLimit: 1, perUserLimit: 1,
    assignedTo: { user: order.user || undefined, email: order.email }, campaign: 'thank-you', description: `Thank-you reward for order ${order.orderNumber}`,
  });
  order.thankYouCoupon = c;
  return { code: c, amount: L.thankYouAmount, minOrder: L.thankYouMinOrder || 0, endsAt };
}

/** Use instead of sending the plain "delivered" email. Issues the coupon (awaited), then sends the email in the background. Never throws. */
export async function sendDeliveredEmail(order) {
  let reward = null;
  try { reward = await issueThankYouCoupon(order); } catch (e) { logger.warn({ err: e.message, order: order.orderNumber }, 'thank-you coupon failed'); }
  notifyEmail('delivered', order.email, { order, reward }, { order: order._id });
  return reward;
}
