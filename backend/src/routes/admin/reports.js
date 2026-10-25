import { Router } from 'express';
import { z } from 'zod';
import { stringify } from 'csv-stringify/sync';
import { Order, Refund, getSettings } from '../../models/index.js';
import { ah, badRequest } from '../../lib/errors.js';
import { requirePerm } from '../../middleware/auth.js';
import { audit } from '../../lib/audit.js';

/** Sales & GST register for the accountant. Amounts are in paise in JSON and in rupees in CSV.
 *  Counted: orders that were confirmed (paid or COD) and not cancelled / returned-to-origin. Dates are in IST. */
const r = Router();
const SALE_STATUSES = ['confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'return_requested', 'returned'];
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rs = (p) => (Math.round(p) / 100).toFixed(2);

async function register(q) {
  const { from, to } = z.object({ from: day, to: day }).parse(q);
  const start = new Date(`${from}T00:00:00+05:30`); const end = new Date(`${to}T23:59:59.999+05:30`);
  if (!(start <= end)) throw badRequest('“From” must be before “To”.');
  if (end - start > 370 * 86400e3) throw badRequest('Choose a period of up to one year.');
  const s = await getSettings();
  const home = (s.business?.address?.state || '').trim().toLowerCase();
  const orders = await Order.find({ placedAt: { $gte: start, $lte: end }, status: { $in: SALE_STATUSES }, orderNumber: { $exists: true }, totals: { $exists: true } }).sort({ placedAt: 1 }).lean();
  const rows = []; const hsn = {}; const states = {};
  const sum = { orders: 0, gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, shipping: 0, codFee: 0, total: 0, cod: 0, prepaid: 0 };
  for (const o of orders) {
    const t = o.totals; const state = o.shippingAddress?.state || '';
    const intra = home && state.trim().toLowerCase() === home;
    let taxable = 0, tax = 0;
    for (const i of o.items || []) {
      const lineTaxable = t.taxInclusive ? i.lineTotal - i.taxAmount : i.lineTotal;
      taxable += lineTaxable; tax += i.taxAmount || 0;
      const k = i.hsnCode || '(not set)';
      hsn[k] ||= { hsn: k, quantity: 0, taxable: 0, tax: 0, rate: i.taxRate }; hsn[k].quantity += i.quantity; hsn[k].taxable += lineTaxable; hsn[k].tax += i.taxAmount || 0;
    }
    const cgst = intra ? Math.floor(tax / 2) : 0; const sgst = intra ? tax - cgst : 0; const igst = intra ? 0 : tax;
    const st = (states[state || '(unknown)'] ||= { state: state || '(unknown)', orders: 0, taxable: 0, tax: 0, total: 0 });
    st.orders += 1; st.taxable += taxable; st.tax += tax; st.total += t.total;
    sum.orders++; sum.gross += t.subtotal; sum.discount += t.discount || 0; sum.taxable += taxable; sum.cgst += cgst; sum.sgst += sgst; sum.igst += igst;
    sum.shipping += t.shipping || 0; sum.codFee += t.codFee || 0; sum.total += t.total; if (o.paymentMethod === 'cod') sum.cod += t.total; else sum.prepaid += t.total;
    rows.push({ invoiceNumber: o.invoiceNumber || '', date: o.placedAt, orderNumber: o.orderNumber, channel: o.channel || 'website', customer: o.shippingAddress?.fullName || '', state, payment: o.paymentMethod === 'cod' ? 'COD' : 'Prepaid', status: o.status, taxable, cgst, sgst, igst, tax, shipping: t.shipping || 0, codFee: t.codFee || 0, discount: t.discount || 0, total: t.total });
  }
  const refunds = await Refund.find({ createdAt: { $gte: start, $lte: end }, status: { $ne: 'failed' } }).lean();
  const refunded = refunds.reduce((a, x) => a + x.amount, 0);
  return { from, to, homeState: s.business?.address?.state || '', gstin: s.business?.gstin || '', taxRate: s.tax.rate, summary: { ...sum, tax: sum.cgst + sum.sgst + sum.igst, refunds: refunded, refundCount: refunds.length, net: sum.total - refunded }, hsn: Object.values(hsn), states: Object.values(states).sort((a, b) => b.total - a.total), rows };
}

r.get('/sales', requirePerm('reports:read'), ah(async (req, res) => {
  const rep = await register(req.query);
  res.json({ ...rep, rows: rep.rows.slice(0, 500), rowCount: rep.rows.length });
}));
r.get('/sales.csv', requirePerm('reports:read'), ah(async (req, res) => {
  const rep = await register(req.query);
  const kind = req.query.kind === 'hsn' ? 'hsn' : 'invoices';
  const csv = kind === 'hsn'
    ? stringify([['HSN', 'GST rate %', 'Quantity', 'Taxable value (Rs)', 'GST (Rs)'], ...rep.hsn.map((h) => [h.hsn, h.rate, h.quantity, rs(h.taxable), rs(h.tax)])])
    : stringify([['Invoice no.', 'Order date', 'Order no.', 'Channel', 'Customer', 'Place of supply (state)', 'Payment', 'Status', 'Taxable value (Rs)', 'CGST (Rs)', 'SGST (Rs)', 'IGST (Rs)', 'Total GST (Rs)', 'Shipping (Rs)', 'COD fee (Rs)', 'Discount (Rs)', 'Order total (Rs)'],
      ...rep.rows.map((x) => [x.invoiceNumber, new Date(x.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }), x.orderNumber, x.channel, x.customer, x.state, x.payment, x.status, rs(x.taxable), rs(x.cgst), rs(x.sgst), rs(x.igst), rs(x.tax), rs(x.shipping), rs(x.codFee), rs(x.discount), rs(x.total)])]);
  await audit(req, 'report.export', 'Order', null, { kind, from: rep.from, to: rep.to, rows: rep.rows.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="eshtyle-${kind === 'hsn' ? 'hsn-summary' : 'sales-register'}-${rep.from}-to-${rep.to}.csv"`);
  res.send('﻿' + csv);
}));
export default r;
