import mongoose from 'mongoose';
// Used to make webhook processing idempotent: a provider event id is processed at most once.
const schema = new mongoose.Schema({
  provider: { type: String, required: true },
  eventId: { type: String, required: true },
  type: String,
  processedAt: Date,
  error: String,
}, { timestamps: true });
schema.index({ provider: 1, eventId: 1 }, { unique: true });
export default mongoose.model('WebhookEvent', schema);
