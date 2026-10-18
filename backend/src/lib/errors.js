export class AppError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}
export const badRequest = (m, details) => new AppError(400, m, 'BAD_REQUEST', details);
export const unauthorized = (m = 'Please sign in to continue.') => new AppError(401, m, 'UNAUTHORIZED');
export const forbidden = (m = 'You do not have permission to do that.') => new AppError(403, m, 'FORBIDDEN');
export const notFound = (m = 'Not found.') => new AppError(404, m, 'NOT_FOUND');
export const conflict = (m, code = 'CONFLICT') => new AppError(409, m, code);
export const tooMany = (m = 'Too many requests. Please try again later.') => new AppError(429, m, 'RATE_LIMITED');
export const unavailable = (m, code = 'NOT_CONFIGURED') => new AppError(503, m, code);

export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
