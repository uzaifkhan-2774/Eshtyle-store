import { Router } from 'express';
import { Order, ProductVariant, Product, ReturnRequest, SupportTicket, Review } from '../../models/index.js';
import { ah } from '../../lib/errors.js';
import { requirePerm } from '../../middleware/auth.js';
import { integrations } from '../../config/env.js';
import env from '../../config/env.js';

const r = Router();
const REVENUE_STATUSES = ['confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered'];

r.get('/', requirePerm('dashboard'), ah(async (req, res) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 29 * 86400000);
  from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999);
  const orders = await Order.find({ placedAt: { $gte: from, $lte: to } }).select('status paymentStatus paymentMethod totals placedAt items.product items.name items.quantity items.lineTotal').lean();
  const revenueOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const sales = revenueOrders.reduce((s, o) => s + o.totals.total, 0);
  // Daily series (computed in app code so it runs on any MongoDB-compatible store).
  const days = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) days.push(d.toISOString().slice(0, 10));
  const byDay = Object.fromEntries(days.map((d) => [d, { date: d, sales: 0, orders: 0 }]));
  for (const o of revenueOrders) { const k = new Date(o.placedAt).toISOString().slice(0, 10); if (byDay[k]) { byDay[k].sales += o.totals.total; byDay[k].orders += 1; } }
  const prodAgg = {};
  for (const o of revenueOrders) for (const i of o.items) { const k = String(i.product); prodAgg[k] ||= { productId: k, name: i.name, units: 0, revenue: 0 }; prodAgg[k].units += i.quantity; prodAgg[k].revenue += i.lineTotal; }
  const count = (st) => orders.filter((o) => st.includes(o.status)).length;
  const lowStock = await ProductVariant.find({ isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).limit(20).lean().catch(async () => (await ProductVariant.find({ isActive: true, stock: { $lte: 3 } }).limit(20).lean()));
  const lowProducts = await Product.find({ _id: { $in: lowStock.map((v) => v.product) } }).select('name slug images').lean();
  const pm = new Map(lowProducts.map((p) => [String(p._id), p]));
  const [awaitingDispatch, pendingPayments, openReturns, openTickets, pendingReviews, recent, inventory] = await Promise.all([
    Order.countDocuments({ status: { $in: ['confirmed', 'processing'] } }),
    Order.countDocuments({ status: 'pending_payment' }),
    ReturnRequest.countDocuments({ status: { $in: ['requested', 'approved', 'pickup_scheduled', 'received'] } }),
    SupportTicket.countDocuments({ status: { $ne: 'resolved' } }),
    Review.countDocuments({ status: 'pending' }),
    Order.find().sort({ createdAt: -1 }).limit(8).select('orderNumber totals status paymentStatus paymentMethod placedAt shippingAddress.fullName').lean(),
    ProductVariant.find({ isActive: true }).select('stock price').lean(),
  ]);
  res.json({
    range: { from, to },
    kpis: { sales, orders: revenueOrders.length, aov: revenueOrders.length ? Math.round(sales / revenueOrders.length) : 0, cod: revenueOrders.filter((o) => o.paymentMethod === 'cod').length, prepaid: revenueOrders.filter((o) => o.paymentMethod === 'online').length },
    statusCounts: { delivered: count(['delivered']), cancelled: count(['cancelled']), returned: count(['returned', 'return_requested']), rto: count(['rto']), expired: count(['expired', 'payment_failed']) },
    queues: { awaitingDispatch, pendingPayments, openReturns, openTickets, pendingReviews },
    series: Object.values(byDay),
    bestsellers: Object.values(prodAgg).sort((a, b) => b.units - a.units).slice(0, 8),
    lowStock: lowStock.map((v) => ({ variantId: v._id, sku: v.sku, title: v.title, stock: v.stock, product: pm.get(String(v.product)) })),
    recent,
    inventory: { units: inventory.reduce((s, v) => s + v.stock, 0), retailValue: inventory.reduce((s, v) => s + v.stock * v.price, 0), skus: inventory.length, outOfStock: inventory.filter((v) => v.stock === 0).length },
    integrations: { ...integrations, paymentProvider: env.PAYMENT_PROVIDER },
  });
}));

// Which ads, sources and coupons bring orders (from UTM links, ad click ids and coupon codes).
r.get('/attribution', requirePerm('reports:read'), ah(async (req, res) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 29 * 86400000);
  const orders = await Order.find({ placedAt: { $gte: from, $lte: to }, status: { $in: REVENUE_STATUSES } }).select('totals attribution coupon paymentMethod user').lean();
  const group = (keyFn) => {
    const m = {};
    for (const o of orders) { const k = keyFn(o); m[k] ||= { key: k, orders: 0, revenue: 0, cod: 0 }; m[k].orders++; m[k].revenue += o.totals.total; if (o.paymentMethod === 'cod') m[k].cod++; }
    return Object.values(m).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  };
  const source = (o) => {
    const a = o.attribution || {};
    if (a.utmSource) return `${a.utmSource}${a.utmMedium ? ' / ' + a.utmMedium : ''}`;
    if (a.fbclid) return 'facebook / instagram (ad click)';
    if (a.gclid) return 'google (ad click)';
    return 'direct / organic';
  };
  res.json({
    range: { from, to }, totalOrders: orders.length,
    bySource: group(source), byCampaign: group((o) => o.attribution?.utmCampaign || '(no campaign)'),
    byAd: group((o) => o.attribution?.utmContent || '(no ad tag)'), byCoupon: group((o) => o.coupon?.code || '(no coupon)'),
  });
}));
export default r;
