// Razorpay adapter — https://razorpay.com/docs/api/
import env from '../../config/env.js';
import { hmac, safeEqual } from '../../lib/crypto.js';
import { fetchJson } from '../../lib/util.js';

const BASE = 'https://api.razorpay.com/v1';
const auth = () => 'Basic ' + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');

export const name = 'razorpay';
export const isConfigured = () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

export async function createOrder({ amount, receipt, notes }) {
  const r = await fetchJson(`${BASE}/orders`, { method: 'POST', headers: { Authorization: auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, currency: 'INR', receipt, notes }) }, { retries: 0 });
  if (!r.ok) throw new Error(`Razorpay order failed: ${r.body?.error?.description || r.status}`);
  return { providerOrderId: r.body.id, amount: r.body.amount, raw: r.body };
}
// Data the browser needs to open Razorpay Checkout. Only the public key id is exposed.
export const checkoutPayload = ({ providerOrderId, amount, order, prefill }) => ({
  provider: 'razorpay', keyId: env.RAZORPAY_KEY_ID, orderId: providerOrderId, amount, currency: 'INR', name: 'E-SHTYLE', description: `Order ${order.orderNumber}`, prefill,
});
// Client-returned signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export function verifyClientPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;
  return safeEqual(hmac(env.RAZORPAY_KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`), razorpay_signature);
}
export function verifyWebhook(rawBody, headers) {
  const sig = headers['x-razorpay-signature'];
  if (!sig || !env.RAZORPAY_WEBHOOK_SECRET) return false;
  return safeEqual(hmac(env.RAZORPAY_WEBHOOK_SECRET, rawBody), sig);
}
// Normalise webhook → { eventId, type, providerOrderId, providerPaymentId, status, amount, method, failureReason }
export function parseWebhook(body, headers) {
  const p = body?.payload?.payment?.entity;
  const ref = body?.payload?.refund?.entity;
  const map = { 'payment.captured': 'paid', 'order.paid': 'paid', 'payment.failed': 'failed', 'refund.processed': 'refunded', 'refund.failed': 'refund_failed' };
  return {
    eventId: headers['x-razorpay-event-id'] || `${body.event}:${p?.id || ref?.id}:${body.created_at}`,
    type: body.event, status: map[body.event] || 'ignored',
    providerOrderId: p?.order_id || body?.payload?.order?.entity?.id, providerPaymentId: p?.id || ref?.payment_id, amount: p?.amount ?? ref?.amount, method: p?.method,
    failureReason: p?.error_description, providerRefundId: ref?.id,
  };
}
export async function fetchOrderPayments(providerOrderId) {
  const r = await fetchJson(`${BASE}/orders/${encodeURIComponent(providerOrderId)}/payments`, { headers: { Authorization: auth() } });
  if (!r.ok) throw new Error(`Razorpay fetch failed ${r.status}`);
  const items = r.body.items || [];
  const captured = items.find((i) => i.status === 'captured');
  return captured ? { status: 'paid', providerPaymentId: captured.id, method: captured.method, amount: captured.amount } : { status: items.some((i) => i.status === 'failed') ? 'failed' : 'pending' };
}
export async function refund({ providerPaymentId, amount, idempotencyKey, notes }) {
  const r = await fetchJson(`${BASE}/payments/${encodeURIComponent(providerPaymentId)}/refund`, { method: 'POST', headers: { Authorization: auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, receipt: idempotencyKey?.slice(0, 40), notes }) }, { retries: 0 });
  if (!r.ok) throw new Error(`Razorpay refund failed: ${r.body?.error?.description || r.status}`);
  return { providerRefundId: r.body.id, status: r.body.status === 'processed' ? 'processed' : 'pending' };
}
