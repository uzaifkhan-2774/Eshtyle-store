import { Router } from 'express';
import express from 'express';
import { Payment, WebhookEvent, Shipment, Refund, Order } from '../models/index.js';
import { adapterByName } from '../services/payments/index.js';
import { markPaid, markPaymentFailed } from '../services/orderService.js';
import * as shiprocket from '../services/shipping/shiprocket.js';
import { applyTrackingUpdate } from '../services/shipmentService.js';
import logger from '../lib/logger.js';

const r = Router();
r.use(express.raw({ type: '*/*', limit: '1mb' }));

/** Store event id first (unique index) so each provider event is processed exactly once. */
async function once(provider, eventId, type, fn) {
  try { await WebhookEvent.create({ provider, eventId, type }); } catch (e) { if (e.code === 11000) return 'duplicate'; throw e; }
  try { await fn(); await WebhookEvent.updateOne({ provider, eventId }, { $set: { processedAt: new Date() } }); return 'processed'; } catch (e) {
    await WebhookEvent.deleteOne({ provider, eventId }); // allow provider retry
    throw e;
  }
}

for (const provider of ['razorpay', 'cashfree']) {
  r.post(`/${provider}`, async (req, res) => {
    const raw = req.body?.toString('utf8') || '';
    const adapter = adapterByName(provider);
    if (!adapter.verifyWebhook(raw, req.headers)) { logger.warn({ provider }, 'webhook signature rejected'); return res.status(401).json({ ok: false }); }
    let body; try { body = JSON.parse(raw); } catch { return res.status(400).json({ ok: false }); }
    const ev = adapter.parseWebhook(body, req.headers);
    try {
      const result = await once(provider, ev.eventId, ev.type, async () => {
        if (ev.status === 'paid' || ev.status === 'failed') {
          const pay = await Payment.findOne({ provider, providerOrderId: ev.providerOrderId });
          if (!pay) return;
          if (ev.status === 'paid') await markPaid(pay, { providerPaymentId: ev.providerPaymentId, method: ev.method, verifiedBy: 'webhook', amount: ev.amount });
          else await markPaymentFailed(pay, ev.failureReason);
        } else if (ev.status === 'refunded' && ev.providerRefundId) {
          const rf = await Refund.findOneAndUpdate({ providerRefundId: ev.providerRefundId }, { $set: { status: 'processed' } }, { new: true });
          if (rf) {
            const all = await Refund.find({ order: rf.order, status: 'processed' });
            const o = await Order.findById(rf.order);
            if (o && all.reduce((s, x) => s + x.amount, 0) >= o.totals.total) { o.paymentStatus = 'refunded'; await o.save(); }
          }
        }
      });
      res.json({ ok: true, result });
    } catch (e) {
      logger.error({ provider, err: e.message }, 'webhook processing failed');
      res.status(500).json({ ok: false });
    }
  });
}

r.post('/shiprocket', async (req, res) => {
  if (!shiprocket.verifyWebhook(req.headers)) return res.status(401).json({ ok: false });
  let b; try { b = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ ok: false }); }
  const awb = String(b.awb || '');
  const label = b.current_status || b.shipment_status;
  const eventId = `${awb}:${b.current_status_id || b.shipment_status_id}:${b.current_timestamp || b.updated_at || ''}`;
  try {
    await once('shiprocket', eventId, label, async () => {
      const s = await Shipment.findOne({ awb });
      if (!s) return;
      const events = (b.scans || []).map((e) => ({ status: e['sr-status-label'] || e.status, statusCode: String(e['sr-status'] ?? ''), location: e.location, activity: e.activity, at: e.date ? new Date(e.date) : null }));
      await applyTrackingUpdate(s, { statusLabel: label, events, source: 'webhook' });
    });
    res.json({ ok: true });
  } catch (e) { logger.error({ err: e.message }, 'shiprocket webhook failed'); res.status(500).json({ ok: false }); }
});
export default r;
