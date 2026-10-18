import jwt from 'jsonwebtoken';
import env, { isProd } from '../config/env.js';
import { User } from '../models/index.js';
import { unauthorized, forbidden } from '../lib/errors.js';

export const ACCESS_COOKIE = 'esh_at';
export const REFRESH_COOKIE = 'esh_rt';
export const ACCESS_TTL_SEC = 15 * 60;

export const cookieBase = () => ({ httpOnly: true, secure: isProd, sameSite: 'lax', domain: env.COOKIE_DOMAIN || undefined });

export function signAccess(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC, issuer: 'eshtyle' });
}

async function resolveUser(req) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'eshtyle' });
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') return null;
    return user;
  } catch {
    return null;
  }
}

export async function optionalAuth(req, _res, next) {
  try { req.user = await resolveUser(req); next(); } catch (e) { next(e); }
}
export async function requireAuth(req, _res, next) {
  try {
    req.user = await resolveUser(req);
    if (!req.user) return next(unauthorized());
    next();
  } catch (e) { next(e); }
}

// Role → permission matrix. Financial and sensitive operations are restricted.
export const PERMISSIONS = {
  owner: ['*'],
  manager: ['dashboard', 'products:read', 'products:write', 'inventory:write', 'categories:write', 'orders:read', 'orders:write', 'shipping:write', 'refunds:write', 'returns:write', 'customers:read', 'customers:write', 'marketing:write', 'reviews:write', 'reports:read', 'settings:read', 'audit:read', 'costs:read'],
  inventory: ['dashboard', 'products:read', 'products:write', 'inventory:write', 'orders:read', 'shipping:write'],
  support: ['dashboard', 'orders:read', 'orders:notes', 'returns:write', 'customers:read', 'reviews:write', 'products:read'],
  customer: [],
};
export const can = (role, perm) => {
  const p = PERMISSIONS[role] || [];
  return p.includes('*') || p.includes(perm);
};
export const requirePerm = (perm) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!can(req.user.role, perm)) return next(forbidden());
  next();
};
export const requireStaff = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role === 'customer') return next(forbidden());
  next();
};
