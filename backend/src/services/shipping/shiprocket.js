// Shiprocket adapter — https://apidocs.shiprocket.in/
import env, { integrations } from '../../config/env.js';
import { fetchJson } from '../../lib/util.js';
import { safeEqual } from '../../lib/crypto.js';
import { unavailable } from '../../lib/errors.js';
import logger from '../../lib/logger.js';

let tokenCache = { token: null, exp: 0 };
export const isConfigured = () => integrations.shiprocket;

async function token() {
  if (!isConfigured()) throw unavailable('Shiprocket is not configured. Add SHIPROCKET_* variables on the server.');
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const r = await fetchJson(`${env.SHIPROCKET_BASE_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }) }, { retries: 1 });
  if (!r.ok || !r.body.token) throw new Error(`Shiprocket auth failed (${r.status})`);
  tokenCache = { token: r.body.token, exp: Date.now() + 9 * 24 * 3600 * 1000 }; // tokens are valid 10 days
  return tokenCache.token;
}
async function call(path, { method = 'GET', body, retries } = {}) {
  const t = await token();
  const r = await fetchJson(`${env.SHIPROCKET_BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, { retries: retries ?? (method === 'GET' ? 2 : 0) });
  if (r.status === 401) { tokenCache = { token: null, exp: 0 }; }
  if (!r.ok) {
    const msg = r.body?.message || JSON.stringify(r.body?.errors || {}).slice(0, 200) || r.status;
    const e = new Error(`Shiprocket ${path} failed: ${msg}`); e.status = r.status; throw e;
  }
  return r.body;
}

export async function serviceability({ pincode, weightKg = 0.15, cod = true }) {
  const q = new URLSearchParams({ pickup_postcode: env.SHIPROCKET_PICKUP_PINCODE || '', delivery_postcode: pincode, weight: String(weightKg), cod: cod ? '1' : '0' });
  const b = await call(`/courier/serviceability/?${q}`);
  const couriers = b?.data?.available_courier_companies || [];
  if (!couriers.length) return { serviceable: false, couriers: [] };
  const sorted = couriers.map((c) => ({ id: c.courier_company_id, name: c.courier_name, rate: Math.round(Number(c.rate) * 100), etd: c.etd, etdDays: Number(c.estimated_delivery_days) || null, cod: c.cod === 1, rating: c.rating }))
    .sort((a, b2) => a.rate - b2.rate);
  return { serviceable: true, codAvailable: sorted.some((c) => c.cod), couriers: sorted, recommendedCourierId: b?.data?.recommended_courier_company_id };
}

export async function createOrder(order, { lengthCm = 10, breadthCm = 10, heightCm = 5, weightKg = 0.2 } = {}) {
  const a = order.shippingAddress;
  const [first, ...rest] = a.fullName.split(' ');
  const body = {
    order_id: order.orderNumber, order_date: new Date(order.placedAt).toISOString().slice(0, 16).replace('T', ' '),
    pickup_location: env.SHIPROCKET_PICKUP_LOCATION,
    billing_customer_name: first, billing_last_name: rest.join(' ') || '.', billing_address: a.line1, billing_address_2: [a.line2, a.landmark].filter(Boolean).join(', '),
    billing_city: a.city, billing_pincode: a.pincode, billing_state: a.state, billing_country: 'India', billing_email: order.email || '', billing_phone: a.phone,
    shipping_is_billing: true,
    order_items: order.items.map((i) => ({ name: `${i.name}${i.variantTitle && i.variantTitle !== 'Default' ? ' - ' + i.variantTitle : ''}`.slice(0, 100), sku: i.sku, units: i.quantity, selling_price: i.unitPrice / 100, hsn: i.hsnCode || '7117' })),
    payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    shipping_charges: (order.totals.shipping || 0) / 100, total_discount: (order.totals.discount || 0) / 100,
    sub_total: (order.totals.total - (order.totals.shipping || 0) - (order.totals.codFee || 0)) / 100,
    length: lengthCm, breadth: breadthCm, height: heightCm, weight: weightKg,
  };
  const b = await call('/orders/create/adhoc', { method: 'POST', body });
  return { providerOrderId: String(b.order_id), providerShipmentId: String(b.shipment_id), status: b.status };
}
export async function assignAwb(shipmentId, courierId) {
  const b = await call('/courier/assign/awb', { method: 'POST', body: { shipment_id: shipmentId, ...(courierId ? { courier_id: courierId } : {}) } });
  const d = b?.response?.data || {};
  if (!d.awb_code) throw new Error(`AWB not assigned: ${b?.message || 'unknown reason'}`);
  return { awb: d.awb_code, courierName: d.courier_name, courierId: d.courier_company_id, charges: d.applied_weight_amount ? Math.round(Number(d.applied_weight_amount) * 100) : undefined };
}
export async function generatePickup(shipmentId) {
  const b = await call('/courier/generate/pickup', { method: 'POST', body: { shipment_id: [shipmentId] } });
  return { scheduledAt: b?.response?.pickup_scheduled_date ? new Date(b.response.pickup_scheduled_date) : new Date(), raw: b?.response };
}
export async function generateLabel(shipmentId) {
  const b = await call('/courier/generate/label', { method: 'POST', body: { shipment_id: [shipmentId] } });
  if (!b.label_created) throw new Error('Label not generated');
  return { labelUrl: b.label_url };
}
export async function generateManifest(shipmentId) {
  const b = await call('/manifests/generate', { method: 'POST', body: { shipment_id: [shipmentId] } });
  return { manifestUrl: b.manifest_url };
}
export async function trackAwb(awb) {
  const b = await call(`/courier/track/awb/${encodeURIComponent(awb)}`);
  const td = b?.tracking_data || {};
  return {
    status: td.shipment_track?.[0]?.current_status || null, trackUrl: td.track_url,
    events: (td.shipment_track_activities || []).map((e) => ({ status: e['sr-status-label'] || e.status, statusCode: String(e['sr-status'] ?? ''), location: e.location, activity: e.activity, at: e.date ? new Date(e.date) : null, source: 'poll' })),
  };
}
export async function cancelOrders(providerOrderIds) {
  return call('/orders/cancel', { method: 'POST', body: { ids: providerOrderIds.map(Number) } });
}
export async function createReturn(order, items, business = {}) {
  const a = order.shippingAddress;
  const w = business.address || {};
  if (!w.line1 || !w.city || !w.state || !w.pincode || !business.phone) throw Object.assign(new Error('Add your business address and phone in Admin → Settings before creating return pickups.'), { status: 400, expose: true, code: 'NO_RETURN_ADDRESS' });
  const body = {
    order_id: `${order.orderNumber}-R${Date.now().toString().slice(-4)}`, order_date: new Date().toISOString().slice(0, 10),
    pickup_customer_name: a.fullName, pickup_address: a.line1, pickup_address_2: a.line2 || '', pickup_city: a.city, pickup_state: a.state, pickup_country: 'India', pickup_pincode: a.pincode, pickup_email: order.email || '', pickup_phone: a.phone,
    shipping_customer_name: business.name || 'E-SHTYLE', shipping_address: w.line1, shipping_address_2: w.line2 || '', shipping_city: w.city, shipping_country: 'India', shipping_pincode: w.pincode, shipping_state: w.state, shipping_phone: String(business.phone).replace(/\D/g, '').slice(-10),
    order_items: items.map((i) => ({ name: i.name, sku: i.sku, units: i.quantity, selling_price: i.unitPrice / 100 })),
    payment_method: 'Prepaid', sub_total: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) / 100, length: 10, breadth: 10, height: 5, weight: 0.2,
  };
  const b = await call('/orders/create/return', { method: 'POST', body });
  return { providerOrderId: String(b.order_id), providerShipmentId: String(b.shipment_id) };
}

// Webhook auth: Shiprocket sends the token you configure in Settings → API → Webhooks as the x-api-key header.
export function verifyWebhook(headers) {
  if (!env.SHIPROCKET_WEBHOOK_TOKEN) return false;
  return safeEqual(headers['x-api-key'] || '', env.SHIPROCKET_WEBHOOK_TOKEN);
}

// Map Shiprocket shipment statuses onto our order/shipping lifecycle.
export function mapStatus(label = '') {
  const s = String(label).toUpperCase();
  if (s.includes('RTO') && s.includes('DELIVERED')) return { shipping: 'rto_delivered', order: 'rto', rto: true };
  if (s.includes('RTO')) return { shipping: 'rto_in_transit', order: 'rto', rto: true };
  if (s === 'DELIVERED') return { shipping: 'delivered', order: 'delivered' };
  if (s.includes('OUT FOR DELIVERY')) return { shipping: 'out_for_delivery', order: 'out_for_delivery' };
  if (s.includes('UNDELIVERED') || s.includes('NDR') || s.includes('FAILED DELIVERY')) return { shipping: 'ndr', order: null, ndr: true };
  if (s.includes('PICKED UP') || s.includes('IN TRANSIT') || s.includes('SHIPPED') || s.includes('REACHED')) return { shipping: 'in_transit', order: 'shipped' };
  if (s.includes('PICKUP')) return { shipping: 'pickup_scheduled', order: 'ready_to_ship' };
  if (s.includes('CANCEL')) return { shipping: 'cancelled', order: null };
  if (s.includes('LOST') || s.includes('DAMAGED')) return { shipping: 'exception', order: null };
  return { shipping: s.toLowerCase().replace(/\s+/g, '_') || 'unknown', order: null };
}
export function logConfigStatus() {
  if (!isConfigured()) logger.warn('Shiprocket not configured — shipping uses store rules for estimates and shipment creation is disabled.');
}
