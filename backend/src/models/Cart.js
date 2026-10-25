import mongoose from 'mongoose';
const item = new mongoose.Schema({
  product: { type: mongoose.Types.ObjectId, ref: 'Product', required: true },
  variant: { type: mongoose.Types.ObjectId, ref: 'ProductVariant', required: true },
  quantity: { type: Number, required: true, min: 1, max: 10 },
  designs: { type: [Number], default: undefined }, // chosen photo indexes for pick-your-designs combos
  addedAt: { type: Date, default: Date.now },
}, { _id: true });
const schema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User' },
  guestToken: { type: String },
  items: [item],
  couponCode: { type: String, uppercase: true },
  abandonedNotifiedAt: Date,
}, { timestamps: true });
schema.index({ user: 1 }, { unique: true, sparse: true });
schema.index({ guestToken: 1 }, { unique: true, sparse: true });
schema.index({ updatedAt: 1 });
export default mongoose.model('Cart', schema);
