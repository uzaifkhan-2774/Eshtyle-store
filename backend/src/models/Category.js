import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  slug: { type: String, required: true, unique: true, lowercase: true },
  parent: { type: mongoose.Types.ObjectId, ref: 'Category', default: null, index: true },
  description: { type: String, maxlength: 600 },
  image: { url: String, thumb: String, alt: String },
  sortOrder: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
  showInNav: { type: Boolean, default: true },
  seo: { title: String, description: String },
}, { timestamps: true });
schema.index({ isPublished: 1, sortOrder: 1 });
export default mongoose.model('Category', schema);
