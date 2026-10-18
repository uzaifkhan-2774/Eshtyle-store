import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  placement: { type: String, enum: ['hero', 'promo', 'announcement', 'editorial', 'look'], required: true, index: true },
  seedKey: { type: String, index: true },
  title: String,
  subtitle: String,
  ctaLabel: String,
  ctaUrl: String,
  image: { url: String, thumb: String, alt: String },
  mobileImage: { url: String, alt: String },
  // 'look' banners: shoppable dots on the photo (x/y in % of the image).
  hotspots: [{ x: Number, y: Number, productSlug: String, label: String, _id: false }],
  theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
  startsAt: Date,
  endsAt: Date,
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
export default mongoose.model('Banner', schema);
