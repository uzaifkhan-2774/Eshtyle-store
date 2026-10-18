// Meta Conversions API: sends the Purchase event from the server so Facebook/Instagram ads can learn
// who buys (ad optimisation + accurate reporting even when browsers block the pixel).
// Sent ONLY when the shopper accepted marketing cookies. Personal data is SHA-256 hashed as Meta requires.
// Deduplicated with the browser pixel via event_id = order number.
import crypto from 'node:crypto';
import env from '../config/env.js';
import { getSettings, Order } from '../models/index.js';
import { fetchJson } from '../lib/util.js';
import logger from '../lib/logger.js';

const h = (v) => (v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined);

export function buildPurchaseEvent(order, pixelId) {
  const a = order.shippingAddress || {};
  const t = order.adTracking || {};
  const [fn, ...ln] = String(a.fullName || '').split(' ');
  return {
    event_name: 'Purchase', event_time: Math.floor(new Date(order.placedAt).getTime() / 1000), event_id: order.orderNumber, action_source: 'website',
    event_source_url: t.sourceUrl || `${env.APP_URL}/checkout`,
    user_data: {
      em: order.email ? [h(order.email)] : undefined, ph: order.phone ? [h(`91${String(order.phone).slice(-10)}`)] : undefined,
      fn: fn ? [h(fn)] : undefined, ln: ln.length ? [h(ln.join(' '))] : undefined, ct: a.city ? [h(a.city.replace(/\s+/g, ''))] : undefined,
      st: a.state ? [h(a.state.replace(/\s+/g, ''))] : undefined, zp: a.pincode ? [h(a.pincode)] : undefined, country: [h('in')],
      external_id: order.user ? [h(String(order.user))] : undefined, client_ip_address: t.ip, client_user_agent: t.userAgent, fbp: t.fbp, fbc: t.fbc,
    },
    custom_data: {
      currency: 'INR', value: order.totals.total / 100, content_type: 'product', order_id: order.orderNumber,
      content_ids: order.items.map((i) => i.sku), num_items: order.items.reduce((s, i) => s + i.quantity, 0),
      contents: order.items.map((i) => ({ id: i.sku, quantity: i.quantity, item_price: i.unitPrice / 100 })),
    },
    _pixel: pixelId,
  };
}

export async function sendPurchase(orderId) {
  try {
    if (!env.META_CAPI_TOKEN) return;
    const order = await Order.findById(orderId);
    if (!order?.adTracking?.consent || order.adTracking.capiSentAt) return;
    const pixelId = (await getSettings()).analytics?.metaPixelId;
    if (!pixelId) return;
    const { _pixel, ...ev } = buildPurchaseEvent(order, pixelId);
    const body = { data: [ev], ...(env.META_TEST_EVENT_CODE ? { test_event_code: env.META_TEST_EVENT_CODE } : {}) };
    const r = await fetchJson(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${encodeURIComponent(_pixel)}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, { retries: 1 });
    if (!r.ok) throw new Error(r.body?.error?.message || `HTTP ${r.status}`);
    await Order.updateOne({ _id: order._id }, { $set: { 'adTracking.capiSentAt': new Date() }, $unset: { 'adTracking.capiError': 1 } });
  } catch (e) {
    logger.warn({ err: e.message }, 'Meta CAPI purchase failed');
    await Order.updateOne({ _id: orderId }, { $set: { 'adTracking.capiError': String(e.message).slice(0, 200) } }).catch(() => {});
  }
}
