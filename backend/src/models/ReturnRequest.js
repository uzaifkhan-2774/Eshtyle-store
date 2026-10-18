import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  order: { type: mongoose.Types.ObjectId, ref: 'Order', required: true, index: true },
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['return', 'exchange'], default: 'return' },
  items: [{ orderItem: mongoose.Types.ObjectId, quantity: Number, _id: false }],
  reason: { type: String, required: true, maxlength: 80 },
  comments: { type: String, maxlength: 1000 },
  photos: [String],
  // Unboxing / defect video recorded by the customer. Stored privately; staff watch it before approving.
  video: { key: String, size: Number, durationSec: Number, uploadedAt: Date },
  confirmations: { tagIntact: Boolean, unused: Boolean, originalPackaging: Boolean, unboxingVideo: Boolean },
  videoReviewedBy: { type: mongoose.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'pickup_scheduled', 'received', 'refunded', 'closed'], default: 'requested' },
  adminNote: String,
  refundAmount: Number,
}, { timestamps: true });
export default mongoose.model('ReturnRequest', schema);
