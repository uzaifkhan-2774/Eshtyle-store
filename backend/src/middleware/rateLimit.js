import { rateLimit } from 'express-rate-limit';
import { isTest } from '../config/env.js';

const make = (windowMs, limit, message) => rateLimit({
  windowMs, limit: isTest ? 10_000 : limit, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message } }),
});
export const apiLimiter = make(60_000, 300, 'Too many requests. Please slow down.');
export const authLimiter = make(15 * 60_000, 30, 'Too many sign-in attempts. Please try again in a few minutes.');
export const otpLimiter = make(15 * 60_000, 8, 'Too many code requests. Please try again later.');
export const checkoutLimiter = make(60_000, 20, 'Too many checkout attempts. Please wait a moment.');
export const uploadLimiter = make(60 * 60_000, 6, 'Too many uploads. Please try again in a while.');
