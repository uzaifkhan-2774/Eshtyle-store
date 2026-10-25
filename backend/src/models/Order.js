import mongoose from 'mongoose';
import { addressFields } from './Address.js';

export const ORDER_STATUSES = ['pending_payment', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'return_requested', 'returned', 'rto', 'payment_failed', 'expired'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cod_pending', 'cod_collected', 'refund_pending', 'partially_refunded', 'refunded'];

const addr = new mongoose.Schema({ ...addressFields }, { _id: false });
// OrderItem: an immutable snapshot of what was bought, at the price it was bought.
const orderItem = new mongoose.Schema({
  product: { type: mongoose.Types.ObjectId, ref: 'Product' },
  variant: { type: mongoose.Types.ObjectId, ref: 'ProductVariant' },
  name: String, slug: String, sku: String, variantTitle: String, image: String, hsnCode: String,
  unitPrice: Number, compareAtPrice: Number, quantity: Number,
  lineSubtotal: Number, lineDiscount: Number, lineTotal: Number, taxRate: Number, taxAmount: Number,
  returnable: Boolean, returnWindowDays: Number,
  designs: { type: [{ index: Number, label: String, image: String, _id: false }], default: undefined },
}, { _id: true });

const statusEvent = new mongoose.Schema({ status: String, note: String, by: { type: mongoose.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }, { _id: false });

const schema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  user: { type: mongoose.Types.ObjectId, ref: 'User', index: true },
  email: String,
  phone: String,
  items: [orderItem],
  shippingAddress: addr,
  billingAddress: addr,
  totals: {
    subtotal: Number, discount: Number, shipping: Number, codFee: Number, tax: Number, total: Number,
    taxInclusive: Boolean, currency: { type: String, default: 'INR' },
  },
  coupon: { code: String, type: { type: String }, value: Number, campaign: String },
  paymentMethod: { type: String, enum: ['online', 'cod'], required: true },
  paymentProvider: String,
  status: { type: String, enum: ORDER_STATUSES, default: 'pending_payment', index: true },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
  shippingStatus: { type: String, default: 'not_shipped', index: true },
  statusHistory: [statusEvent],
  stockReserved: { type: Boolean, default: false },
  reservationExpiresAt: Date,
  idempotencyKey: { type: String },
  attribution: { utmSource: String, utmMedium: String, utmCampaign: String, utmContent: String, fbclid: String, gclid: String, landingPage: String },
  // Ad-measurement data, stored only when the shopper accepted marketing cookies.
  adTracking: { consent: Boolean, fbp: String, fbc: String, ip: String, userAgent: String, sourceUrl: String, capiSentAt: Date, capiError: String },
  notes: String,
  thankYouCoupon: String, // personal next-order code issued when this order was delivered
  // Where the order came from. 'website' for normal checkout; others are entered by staff from Admin → New order.
  channel: { type: String, enum: ['website', 'whatsapp', 'instagram', 'phone', 'store', 'other'], default: 'website', index: true },
  createdBy: { type: mongoose.Types.ObjectId, ref: 'User' },
  invoiceNumber: String,
  shipLockUntil: Date, // short-lived mutex so concurrent "Ship" clicks cannot create two shipments
  cancelReason: String,
  placedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ user: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
schema.index({ createdAt: -1 });
schema.index({ status: 1, reservationExpiresAt: 1 });
schema.index({ phone: 1 });
export default mongoose.model('Order', schema);
