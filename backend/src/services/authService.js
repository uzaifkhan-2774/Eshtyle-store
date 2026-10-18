import argon2 from 'argon2';
import { User, Session, Otp } from '../models/index.js';
import env, { isProd } from '../config/env.js';
import { hmac, randomToken, otpCode, safeEqual } from '../lib/crypto.js';
import { badRequest, tooMany } from '../lib/errors.js';
import { signAccess, cookieBase, ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_TTL_SEC } from '../middleware/auth.js';
import { notifyEmail } from './notify/index.js';
import { sendOtpSms } from './notify/sms.js';

const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5;

export const hashPassword = (p) => argon2.hash(p, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (hash, p) => argon2.verify(hash, p).catch(() => false);
// Constant-ish work for unknown accounts so timing does not reveal account existence.
let dummyHash; export const dummyVerify = async (p) => { dummyHash ||= await hashPassword('not-a-real-password-x'); await verifyPassword(dummyHash, p); return false; };

const tokenHash = (t) => hmac(env.REFRESH_TOKEN_PEPPER, t);

export async function issueSession(res, user, req, family) {
  const raw = randomToken(32);
  await Session.create({ user: user._id, tokenHash: tokenHash(raw), family: family || randomToken(12), userAgent: req.get('user-agent')?.slice(0, 200), ip: req.ip, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) });
  res.cookie(ACCESS_COOKIE, signAccess(user), { ...cookieBase(), maxAge: ACCESS_TTL_SEC * 1000, path: '/' });
  res.cookie(REFRESH_COOKIE, raw, { ...cookieBase(), maxAge: REFRESH_TTL_MS, path: '/api/v1/auth' });
  user.lastLoginAt = new Date(); user.failedLogins = 0; user.lockedUntil = undefined; await user.save();
}

/** Refresh-token rotation with reuse detection: presenting a rotated token revokes the whole family. */
export async function rotateSession(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return null;
  const s = await Session.findOne({ tokenHash: tokenHash(raw) });
  if (!s || s.expiresAt < new Date()) return null;
  if (s.revokedAt) { await Session.updateMany({ family: s.family }, { $set: { revokedAt: new Date() } }); return null; }
  const user = await User.findById(s.user);
  if (!user || user.status !== 'active') return null;
  const claimed = await Session.findOneAndUpdate({ _id: s._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (!claimed) return null;
  await issueSession(res, user, req, s.family);
  return user;
}
export async function endSession(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) await Session.updateOne({ tokenHash: tokenHash(raw) }, { $set: { revokedAt: new Date() } });
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: '/api/v1/auth' });
}
export const revokeAllSessions = (userId) => Session.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

const otpHash = (target, purpose, code) => hmac(env.OTP_PEPPER, `${target}|${purpose}|${code}`);

export async function createAndSendOtp({ channel, target, purpose }) {
  const since = new Date(Date.now() - 3600 * 1000);
  const recent = await Otp.find({ target, purpose, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(OTP_MAX_PER_HOUR + 1).lean();
  if (recent[0] && Date.now() - new Date(recent[0].createdAt).getTime() < OTP_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - new Date(recent[0].createdAt).getTime())) / 1000);
    throw tooMany(`Please wait ${wait}s before requesting another code.`);
  }
  if (recent.length >= OTP_MAX_PER_HOUR) throw tooMany('Too many codes requested. Please try again in an hour.');
  const code = otpCode();
  await Otp.updateMany({ target, purpose, consumedAt: null }, { $set: { consumedAt: new Date() } }); // invalidate older codes
  await Otp.create({ channel, target, purpose, codeHash: otpHash(target, purpose, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  if (channel === 'email') await notifyEmail('otp', target, { code, purpose });
  else await sendOtpSms(target, code);
  return { cooldownSeconds: OTP_COOLDOWN_MS / 1000 };
}
export async function verifyOtp({ target, purpose, code }) {
  const otp = await Otp.findOne({ target, purpose, consumedAt: null }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt < new Date()) throw badRequest('This code is invalid or has expired. Please request a new one.');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw tooMany('Too many incorrect attempts. Please request a new code.');
  const ok = safeEqual(otp.codeHash, otpHash(target, purpose, String(code).trim()));
  if (!ok) {
    await Otp.updateOne({ _id: otp._id }, { $inc: { attempts: 1 } });
    throw badRequest('Incorrect code. Please try again.');
  }
  const claimed = await Otp.findOneAndUpdate({ _id: otp._id, consumedAt: null }, { $set: { consumedAt: new Date() } });
  if (!claimed) throw badRequest('This code has already been used.');
  return true;
}
export { isProd };
