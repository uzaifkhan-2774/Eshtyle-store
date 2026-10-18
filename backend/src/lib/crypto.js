import crypto from 'node:crypto';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const hmac = (secret, value) => crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
export const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
export const otpCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
