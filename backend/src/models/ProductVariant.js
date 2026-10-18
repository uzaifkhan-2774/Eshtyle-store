import mongoose from 'mongoose';
const image = new mongoose.Schema({ url: String, thumb: String, alt: String, width: Number, height: Number, publicId: String }, { _id: false });
const schema = new mongoose.Schema({
  product: { type: mongoose.Types.ObjectId, ref: 'Product', required: true, index: true },
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
  title: { type: String, default: 'Default' },
  options: { colour: String, size: String, design: String, finish: String, quantity: String },
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  costPrice: { type: Number, min: 0 }, // stripped from responses unless the staff role has costs:read
  stock: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, default: 3 },
  images: [image],
  weightGrams: Number,
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ product: 1, sortOrder: 1 });
schema.index({ stock: 1 });
export default mongoose.model('ProductVariant', schema);
