import { sendDeliveredEmail } from './loyalty.js';
import { Order, Shipment } from '../models/index.js';
import * as shiprocket from './shipping/shiprocket.js';
import { notifyEmail } from './notify/index.js';
import { badRequest, conflict, unavailable } from '../lib/errors.js';
import { pushStatus } from './orderService.js';
import logger from '../lib/logger.js';

const SHIPPABLE = ['confirmed', 'processing'];

/** Create (or resume) the forward shipment for an order. Duplicate-safe: one forward shipment per order. */
export async function createForwardShipment(order, { courierId, dims, by } = {}) {
  if (!shiprocket.isConfigured()) throw unavailable('Shiprocket is not configured. Add credentials in the server environment to create shipments.');
  if (!SHIPPABLE.includes(order.status) && order.status !== 'ready_to_ship') throw badRequest(`Order in status "${order.status}" cannot be shipped.`);
  if (order.paymentMethod === 'online' && order.paymentStatus !== 'paid') throw badRequest('Online orders can only ship after payment is verified.');

  const now = new Date();
  const lock = await Order.findOneAndUpdate({ _id: order._id, $or: [{ shipLockUntil: null }, { shipLockUntil: { $lt: now } }] }, { $set: { shipLockUntil: new Date(now.getTime() + 90000) } });
  if (!lock) throw conflict('Shipment creation is already in progress for this order. Please refresh in a moment.');
  try {
    return await createLocked(order, { courierId, dims, by });
  } finally {
    await Order.updateOne({ _id: order._id }, { $set: { shipLockUntil: null } });
  }
}

async function createLocked(order, { courierId, dims, by }) {
  let shipment = await Shipment.findOne({ order: order._id, kind: 'forward' });
  if (!shipment) {
    try { shipment = await Shipment.create({ order: order._id, kind: 'forward', status: 'creating' }); } catch (e) {
      if (e.code === 11000) throw conflict('A shipment is already being created for this order.');
      throw e;
    }
  }
  try {
    if (!shipment.providerShipmentId) {
      const r = await shiprocket.createOrder(order, dims);
      shipment.providerOrderId = r.providerOrderId; shipment.providerShipmentId = r.providerShipmentId; shipment.status = 'created';
      await shipment.save();
    }
    if (!shipment.awb) {
      const a = await shiprocket.assignAwb(shipment.providerShipmentId, courierId);
      Object.assign(shipment, { awb: a.awb, courierName: a.courierName, courierId: a.courierId, charges: a.charges, status: 'awb_assigned', trackingUrl: `https://shiprocket.co/tracking/${a.awb}` });
      await shipment.save();
    }
    if (!shipment.pickupScheduledAt) {
      const p = await shiprocket.generatePickup(shipment.providerShipmentId);
      shipment.pickupScheduledAt = p.scheduledAt; shipment.status = 'pickup_scheduled'; await shipment.save();
    }
    if (!shipment.labelUrl) {
      try { const l = await shiprocket.generateLabel(shipment.providerShipmentId); shipment.labelUrl = l.labelUrl; await shipment.save(); } catch (e) { logger.warn({ err: e.message }, 'label generation failed'); }
    }
    shipment.lastError = undefined; await shipment.save();
    order.shippingStatus = shipment.status;
    order.shipLockUntil = undefined;
    if (order.status !== 'ready_to_ship') pushStatus(order, 'ready_to_ship', `Shipment ${shipment.awb} via ${shipment.courierName}`, by);
    await order.save();
    return shipment;
  } catch (e) {
    shipment.lastError = String(e.message).slice(0, 300); await shipment.save();
    throw badRequest(`Shipment step failed: ${e.message}. You can retry — completed steps will not be repeated.`);
  }
}

/** Apply a tracking update (from webhook or polling). Only real courier statuses move the order forward. */
export async function applyTrackingUpdate(shipment, { statusLabel, events = [], source }) {
  const order = await Order.findById(shipment.order);
  if (!order) return;
  const known = new Set(shipment.events.map((e) => `${e.statusCode}|${e.at?.toISOString?.()}|${e.activity}`));
  for (const ev of events) {
    const k = `${ev.statusCode}|${ev.at?.toISOString?.()}|${ev.activity}`;
    if (!known.has(k)) { shipment.events.push({ ...ev, source }); known.add(k); }
  }
  const m = shiprocket.mapStatus(statusLabel);
  shipment.status = m.shipping;
  if (m.ndr) shipment.ndr = { active: true, reason: events[0]?.activity, attempts: (shipment.ndr?.attempts || 0) + 1, updatedAt: new Date() };
  if (m.rto) shipment.isRto = true;
  if (m.shipping === 'delivered') shipment.deliveredAt = shipment.deliveredAt || new Date();
  await shipment.save();
  order.shippingStatus = m.shipping;
  if (m.order && m.order !== order.status && !['cancelled', 'returned'].includes(order.status)) {
    const prev = order.status;
    pushStatus(order, m.order, `Courier: ${statusLabel}`);
    if (m.order === 'delivered' && order.paymentMethod === 'cod') order.paymentStatus = 'cod_collected';
    if (m.order === 'shipped' && prev !== 'shipped') notifyEmail('shipped', order.email, { order, shipment }, { order: order._id });
    if (m.order === 'out_for_delivery') notifyEmail('trackingUpdate', order.email, { order, status: 'Out for delivery today' }, { order: order._id });
    if (m.order === 'delivered') await sendDeliveredEmail(order);
  }
  await order.save();
}

export async function pollActiveShipments() {
  if (!shiprocket.isConfigured()) return 0;
  const active = await Shipment.find({ awb: { $exists: true, $ne: null }, status: { $nin: ['delivered', 'rto_delivered', 'cancelled'] } }).limit(100);
  for (const s of active) {
    try { const t = await shiprocket.trackAwb(s.awb); if (t.status) await applyTrackingUpdate(s, { statusLabel: t.status, events: t.events, source: 'poll' }); } catch (e) { logger.warn({ awb: s.awb, err: e.message }, 'tracking poll failed'); }
  }
  return active.length;
}
