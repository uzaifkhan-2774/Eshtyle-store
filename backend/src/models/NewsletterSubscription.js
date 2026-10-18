import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed' },
  consentText: String,
  consentAt: Date,
  source: String,
  unsubscribeToken: { type: String, index: true },
  ip: String,
}, { timestamps: true });
export default mongoose.model('NewsletterSubscription', schema);
