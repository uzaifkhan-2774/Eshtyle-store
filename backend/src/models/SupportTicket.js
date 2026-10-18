import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true, maxlength: 80 },
  email: { type: String, required: true, maxlength: 160 },
  phone: String,
  orderNumber: String,
  subject: { type: String, maxlength: 120 },
  message: { type: String, required: true, maxlength: 3000 },
  status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open', index: true },
  notes: [{ by: { type: mongoose.Types.ObjectId, ref: 'User' }, text: String, at: { type: Date, default: Date.now }, _id: false }],
}, { timestamps: true });
export default mongoose.model('SupportTicket', schema);
