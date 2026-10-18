import mongoose from 'mongoose';
// One-time codes. The code itself is never stored — only an HMAC.
const schema = new mongoose.Schema({
  channel: { type: String, enum: ['email', 'sms'], required: true },
  purpose: { type: String, enum: ['verify_email', 'verify_phone', 'login', 'reset_password'], required: true },
  target: { type: String, required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  consumedAt: Date,
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ target: 1, purpose: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
export default mongoose.model('Otp', schema);
