import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true, unique: true },
  products: [{ type: mongoose.Types.ObjectId, ref: 'Product' }],
}, { timestamps: true });
export default mongoose.model('Wishlist', schema);
