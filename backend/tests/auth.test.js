import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, teardownDb, client, lastCode, makeUser, login } from './helpers.js';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, Otp, Session } from '../src/models/index.js';
import { smsInTest } from '../src/services/notify/sms.js';

beforeAll(() => setupDb('esh_test_auth'));
afterAll(teardownDb);

describe('authentication', () => {
  it('registers, verifies email OTP and creates a session', async () => {
    const c = client();
    const r = await c.post('/api/v1/auth/register', { name: 'Riya', email: 'Riya@Example.com', password: 'Secret1234', marketingConsent: false });
    expect(r.status).toBe(202);
    const u = await User.findOne({ email: 'riya@example.com' }).select('+passwordHash');
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
    const otp = await Otp.findOne({ target: 'riya@example.com' });
    expect(otp.codeHash).not.toContain(lastCode('riya@example.com')); // code is never stored in plain text
    const bad = await c.post('/api/v1/auth/verify-email', { email: 'riya@example.com', code: '000000' === lastCode('riya@example.com') ? '111111' : '000000' });
    expect(bad.status).toBe(400);
    const ok = await c.post('/api/v1/auth/verify-email', { email: 'riya@example.com', code: lastCode('riya@example.com') });
    expect(ok.status).toBe(200);
    const me = await c.get('/api/v1/auth/me');
    expect(me.body.user.email).toBe('riya@example.com');
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it('does not reveal whether an email is registered', async () => {
    const c = client();
    const a = await c.post('/api/v1/auth/register', { name: 'X', email: 'riya@example.com', password: 'Another1234' });
    const b = await c.post('/api/v1/auth/register', { name: 'Y', email: 'nobody-new@example.com', password: 'Another1234' });
    expect(a.status).toBe(b.status); expect(a.body.message).toBe(b.body.message);
    const l1 = await c.post('/api/v1/auth/login', { email: 'riya@example.com', password: 'wrongpass1' });
    const l2 = await c.post('/api/v1/auth/login', { email: 'ghost@example.com', password: 'wrongpass1' });
    expect(l1.status).toBe(401); expect(l1.body.error.message).toBe(l2.body.error.message);
    const f1 = await c.post('/api/v1/auth/forgot-password', { email: 'ghost@example.com' });
    expect(f1.status).toBe(202);
  });

  it('enforces OTP resend cooldown and attempt limits', async () => {
    const c = client();
    await c.post('/api/v1/auth/forgot-password', { email: 'riya@example.com' });
    const again = await c.post('/api/v1/auth/otp/request', { channel: 'email', target: 'riya@example.com', purpose: 'login' });
    expect(again.status).toBe(202); // different purpose is allowed
    const again2 = await c.post('/api/v1/auth/otp/request', { channel: 'email', target: 'riya@example.com', purpose: 'login' });
    expect(again2.status).toBe(429);
    for (let i = 0; i < 5; i++) await c.post('/api/v1/auth/reset-password', { email: 'riya@example.com', code: '999999', password: 'NewPass1234' });
    const locked = await c.post('/api/v1/auth/reset-password', { email: 'riya@example.com', code: lastCode('riya@example.com'), password: 'NewPass1234' });
    expect(locked.status).toBe(429);
  });

  it('phone OTP login creates a verified customer', async () => {
    const c = client();
    expect((await c.post('/api/v1/auth/otp/request', { channel: 'sms', target: '12345', purpose: 'login' })).status).toBe(400);
    await c.post('/api/v1/auth/otp/request', { channel: 'sms', target: '9123456780', purpose: 'login' });
    const code = smsInTest.at(-1).code;
    const r = await c.post('/api/v1/auth/otp/verify', { channel: 'sms', target: '9123456780', code });
    expect(r.status).toBe(200);
    expect(r.body.user.phoneVerified).toBe(true);
    const reuse = await c.post('/api/v1/auth/otp/verify', { channel: 'sms', target: '9123456780', code });
    expect(reuse.status).toBe(400);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    await makeUser({ email: 'rot@example.com' });
    const c = client();
    const r = await login(c, 'rot@example.com');
    const rt = r.headers['set-cookie'].find((s) => s.startsWith('esh_rt=')).split(';')[0];
    const r1 = await c.post('/api/v1/auth/refresh');
    expect(r1.status).toBe(200);
    // Replay the old (already rotated) token from another client.
    const r2 = await request(createApp()).post('/api/v1/auth/refresh').set('Cookie', `${rt}; esh_csrf=t0k3n`).set('X-CSRF-Token', 't0k3n');
    expect(r2.status).toBe(401);
    const active = await Session.countDocuments({ revokedAt: null, user: (await User.findOne({ email: 'rot@example.com' }))._id });
    expect(active).toBe(0);
  });

  it('rejects mutating requests without the CSRF token', async () => {
    const c = client();
    const r = await c.agent.post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'x' });
    expect(r.status).toBe(403);
  });
});
