import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,24}$/ },
  description: String,
  type: { type: String, enum: ['percent', 'flat', 'free_shipping'], required: true },
  value: { type: Number, default: 0, min: 0 }, // percent (0-100) or paise
  maxDiscount: { type: Number, min: 0 }, // paise cap for percent coupons
  minOrderValue: { type: Number, default: 0 }, // paise
  startsAt: Date,
  endsAt: Date,
  usageLimit: Number,
  perUserLimit: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  firstOrderOnly: { type: Boolean, default: false },
  categories: [{ type: mongoose.Types.ObjectId, ref: 'Category' }],
  campaign: String,
  // Personal coupon (e.g. the thank-you reward): only this customer can use it.
  assignedTo: { user: { type: mongoose.Types.ObjectId, ref: 'User' }, email: { type: String, lowercase: true, trim: true } },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
export default mongoose.model('Coupon', schema);
