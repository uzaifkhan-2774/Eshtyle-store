import nodemailer from 'nodemailer';
import env, { isTest } from '../../config/env.js';
import logger from '../../lib/logger.js';
import { fetchJson } from '../../lib/util.js';

let transport;
export const sentInTest = []; // test-only capture; never populated outside NODE_ENV=test

export async function sendEmail({ to, subject, html, text }) {
  if (env.EMAIL_PROVIDER === 'console') {
    if (isTest) { sentInTest.push({ to, subject, html, text }); return { id: `test-${sentInTest.length}`, provider: 'console' }; }
    // Development only (production startup refuses console). Prints to the server log so you can test flows locally.
    logger.warn({ to, subject, preview: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220) }, '[DEV EMAIL — not delivered]');
    return { id: 'dev-console', provider: 'console' };
  }
  if (env.EMAIL_PROVIDER === 'resend') {
    const r = await fetchJson('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
    }, { retries: 0 });
    if (!r.ok) throw new Error(`Resend error ${r.status}`);
    return { id: r.body.id, provider: 'resend' };
  }
  transport ||= nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT || 587, secure: (env.SMTP_PORT || 587) === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } });
  const info = await transport.sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
  return { id: info.messageId, provider: 'smtp' };
}
