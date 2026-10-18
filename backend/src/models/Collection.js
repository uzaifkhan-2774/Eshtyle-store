import mongoose from 'mongoose';
// Collections are either manual (hand-picked products) or smart (rule-based: new arrivals, bestsellers, sale, tag).
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  type: { type: String, enum: ['manual', 'new_arrivals', 'bestsellers', 'sale', 'tag'], default: 'manual' },
  tag: String,
  products: [{ type: mongoose.Types.ObjectId, ref: 'Product' }],
  description: String,
  image: { url: String, thumb: String, alt: String },
  isPublished: { type: Boolean, default: true },
  showInNav: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  seo: { title: String, description: String },
}, { timestamps: true });
export default mongoose.model('Collection', schema);
