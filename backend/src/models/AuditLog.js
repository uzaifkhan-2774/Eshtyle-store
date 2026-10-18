import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  actor: { type: mongoose.Types.ObjectId, ref: 'User' },
  actorEmail: String,
  action: { type: String, required: true },
  entity: String,
  entityId: String,
  changes: mongoose.Schema.Types.Mixed,
  ip: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ createdAt: -1 });
schema.index({ entity: 1, entityId: 1 });
export default mongoose.model('AuditLog', schema);
