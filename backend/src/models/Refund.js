import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  order: { type: mongoose.Types.ObjectId, ref: 'Order', required: true, index: true },
  payment: { type: mongoose.Types.ObjectId, ref: 'Payment' },
  returnRequest: { type: mongoose.Types.ObjectId, ref: 'ReturnRequest' },
  amount: { type: Number, required: true },
  reason: String,
  method: { type: String, enum: ['gateway', 'bank_transfer', 'upi', 'store_credit'], default: 'gateway' },
  providerRefundId: String,
  status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
  initiatedBy: { type: mongoose.Types.ObjectId, ref: 'User' },
  idempotencyKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });
export default mongoose.model('Refund', schema);
