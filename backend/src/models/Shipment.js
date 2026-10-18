import mongoose from 'mongoose';
const event = new mongoose.Schema({ status: String, statusCode: String, location: String, activity: String, at: Date, source: String }, { _id: false });
const schema = new mongoose.Schema({
  order: { type: mongoose.Types.ObjectId, ref: 'Order', required: true, index: true },
  kind: { type: String, enum: ['forward', 'return'], default: 'forward' },
  provider: { type: String, default: 'shiprocket' },
  providerOrderId: String,
  providerShipmentId: { type: String, index: true },
  awb: { type: String, index: true },
  courierName: String,
  courierId: Number,
  labelUrl: String,
  manifestUrl: String,
  trackingUrl: String,
  pickupScheduledAt: Date,
  status: { type: String, default: 'created' },
  charges: Number,
  events: [event],
  ndr: { active: Boolean, reason: String, attempts: Number, updatedAt: Date },
  isRto: { type: Boolean, default: false },
  deliveredAt: Date,
  lastError: String,
}, { timestamps: true });
// Only one active forward shipment per order (duplicate prevention).
schema.index({ order: 1, kind: 1 }, { unique: true, partialFilterExpression: { kind: 'forward' } });
export default mongoose.model('Shipment', schema);
