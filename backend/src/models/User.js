import mongoose from 'mongoose';

export const ROLES = ['customer', 'owner', 'manager', 'inventory', 'support'];
export const STAFF_ROLES = ['owner', 'manager', 'inventory', 'support'];

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 80 },
  email: { type: String, lowercase: true, trim: true, maxlength: 160 },
  phone: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
  passwordHash: { type: String, select: false },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  role: { type: String, enum: ROLES, default: 'customer', index: true },
  status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
  marketingConsent: { email: { type: Boolean, default: false }, sms: { type: Boolean, default: false }, whatsapp: { type: Boolean, default: false }, updatedAt: Date },
  lastLoginAt: Date,
  failedLogins: { type: Number, default: 0 },
  lockedUntil: Date,
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ createdAt: -1 });

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return { id: this._id, name: this.name, email: this.email, phone: this.phone, emailVerified: this.emailVerified, phoneVerified: this.phoneVerified, role: this.role, marketingConsent: this.marketingConsent, createdAt: this.createdAt };
};
export default mongoose.model('User', userSchema);
