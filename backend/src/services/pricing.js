import { Coupon, Order } from '../models/index.js';
import { badRequest } from '../lib/errors.js';

/**
 * Evaluates a coupon for a given set of priced lines. Returns { coupon, discount, freeShipping } or throws badRequest.
 * Money is in paise.
 */
export async function evaluateCoupon(code, lines, user) {
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim(), isActive: true });
  const now = new Date();
  if (!coupon) throw badRequest('This coupon code is not valid.');
  if (coupon.startsAt && coupon.startsAt > now) throw badRequest('This coupon is not active yet.');
  if (coupon.endsAt && coupon.endsAt < now) throw badRequest('This coupon has expired.');
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) throw badRequest('This coupon has reached its usage limit.');
  if (coupon.assignedTo?.user || coupon.assignedTo?.email) {
    if (!user) throw badRequest('Please sign in to use your personal coupon.');
    const mine = (coupon.assignedTo.user && String(coupon.assignedTo.user) === String(user._id)) || (coupon.assignedTo.email && user.email && coupon.assignedTo.email === String(user.email).toLowerCase());
    if (!mine) throw badRequest('This coupon belongs to another account.');
  }
  const eligible = coupon.categories?.length
    ? lines.filter((l) => coupon.categories.some((c) => String(c) === String(l.product.category) || String(c) === String(l.product.subcategory)))
    : lines;
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.lineSubtotal, 0);
  if (!eligibleSubtotal) throw badRequest('This coupon does not apply to the items in your bag.');
  const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
  if (subtotal < (coupon.minOrderValue || 0)) throw badRequest(`Add items worth ₹${((coupon.minOrderValue - subtotal) / 100).toFixed(0)} more to use this coupon.`);
  if (user && (coupon.perUserLimit || coupon.firstOrderOnly)) {
    const countable = { user: user._id, status: { $nin: ['cancelled', 'payment_failed', 'expired'] } };
    if (coupon.firstOrderOnly && (await Order.countDocuments(countable)) > 0) throw badRequest('This coupon is valid on your first order only.');
    if (coupon.perUserLimit && (await Order.countDocuments({ ...countable, 'coupon.code': coupon.code })) >= coupon.perUserLimit) throw badRequest('You have already used this coupon.');
  } else if (!user && (coupon.perUserLimit || coupon.firstOrderOnly)) {
    // Guests may preview the discount; it is re-validated after sign-in at checkout.
  }
  let discount = 0;
  if (coupon.type === 'percent') {
    discount = Math.floor((eligibleSubtotal * Math.min(coupon.value, 100)) / 100);
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else if (coupon.type === 'flat') discount = Math.min(coupon.value, eligibleSubtotal);
  return { coupon, discount, freeShipping: coupon.type === 'free_shipping', eligibleIds: new Set(eligible.map((l) => String(l.variant._id))) };
}

/**
 * Server-side totals. `lines` = [{ product, variant, quantity }] loaded from the DB — never from the client.
 */
export async function priceLines(lines, { settings, couponCode, paymentMethod, user, pincodeQuote } = {}) {
  const taxRate = settings.tax.rate;
  const inclusive = settings.tax.pricesIncludeTax;
  const priced = lines.map((l) => ({ ...l, unitPrice: l.variant.price, lineSubtotal: l.variant.price * l.quantity, lineDiscount: 0 }));
  const subtotal = priced.reduce((s, l) => s + l.lineSubtotal, 0);

  let couponResult = null;
  let couponError = null;
  if (couponCode) {
    try { couponResult = await evaluateCoupon(couponCode, priced, user); } catch (e) { couponError = e.message; }
  }
  const discount = couponResult?.discount || 0;
  // Allocate discount proportionally across eligible lines (largest remainder) so per-line tax is correct.
  if (discount) {
    const elig = priced.filter((l) => couponResult.eligibleIds.has(String(l.variant._id)));
    const base = elig.reduce((s, l) => s + l.lineSubtotal, 0);
    let allocated = 0;
    elig.forEach((l, i) => {
      l.lineDiscount = i === elig.length - 1 ? discount - allocated : Math.floor((discount * l.lineSubtotal) / base);
      allocated += l.lineDiscount;
    });
  }
  const afterDiscount = subtotal - discount;
  let shipping = 0;
  if (priced.length && !couponResult?.freeShipping && afterDiscount < settings.shipping.freeAbove) shipping = settings.shipping.flatRate;
  const codFee = paymentMethod === 'cod' && priced.length ? settings.cod.fee : 0;

  let tax = 0;
  for (const l of priced) {
    l.lineTotal = l.lineSubtotal - l.lineDiscount;
    l.taxRate = taxRate;
    l.taxAmount = inclusive ? Math.round((l.lineTotal * taxRate) / (100 + taxRate)) : Math.round((l.lineTotal * taxRate) / 100);
    tax += l.taxAmount;
  }
  const total = afterDiscount + shipping + codFee + (inclusive ? 0 : tax);
  const codEligibility = (() => {
    if (!settings.cod.enabled) return { ok: false, reason: 'Cash on Delivery is currently unavailable.' };
    if (priced.some((l) => l.product.codAvailable === false)) return { ok: false, reason: 'One or more items are not eligible for Cash on Delivery.' };
    if (afterDiscount > settings.cod.maxOrderValue) return { ok: false, reason: `Cash on Delivery is available for orders up to ₹${settings.cod.maxOrderValue / 100}.` };
    if (afterDiscount < (settings.cod.minOrderValue || 0)) return { ok: false, reason: 'Order value is below the COD minimum.' };
    if (pincodeQuote && pincodeQuote.codAvailable === false) return { ok: false, reason: 'Cash on Delivery is not available for this pincode.' };
    return { ok: true, fee: settings.cod.fee };
  })();

  return {
    lines: priced,
    totals: { subtotal, discount, shipping, codFee, tax, total, taxInclusive: inclusive, currency: 'INR' },
    coupon: couponResult ? { code: couponResult.coupon.code, type: couponResult.coupon.type, value: couponResult.coupon.value, campaign: couponResult.coupon.campaign, description: couponResult.coupon.description } : null,
    couponError,
    freeShippingThreshold: settings.shipping.freeAbove,
    cod: codEligibility,
  };
}
