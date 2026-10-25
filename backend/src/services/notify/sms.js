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
  if (env.SMS_PROVIDER === 'whatsapp') return sendOtpWhatsApp(phone, code);
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

// WhatsApp Cloud API (Meta). The template must be an approved "Authentication" template with a "Copy code" button;
// Meta adds the security text itself. The code is passed to the body and to the button.
async function sendOtpWhatsApp(phone, code) {
  const r = await fetchJson(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: `91${phone}`, type: 'template',
      template: { name: env.WHATSAPP_OTP_TEMPLATE, language: { code: env.WHATSAPP_TEMPLATE_LANG },
        components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] }] },
    }),
  }, { retries: 0, timeoutMs: 20000 });
  if (!r.ok) {
    const msg = r.body?.error?.message || `HTTP ${r.status}`;
    logger.error({ status: r.status, err: msg }, 'WhatsApp OTP failed');
    throw Object.assign(new Error('Could not send the WhatsApp code. Please check the number is on WhatsApp, or sign in with email.'), { status: 502, expose: true, detail: msg });
  }
  return { id: r.body?.messages?.[0]?.id, provider: 'whatsapp' };
}