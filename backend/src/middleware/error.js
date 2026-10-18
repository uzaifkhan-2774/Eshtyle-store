import mongoose from 'mongoose';
import { ZodError } from 'zod';
import logger from '../lib/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
}
// Never leak stack traces or internals to clients.
export function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request is too large.' } });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed request.' } });
  if (err instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION', message: err.issues[0]?.message || 'Invalid input.', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Please check the highlighted fields.', details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })) } });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: { code: 'BAD_ID', message: 'Invalid identifier.' } });
  if (err?.code === 11000) return res.status(409).json({ error: { code: 'DUPLICATE', message: 'A record with these details already exists.', fields: Object.keys(err.keyPattern || {}) } });
  if (err?.name === 'MulterError') return res.status(400).json({ error: { code: 'UPLOAD', message: err.message } });
  // express.static / sendFile: missing file → 404, never a 500.
  if ((err?.status === 404 || err?.statusCode === 404) && err?.syscall) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
  if (err?.expose && err.status) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  logger.error({ err, reqId: req.id, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.', requestId: req.id } });
}
