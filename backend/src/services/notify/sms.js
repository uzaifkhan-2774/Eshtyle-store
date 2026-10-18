import env, { isTest } from '../../config/env.js';
import logger from '../../lib/logger.js';
import { fetchJson } from '../../lib/util.js';

export const smsInTest = [];

// MSG91 (India). Requires DLT entity + template registration. OTP is generated & verified by OUR server;
// MSG91 only delivers it via a registered template that has an ##OTP## / var placeholder.
export async function sendOtpSms(phone, code) {
  if (env.SMS_PROVIDER === 'none') throw Object.assign(new Error('Mobile OTP login is coming soon. Please sign in with your email.'), { status: 400, expose: true, code: 'SMS_DISABLED' });
  if (env.SMS_PROVIDER === 'console') {
    if (isTest) { smsInTest.push({ phone, code }); return { id: 'test', provider: 'console' }; }
    logger.warn({ phone: phone.replace(/.(?=.{4})/g, '*'), code }, '[DEV SMS — not delivered]');
    return { id: 'dev-console', provider: 'console' };
  }
  const r = await fetchJson('https://control.msg91.com/api/v5/flow', {
    method: 'POST', headers: { authkey: env.MSG91_AUTH_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ template_id: env.MSG91_OTP_TEMPLATE_ID, short_url: '0', recipients: [{ mobiles: `91${phone}`, otp: code }] }),
  }, { retries: 0 });
  if (!r.ok || r.body?.type === 'error') throw new Error(`MSG91 error ${r.status}`);
  return { id: r.body?.request_id || r.body?.message, provider: 'msg91' };
}

export async function sendTransactionalSms(phone, vars) {
  if (env.SMS_PROVIDER !== 'msg91' || !env.MSG91_FLOW_TEMPLATE_ID) {
    if (!isTest) logger.info({ phone: phone.replace(/.(?=.{4})/g, '*') }, '[SMS skipped: no transactional template configured]');
    return null;
  }
  const r = await fetchJson('https://control.msg91.com/api/v5/flow', {
    method: 'POST', headers: { authkey: env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: env.MSG91_FLOW_TEMPLATE_ID, short_url: '0', recipients: [{ mobiles: `91${phone}`, ...vars }] }),
  }, { retries: 0 });
  if (!r.ok) throw new Error(`MSG91 error ${r.status}`);
  return { id: r.body?.request_id, provider: 'msg91' };
}
