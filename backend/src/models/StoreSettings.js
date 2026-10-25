import mongoose from 'mongoose';
// Returns are accepted only for these reasons (no change-of-mind returns).
export const RETURN_REASONS = ['Received damaged', 'Defective / broken piece', 'Wrong product received', 'Item missing from package'];

const schema = new mongoose.Schema({
  key: { type: String, default: 'store', unique: true },
  business: {
    name: { type: String, default: 'E-SHTYLE' },
    legalName: String, ownerName: String, gstin: String, pan: String,
    email: String, phone: String, whatsapp: String,
    address: { line1: String, line2: String, city: String, state: String, pincode: String },
    instagram: String, facebook: String, youtube: String,
  },
  announcement: { text: { type: String, default: '' }, link: String, isActive: { type: Boolean, default: false } },
  tax: { rate: { type: Number, default: 3 }, pricesIncludeTax: { type: Boolean, default: true }, invoicePrefix: { type: String, default: 'ESH' }, nextInvoiceNumber: { type: Number, default: 1 } },
  shipping: {
    flatRate: { type: Number, default: 0 }, // paise — shipping is free on every order; COD pays the COD fee below
    freeAbove: { type: Number, default: 0 }, // paise — 0 = free shipping on all orders
    estimateDaysMin: { type: Number, default: 3 },
    estimateDaysMax: { type: Number, default: 7 },
    defaultWeightGrams: { type: Number, default: 150 },
    blockedPincodes: [String],
  },
  cod: { enabled: { type: Boolean, default: true }, fee: { type: Number, default: 4900 }, maxOrderValue: { type: Number, default: 300000 }, minOrderValue: { type: Number, default: 0 } },
  returns: { windowDays: { type: Number, default: 7 }, policySummary: { type: String, default: '' }, requireVideo: { type: Boolean, default: true }, reasons: { type: [String], default: RETURN_REASONS } },
  orders: { reservationMinutes: { type: Number, default: 30 }, maxQtyPerItem: { type: Number, default: 10 } },
  seo: { defaultTitle: { type: String, default: 'E-SHTYLE — Everyday Elegance. Made to Shine.' }, defaultDescription: { type: String, default: 'Fashion jewellery from E-SHTYLE: earring combos, clover necklaces, tulip bracelets, rings and gift sets, delivered across India.' } },
  analytics: { gaMeasurementId: String, metaPixelId: String },
  // Thank-you reward: a personal next-order coupon emailed when an order is delivered.
  loyalty: { thankYouEnabled: { type: Boolean, default: true }, thankYouAmount: { type: Number, default: 7500 }, thankYouMinOrder: { type: Number, default: 49900 }, thankYouDays: { type: Number, default: 30 } },
  alerts: { lowStockSentAt: Date, lowStockSignature: String },
  catalogVersion: String,
  migrations: [String], // one-time store-setting changes already applied by the seed // version of seed/catalog.json last applied to this database
}, { timestamps: true });
export default mongoose.model('StoreSettings', schema);

export async function getSettings() {
  const S = mongoose.model('StoreSettings');
  let s = await S.findOne({ key: 'store' });
  if (!s) s = await S.create({ key: 'store' });
  return s;
}
