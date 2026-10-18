import mongoose from 'mongoose';

const image = new mongoose.Schema({ url: { type: String, required: true }, thumb: String, alt: String, width: Number, height: Number, publicId: String }, { _id: false });

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 140 },
  slug: { type: String, required: true, unique: true, lowercase: true },
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
  category: { type: mongoose.Types.ObjectId, ref: 'Category', required: true, index: true },
  subcategory: { type: mongoose.Types.ObjectId, ref: 'Category', default: null },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  shortDescription: { type: String, maxlength: 300 },
  description: { type: String, maxlength: 5000 },
  images: [image],
  video: { url: String, poster: String },
  tags: [{ type: String, lowercase: true, trim: true }],
  jewelleryType: String,
  material: String,
  finish: String,
  colour: String,
  // Claims are explicit, opt-in, and should only be enabled when verified with the supplier.
  claims: {
    antiTarnish: { type: Boolean, default: false },
    hypoallergenic: { type: Boolean, default: false },
    waterResistant: { type: Boolean, default: false },
    note: String,
  },
  specifications: [{ label: String, value: String, _id: false }],
  dimensions: String,
  weightGrams: Number,
  packageContents: String,
  careInstructions: String,
  // Lowest variant price, denormalised for sorting/filtering. Maintained by services/catalog.
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  inStock: { type: Boolean, default: true, index: true },
  isFeatured: { type: Boolean, default: false },
  codAvailable: { type: Boolean, default: true },
  returnable: { type: Boolean, default: true },
  returnWindowDays: { type: Number, default: 7 },
  hsnCode: { type: String, default: '7117' },
  costPrice: { type: Number, min: 0 }, // stripped from responses unless the staff role has costs:read
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  salesCount: { type: Number, default: 0 },
  sortOrder: { type: Number, default: 0 },
  seo: { title: String, description: String },
  related: [{ type: mongoose.Types.ObjectId, ref: 'Product' }],
  isSampleData: { type: Boolean, default: false },
  priceReviewRequired: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ status: 1, category: 1, price: 1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ status: 1, salesCount: -1 });
schema.index({ tags: 1 });
schema.index({ name: 'text', tags: 'text', shortDescription: 'text' }, { weights: { name: 5, tags: 3 } });

export default mongoose.model('Product', schema);
