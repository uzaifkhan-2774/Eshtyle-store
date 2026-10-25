import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/index.js';
import { ah, unauthorized, forbidden, badRequest, tooMany } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';
import { issueCsrf } from '../middleware/csrf.js';
import { hashPassword, verifyPassword, dummyVerify, issueSession, rotateSession, endSession, revokeAllSessions, createAndSendOtp, verifyOtp } from '../services/authService.js';
import { notifyEmail } from '../services/notify/index.js';
import { getCart } from '../services/cartService.js';

const r = Router();
const email = z.string().trim().toLowerCase().email().max(160);
const password = z.string().min(8, 'Use at least 8 characters.').max(128).refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and numbers.');
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.');
const code = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.');
const GENERIC_SENT = { ok: true, message: 'If the details are valid, we have sent a 6-digit code.' };

r.get('/csrf', (req, res) => res.json({ csrfToken: issueCsrf(req, res) }));

r.post('/register', authLimiter, validate(z.object({ name: z.string().trim().min(2).max(80), email, password, marketingConsent: z.boolean().optional().default(false) })), ah(async (req, res) => {
  const { name, email: em, password: pw, marketingConsent } = req.body;
  const existing = await User.findOne({ email: em });
  if (existing) {
    // Do not reveal that the account exists. If it is unverified, resend a verification code.
    if (!existing.emailVerified) await createAndSendOtp({ channel: 'email', target: em, purpose: 'verify_email' }).catch(() => {});
    return res.status(202).json({ ...GENERIC_SENT, next: 'verify_email' });
  }
  await User.create({ name, email: em, passwordHash: await hashPassword(pw), marketingConsent: { email: marketingConsent, updatedAt: new Date() } });
  await createAndSendOtp({ channel: 'email', target: em, purpose: 'verify_email' });
  res.status(202).json({ ...GENERIC_SENT, next: 'verify_email' });
}));

r.post('/verify-email', authLimiter, validate(z.object({ email, code })), ah(async (req, res) => {
  await verifyOtp({ target: req.body.email, purpose: 'verify_email', code: req.body.code });
  const user = await User.findOne({ email: req.body.email });
  if (!user) throw badRequest('This code is invalid or has expired.');
  const firstTime = !user.emailVerified;
  user.emailVerified = true; await user.save();
  await issueSession(res, user, req);
  req.user = user; await getCart(req, res);
  if (firstTime) notifyEmail('welcome', user.email, { name: user.name }, { user: user._id });
  res.json({ user: user.toSafeJSON() });
}));

r.post('/login', authLimiter, validate(z.object({ email, password: z.string().min(1).max(128) })), ah(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  const fail = () => unauthorized('Incorrect email or password.');
  if (!user || !user.passwordHash || user.status !== 'active') { await dummyVerify(req.body.password); throw fail(); }
  if (user.lockedUntil && user.lockedUntil > new Date()) throw tooMany(`Too many wrong attempts. Please try again in ${Math.ceil((user.lockedUntil - Date.now()) / 60000)} minutes, or reset your password.`);
  if (!(await verifyPassword(user.passwordHash, req.body.password))) {
    user.failedLogins += 1;
    if (user.failedLogins >= 8) { user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); user.failedLogins = 0; }
    await user.save(); throw fail();
  }
  if (!user.emailVerified) {
    await createAndSendOtp({ channel: 'email', target: user.email, purpose: 'verify_email' }).catch(() => {});
    return res.status(403).json({ error: { code: 'EMAIL_UNVERIFIED', message: 'Please verify your email. We have sent you a new code.' } });
  }
  await issueSession(res, user, req);
  req.user = user; await getCart(req, res);
  res.json({ user: user.toSafeJSON() });
}));

// Phone OTP sign-in (creates a customer account on first successful verification).
r.post('/otp/request', otpLimiter, validate(z.object({ channel: z.enum(['sms', 'email']), target: z.string().trim().max(160), purpose: z.enum(['login', 'verify_email']) })), ah(async (req, res) => {
  const { channel, purpose } = req.body;
  const target = channel === 'sms' ? phone.parse(req.body.target) : email.parse(req.body.target);
  const r2 = await createAndSendOtp({ channel, target, purpose });
  res.status(202).json({ ...GENERIC_SENT, ...r2 });
}));
r.post('/otp/verify', authLimiter, validate(z.object({ channel: z.enum(['sms', 'email']), target: z.string().trim(), code, name: z.string().trim().max(80).optional() })), ah(async (req, res) => {
  const { channel, code: c } = req.body;
  const target = channel === 'sms' ? phone.parse(req.body.target) : email.parse(req.body.target);
  await verifyOtp({ target, purpose: 'login', code: c });
  const q = channel === 'sms' ? { phone: target } : { email: target };
  let user = await User.findOne(q);
  if (user && user.status !== 'active') throw forbidden('This account is not active. Please contact support.');
  if (!user) user = await User.create({ ...q, name: req.body.name, ...(channel === 'sms' ? { phoneVerified: true } : { emailVerified: true }) });
  else { if (channel === 'sms') user.phoneVerified = true; else user.emailVerified = true; }
  await issueSession(res, user, req);
  req.user = user; await getCart(req, res);
  res.json({ user: user.toSafeJSON() });
}));

r.post('/forgot-password', otpLimiter, validate(z.object({ email })), ah(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, status: 'active' });
  if (user) await createAndSendOtp({ channel: 'email', target: user.email, purpose: 'reset_password' }).catch(() => {});
  res.status(202).json(GENERIC_SENT);
}));
r.post('/reset-password', authLimiter, validate(z.object({ email, code, password })), ah(async (req, res) => {
  await verifyOtp({ target: req.body.email, purpose: 'reset_password', code: req.body.code });
  const user = await User.findOne({ email: req.body.email });
  if (!user) throw badRequest('This code is invalid or has expired.');
  user.passwordHash = await hashPassword(req.body.password); user.emailVerified = true; user.failedLogins = 0; user.lockedUntil = undefined;
  await user.save();
  await revokeAllSessions(user._id);
  res.json({ ok: true, message: 'Password updated. Please sign in.' });
}));

r.post('/refresh', ah(async (req, res) => {
  const user = await rotateSession(req, res);
  if (!user) { await endSession(req, res); throw unauthorized('Session expired. Please sign in again.'); }
  res.json({ user: user.toSafeJSON() });
}));
r.post('/logout', ah(async (req, res) => { await endSession(req, res); res.json({ ok: true }); }));
r.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafeJSON() }));

// Add/verify a phone number on an existing account.
r.post('/phone/request', requireAuth, otpLimiter, validate(z.object({ phone })), ah(async (req, res) => {
  const taken = await User.exists({ phone: req.body.phone, _id: { $ne: req.user._id } });
  if (taken) throw badRequest('This number is linked to another account.');
  res.status(202).json(await createAndSendOtp({ channel: 'sms', target: req.body.phone, purpose: 'verify_phone' }));
}));
r.post('/phone/verify', requireAuth, authLimiter, validate(z.object({ phone, code })), ah(async (req, res) => {
  await verifyOtp({ target: req.body.phone, purpose: 'verify_phone', code: req.body.code });
  req.user.phone = req.body.phone; req.user.phoneVerified = true; await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
}));
r.post('/change-password', requireAuth, authLimiter, validate(z.object({ currentPassword: z.string().max(128).optional(), newPassword: password })), ah(async (req, res) => {
  const u = await User.findById(req.user._id).select('+passwordHash');
  if (u.passwordHash && !(await verifyPassword(u.passwordHash, req.body.currentPassword || ''))) throw badRequest('Current password is incorrect.');
  u.passwordHash = await hashPassword(req.body.newPassword); await u.save();
  await revokeAllSessions(u._id); await issueSession(res, u, req);
  res.json({ ok: true });
}));
export default r;
