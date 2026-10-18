// Cashfree Payments adapter (PG API v2023-08-01) — https://docs.cashfree.com/reference/pg-new-apis-endpoint
import crypto from 'node:crypto';
import env from '../../config/env.js';
import { safeEqual } from '../../lib/crypto.js';
import { fetchJson } from '../../lib/util.js';

const base = () => (env.CASHFREE_ENV === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg');
const headers = (extra = {}) => ({ 'x-client-id': env.CASHFREE_APP_ID, 'x-client-secret': env.CASHFREE_SECRET_KEY, 'x-api-version': '2023-08-01', 'Content-Type': 'application/json', ...extra });

export const name = 'cashfree';
export const isConfigured = () => Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);

export async function createOrder({ amount, receipt, customer, returnUrl }) {
  const r = await fetchJson(`${base()}/orders`, { method: 'POST', headers: headers({ 'x-idempotency-key': receipt }), body: JSON.stringify({
    order_id: receipt, order_amount: amount / 100, order_currency: 'INR',
    customer_details: { customer_id: customer.id, customer_phone: customer.phone, customer_email: customer.email, customer_name: customer.name },
    order_meta: { return_url: returnUrl, notify_url: `${env.API_URL}/api/v1/webhooks/cashfree` },
  }) }, { retries: 0 });
  if (!r.ok) throw new Error(`Cashfree order failed: ${r.body?.message || r.status}`);
  return { providerOrderId: r.body.order_id, paymentSessionId: r.body.payment_session_id, amount, raw: r.body };
}
export const checkoutPayload = ({ providerOrderId, paymentSessionId, amount }) => ({ provider: 'cashfree', mode: env.CASHFREE_ENV, orderId: providerOrderId, paymentSessionId, amount });
// Cashfree returns to return_url; the server confirms by fetching order status (never trusts the browser).
export const verifyClientPayment = () => false;
export function verifyWebhook(rawBody, h) {
  const sig = h['x-webhook-signature']; const ts = h['x-webhook-timestamp'];
  if (!sig || !ts) return false;
  const expected = crypto.createHmac('sha256', env.CASHFREE_SECRET_KEY).update(ts + rawBody).digest('base64');
  return safeEqual(expected, sig);
}
export function parseWebhook(body, h) {
  const d = body?.data || {};
  const st = d.payment?.payment_status;
  const status = body.type === 'PAYMENT_SUCCESS_WEBHOOK' || st === 'SUCCESS' ? 'paid' : body.type === 'PAYMENT_FAILED_WEBHOOK' || st === 'FAILED' ? 'failed' : body.type?.startsWith('REFUND') ? (d.refund?.refund_status === 'SUCCESS' ? 'refunded' : 'ignored') : 'ignored';
  return { eventId: `${body.type}:${d.payment?.cf_payment_id || d.refund?.cf_refund_id}:${h['x-webhook-timestamp']}`, type: body.type, status, providerOrderId: d.order?.order_id || d.refund?.order_id, providerPaymentId: d.payment?.cf_payment_id ? String(d.payment.cf_payment_id) : undefined, amount: d.payment?.payment_amount ? Math.round(d.payment.payment_amount * 100) : undefined, method: d.payment?.payment_group, failureReason: d.payment?.payment_message, providerRefundId: d.refund?.refund_id };
}
export async function fetchOrderPayments(providerOrderId) {
  const r = await fetchJson(`${base()}/orders/${encodeURIComponent(providerOrderId)}/payments`, { headers: headers() });
  if (!r.ok) throw new Error(`Cashfree fetch failed ${r.status}`);
  const items = Array.isArray(r.body) ? r.body : [];
  const ok = items.find((i) => i.payment_status === 'SUCCESS');
  return ok ? { status: 'paid', providerPaymentId: String(ok.cf_payment_id), method: ok.payment_group, amount: Math.round(ok.payment_amount * 100) } : { status: items.some((i) => i.payment_status === 'FAILED') ? 'failed' : 'pending' };
}
export async function refund({ providerOrderId, amount, idempotencyKey }) {
  const r = await fetchJson(`${base()}/orders/${encodeURIComponent(providerOrderId)}/refunds`, { method: 'POST', headers: headers(), body: JSON.stringify({ refund_amount: amount / 100, refund_id: idempotencyKey.slice(0, 40) }) }, { retries: 0 });
  if (!r.ok) throw new Error(`Cashfree refund failed: ${r.body?.message || r.status}`);
  return { providerRefundId: r.body.refund_id, status: r.body.refund_status === 'SUCCESS' ? 'processed' : 'pending' };
}
