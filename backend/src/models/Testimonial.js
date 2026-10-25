import mongoose from 'mongoose';
// Real customer feedback received outside the website (WhatsApp, Instagram, Meesho…), added by the owner
// with the customer's permission. Shown labelled with its source — never as a "verified purchase" review.
const schema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 60 },
  city: { type: String, maxlength: 60 },
  quote: { type: String, required: true, maxlength: 600 },
  rating: { type: Number, min: 1, max: 5 },
  source: { type: String, enum: ['whatsapp', 'instagram', 'meesho', 'nushop', 'website', 'in_person', 'other'], default: 'whatsapp' },
  productSlug: String,
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  consentConfirmed: { type: Boolean, required: true },
  addedBy: { type: mongoose.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
export default mongoose.model('Testimonial', schema);
