import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  product: { type: mongoose.Types.ObjectId, ref: 'Product', required: true, index: true },
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  order: { type: mongoose.Types.ObjectId, ref: 'Order', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String, maxlength: 100 },
  body: { type: String, maxlength: 2000 },
  authorName: String,
  verifiedPurchase: { type: Boolean, default: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  featured: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ product: 1, user: 1 }, { unique: true });
export default mongoose.model('Review', schema);
