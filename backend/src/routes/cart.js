import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { ProductVariant, Product, getSettings } from '../models/index.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { getCart, loadLines, serializeLine, sameLine } from '../services/cartService.js';
import { priceLines } from '../services/pricing.js';

const r = Router();
const oid = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

export async function cartView(req, res, cart, { paymentMethod } = {}) {
  const settings = await getSettings();
  const { lines, issues } = await loadLines(cart);
  const buyable = lines.filter((l) => !l.outOfStock);
  const priced = await priceLines(buyable, { settings, couponCode: cart?.couponCode, paymentMethod, user: req.user });
  const pm = new Map(priced.lines.map((l) => [String(l.itemId), l]));
  return {
    items: lines.map((l) => serializeLine(pm.get(String(l.itemId)) || l)),
    itemCount: buyable.reduce((s, l) => s + l.quantity, 0),
    totals: priced.totals, coupon: priced.coupon, couponError: priced.couponError, freeShippingThreshold: priced.freeShippingThreshold, cod: priced.cod, issues,
  };
}

r.get('/', ah(async (req, res) => {
  const cart = await getCart(req, res);
  res.json(await cartView(req, res, cart));
}));

r.post('/items', validate(z.object({ variantId: oid, quantity: z.number().int().min(1).max(10).default(1), designs: z.array(z.number().int().min(0).max(29)).max(6).optional() })), ah(async (req, res) => {
  const v = await ProductVariant.findOne({ _id: req.body.variantId, isActive: true }).lean();
  const p = v && (await Product.findOne({ _id: v.product, status: 'published' }).lean());
  if (!v || !p) throw notFound('This item is not available.');
  if (v.stock <= 0) throw badRequest('Sorry, this item is out of stock.');
  const need = p.designPick?.count || 0;
  let designs;
  if (need > 0) {
    designs = [...new Set(req.body.designs || [])].sort((a, b) => a - b);
    const available = p.images?.length || 0;
    if (designs.some((d) => d >= available)) throw badRequest('Please choose from the designs shown.');
    if (designs.length !== Math.min(need, available)) throw badRequest(`Please choose ${need} designs.`);
  }
  const cart = await getCart(req, res, { create: true });
  const existing = cart.items.find((i) => sameLine(i, v._id, designs));
  const desired = (existing?.quantity || 0) + req.body.quantity;
  const qty = Math.min(desired, v.stock, 10);
  if (existing) existing.quantity = qty; else cart.items.push({ product: p._id, variant: v._id, quantity: qty, designs });
  await cart.save();
  const view = await cartView(req, res, cart);
  res.status(201).json({ ...view, notice: qty < desired ? `Only ${qty} available — we've added the maximum.` : null });
}));

r.patch('/items/:itemId', validate(z.object({ quantity: z.number().int().min(0).max(10) })), ah(async (req, res) => {
  const cart = await getCart(req, res);
  const item = cart?.items.id(req.params.itemId);
  if (!item) throw notFound('Item not in bag.');
  if (req.body.quantity === 0) item.deleteOne();
  else {
    const v = await ProductVariant.findById(item.variant).lean();
    item.quantity = Math.min(req.body.quantity, v?.stock || 0, 10) || 1;
  }
  await cart.save();
  res.json(await cartView(req, res, cart));
}));
r.delete('/items/:itemId', ah(async (req, res) => {
  const cart = await getCart(req, res);
  const item = cart?.items.id(req.params.itemId);
  if (item) { item.deleteOne(); await cart.save(); }
  res.json(await cartView(req, res, cart));
}));
r.post('/coupon', validate(z.object({ code: z.string().trim().min(3).max(24) })), ah(async (req, res) => {
  const cart = await getCart(req, res, { create: true });
  cart.couponCode = req.body.code.toUpperCase();
  const view = await cartView(req, res, cart);
  if (view.couponError) throw badRequest(view.couponError);
  await cart.save();
  res.json(view);
}));
r.delete('/coupon', ah(async (req, res) => {
  const cart = await getCart(req, res);
  if (cart) { cart.couponCode = null; await cart.save(); }
  res.json(await cartView(req, res, cart));
}));
export default r;
