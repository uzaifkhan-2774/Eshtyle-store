import mongoose from 'mongoose';

export const addressFields = {
  fullName: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, required: true, match: /^[6-9]\d{9}$/ },
  line1: { type: String, required: true, trim: true, maxlength: 160 },
  line2: { type: String, trim: true, maxlength: 160 },
  landmark: { type: String, trim: true, maxlength: 100 },
  city: { type: String, required: true, trim: true, maxlength: 60 },
  state: { type: String, required: true, trim: true, maxlength: 60 },
  pincode: { type: String, required: true, match: /^[1-9]\d{5}$/ },
  country: { type: String, default: 'India' },
};
const schema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, default: 'Home', maxlength: 30 },
  isDefault: { type: Boolean, default: false },
  ...addressFields,
}, { timestamps: true });
export default mongoose.model('Address', schema);
