import { Cart, Product, ProductVariant } from '../models/index.js';
import { randomToken } from '../lib/crypto.js';
import { isProd } from '../config/env.js';
import env from '../config/env.js';

export const CART_COOKIE = 'esh_cart';

export async function getCart(req, res, { create = false } = {}) {
  if (req.user) {
    let cart = await Cart.findOne({ user: req.user._id });
    const guestToken = req.cookies?.[CART_COOKIE];
    if (guestToken) {
      const guest = await Cart.findOne({ guestToken });
      if (guest) {
        if (!cart) { guest.user = req.user._id; guest.guestToken = undefined; cart = await guest.save(); }
        else { mergeItems(cart, guest.items); if (!cart.couponCode && guest.couponCode) cart.couponCode = guest.couponCode; await cart.save(); await guest.deleteOne(); }
      }
      res.clearCookie(CART_COOKIE, { path: '/' });
    }
    if (!cart && create) cart = await Cart.create({ user: req.user._id, items: [] });
    return cart;
  }
  const token = req.cookies?.[CART_COOKIE];
  let cart = token ? await Cart.findOne({ guestToken: token }) : null;
  if (!cart && create) {
    const t = randomToken(24);
    cart = await Cart.create({ guestToken: t, items: [] });
    res.cookie(CART_COOKIE, t, { httpOnly: true, secure: isProd, sameSite: 'lax', domain: env.COOKIE_DOMAIN || undefined, maxAge: 60 * 24 * 3600 * 1000, path: '/' });
  }
  return cart;
}
export function mergeItems(cart, incoming) {
  for (const it of incoming) {
    const existing = cart.items.find((i) => String(i.variant) === String(it.variant));
    if (existing) existing.quantity = Math.min(10, existing.quantity + it.quantity);
    else cart.items.push({ product: it.product, variant: it.variant, quantity: it.quantity });
  }
}
/** Loads cart lines with fresh product/variant data, dropping anything no longer purchasable. */
export async function loadLines(cart) {
  if (!cart?.items?.length) return { lines: [], issues: [] };
  const variants = await ProductVariant.find({ _id: { $in: cart.items.map((i) => i.variant) } }).lean();
  const products = await Product.find({ _id: { $in: variants.map((v) => v.product) } }).lean();
  const pm = new Map(products.map((p) => [String(p._id), p]));
  const vm = new Map(variants.map((v) => [String(v._id), v]));
  const lines = []; const issues = [];
  for (const it of cart.items) {
    const v = vm.get(String(it.variant)); const p = v && pm.get(String(v.product));
    if (!v || !p || p.status !== 'published' || !v.isActive) { issues.push({ itemId: it._id, type: 'unavailable', message: 'An item in your bag is no longer available and was removed.' }); continue; }
    if (v.stock <= 0) { issues.push({ itemId: it._id, type: 'out_of_stock', message: `${p.name} is out of stock.`, name: p.name }); lines.push({ itemId: it._id, product: p, variant: v, quantity: it.quantity, outOfStock: true }); continue; }
    let q = it.quantity;
    if (q > v.stock) { q = v.stock; issues.push({ itemId: it._id, type: 'qty_reduced', message: `Only ${v.stock} left of ${p.name}. Quantity updated.` }); }
    lines.push({ itemId: it._id, product: p, variant: v, quantity: q });
  }
  return { lines, issues };
}
export function serializeLine(l) {
  const img = l.variant.images?.[0] || l.product.images?.[0];
  return {
    id: l.itemId, productId: l.product._id, variantId: l.variant._id, name: l.product.name, slug: l.product.slug, sku: l.variant.sku,
    variantTitle: l.variant.title, image: img?.thumb || img?.url, unitPrice: l.unitPrice ?? l.variant.price, compareAtPrice: l.variant.compareAtPrice,
    quantity: l.quantity, maxQuantity: Math.min(10, l.variant.stock), lineTotal: l.lineTotal ?? l.variant.price * l.quantity, lineDiscount: l.lineDiscount || 0, outOfStock: Boolean(l.outOfStock),
  };
}
