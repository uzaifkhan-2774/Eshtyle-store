import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  order: { type: mongoose.Types.ObjectId, ref: 'Order', required: true, index: true },
  provider: { type: String, enum: ['razorpay', 'cashfree', 'cod', 'manual'], required: true },
  providerOrderId: { type: String, index: true },
  providerPaymentId: { type: String, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded'], default: 'created' },
  method: String,
  failureReason: String,
  verifiedBy: { type: String, enum: ['signature', 'webhook', 'reconcile', null], default: null },
  raw: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });
export default mongoose.model('Payment', schema);
