import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  channel: { type: String, enum: ['email', 'sms', 'whatsapp'], required: true },
  kind: { type: String, enum: ['transactional', 'marketing'], default: 'transactional' },
  template: String,
  to: String, // masked
  user: { type: mongoose.Types.ObjectId, ref: 'User' },
  order: { type: mongoose.Types.ObjectId, ref: 'Order' },
  status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
  provider: String,
  providerMessageId: String,
  attempts: { type: Number, default: 0 },
  error: String,
}, { timestamps: true });
schema.index({ createdAt: -1 });
export default mongoose.model('Notification', schema);
