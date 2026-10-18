import { AuditLog } from '../models/index.js';
import logger from './logger.js';
export async function audit(req, action, entity, entityId, changes) {
  try {
    await AuditLog.create({ actor: req.user?._id, actorEmail: req.user?.email, action, entity, entityId: entityId ? String(entityId) : undefined, changes, ip: req.ip });
  } catch (e) { logger.warn({ err: e }, 'audit write failed'); }
}
