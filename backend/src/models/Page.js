import mongoose from 'mongoose';
// Campaign / landing pages managed from the admin.
const schema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  heroImage: { url: String, alt: String },
  intro: String,
  body: String,
  linkedCollection: { type: mongoose.Types.ObjectId, ref: 'Collection' },
  couponCode: String,
  isPublished: { type: Boolean, default: false },
  seo: { title: String, description: String },
}, { timestamps: true });
export default mongoose.model('Page', schema);
