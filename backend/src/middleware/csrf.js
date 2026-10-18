import { randomToken, safeEqual } from '../lib/crypto.js';
import { isProd } from '../config/env.js';
import env from '../config/env.js';
import { forbidden } from '../lib/errors.js';

export const CSRF_COOKIE = 'esh_csrf';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// Double-submit cookie: the SPA reads esh_csrf and echoes it in X-CSRF-Token on every mutating request.
export function issueCsrf(req, res) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = randomToken(24);
    res.cookie(CSRF_COOKIE, token, { httpOnly: false, secure: isProd, sameSite: 'lax', domain: env.COOKIE_DOMAIN || undefined, maxAge: 7 * 24 * 3600 * 1000 });
  }
  return token;
}
export function csrfProtect(req, res, next) {
  if (SAFE.has(req.method)) { issueCsrf(req, res); return next(); }
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get('x-csrf-token');
  if (!cookie || !header || !safeEqual(cookie, header)) return next(forbidden('Security check failed. Please refresh the page and try again.'));
  next();
}
