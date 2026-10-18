import mongoose from 'mongoose';
// Short videos shown on the homepage: a landscape brand film and/or vertical shoppable reels.
const schema = new mongoose.Schema({
  title: { type: String, maxlength: 80 },
  caption: { type: String, maxlength: 200 },
  video: { url: { type: String, required: true }, poster: String, width: Number, height: Number, durationSec: Number },
  orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
  productSlugs: [{ type: String }],
  ctaLabel: String,
  ctaUrl: String,
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  seedKey: { type: String, index: true },
}, { timestamps: true });
export default mongoose.model('Reel', schema);
