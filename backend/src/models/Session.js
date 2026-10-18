import mongoose from 'mongoose';
// Refresh-token sessions. Only a peppered hash of the token is stored.
const schema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true },
  replacedBy: String,
  revokedAt: Date,
  userAgent: String,
  ip: String,
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('Session', schema);
