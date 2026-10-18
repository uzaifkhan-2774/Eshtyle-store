import { Router } from 'express';
import { z } from 'zod';
import { NewsletterSubscription, Order, Shipment, SupportTicket } from '../models/index.js';
import { ah, notFound } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { otpLimiter } from '../middleware/rateLimit.js';
import { randomToken, safeEqual } from '../lib/crypto.js';
import { notifyAdmin } from '../services/notify/index.js';
import { optionalAuth } from '../middleware/auth.js';

const r = Router();
const CONSENT_TEXT = 'I agree to receive emails from E-SHTYLE about new collections and offers. I can unsubscribe at any time.';

r.post('/newsletter', otpLimiter, validate(z.object({ email: z.string().trim().toLowerCase().email().max(160), consent: z.literal(true, { errorMap: () => ({ message: 'Please tick the consent box.' }) }), source: z.string().max(40).optional() })), ah(async (req, res) => {
  await NewsletterSubscription.findOneAndUpdate({ email: req.body.email }, { $set: { status: 'subscribed', consentText: CONSENT_TEXT, consentAt: new Date(), source: req.body.source || 'footer', ip: req.ip }, $setOnInsert: { unsubscribeToken: randomToken(18) } }, { upsert: true });
  res.json({ ok: true, message: 'Thank you for subscribing.' });
}));
r.get('/newsletter/unsubscribe', ah(async (req, res) => {
  const t = String(req.query.token || '');
  const s = t && (await NewsletterSubscription.findOneAndUpdate({ unsubscribeToken: t }, { $set: { status: 'unsubscribed' } }));
  res.json({ ok: Boolean(s) });
}));

r.post('/contact', otpLimiter, optionalAuth, validate(z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(160), phone: z.string().trim().max(15).optional(), orderNumber: z.string().trim().max(30).optional(), subject: z.string().trim().max(120).optional(), message: z.string().trim().min(10).max(3000) })), ah(async (req, res) => {
  const t = await SupportTicket.create({ ...req.body, user: req.user?._id });
  notifyAdmin('trackingUpdate', { order: { orderNumber: `Support #${String(t._id).slice(-6)}` }, status: `New message from ${req.body.name}: ${req.body.subject || ''}` });
  res.status(201).json({ ok: true, message: 'Thank you — our team will reply within 1–2 working days.' });
}));

// Public order tracking: requires order number + the phone or email on the order.
r.get('/track', otpLimiter, ah(async (req, res) => {
  const orderNumber = String(req.query.order || '').trim().toUpperCase();
  const contact = String(req.query.contact || '').trim().toLowerCase();
  const o = orderNumber && (await Order.findOne({ orderNumber }).lean());
  const matches = o && contact && (safeEqual((o.phone || '').slice(-10), contact.slice(-10)) || safeEqual(o.shippingAddress?.phone || '', contact.slice(-10)) || safeEqual((o.email || '').toLowerCase(), contact));
  if (!matches) throw notFound('We could not find an order with those details.');
  const s = await Shipment.findOne({ order: o._id, kind: 'forward' }).lean();
  res.json({
    orderNumber: o.orderNumber, status: o.status, shippingStatus: o.shippingStatus, placedAt: o.placedAt, itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
    history: o.statusHistory.map((h) => ({ status: h.status, at: h.at })),
    shipment: s ? { courierName: s.courierName, awb: s.awb, trackingUrl: s.trackingUrl, status: s.status, events: s.events.slice(-20) } : null,
  });
}));
export default r;
