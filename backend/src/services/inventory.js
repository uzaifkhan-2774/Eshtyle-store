import { ProductVariant, Product } from '../models/index.js';
import { conflict } from '../lib/errors.js';

/** Atomically decrement stock for each line; roll back already-decremented lines if any line fails. Prevents overselling. */
export async function reserveStock(items) {
  const done = [];
  for (const it of items) {
    const r = await ProductVariant.updateOne({ _id: it.variant, isActive: true, stock: { $gte: it.quantity } }, { $inc: { stock: -it.quantity } });
    if (r.modifiedCount !== 1) {
      await releaseStock(done);
      throw conflict(`Sorry, "${it.name}${it.variantTitle && it.variantTitle !== 'Default' ? ' – ' + it.variantTitle : ''}" no longer has enough stock.`, 'OUT_OF_STOCK');
    }
    done.push(it);
  }
  await refreshProductStock([...new Set(items.map((i) => String(i.product)))]);
}
export async function releaseStock(items) {
  for (const it of items) await ProductVariant.updateOne({ _id: it.variant }, { $inc: { stock: it.quantity } });
  if (items.length) await refreshProductStock([...new Set(items.map((i) => String(i.product)))]);
}
/** Keep denormalised product fields (price-from, compareAt, inStock) in sync with variants. */
export async function refreshProductStock(productIds) {
  for (const id of productIds) {
    const vs = await ProductVariant.find({ product: id, isActive: true }).select('price compareAtPrice stock').lean();
    if (!vs.length) { await Product.updateOne({ _id: id }, { $set: { inStock: false } }); continue; }
    const min = vs.reduce((a, v) => (v.price < a.price ? v : a), vs[0]);
    await Product.updateOne({ _id: id }, { $set: { inStock: vs.some((v) => v.stock > 0), price: min.price, compareAtPrice: min.compareAtPrice && min.compareAtPrice > min.price ? min.compareAtPrice : null } });
  }
}
