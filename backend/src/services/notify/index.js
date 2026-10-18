import { Notification } from '../../models/index.js';
import logger from '../../lib/logger.js';
import { maskEmail, maskPhone, sleep } from '../../lib/util.js';
import env from '../../config/env.js';
import { sendEmail } from './email.js';
import { sendTransactionalSms } from './sms.js';
import { templates } from './templates.js';

/** Send a templated email with retry + a Notification record (recipient masked). Never throws. */
export async function notifyEmail(template, to, data, meta = {}) {
  if (!to) return null;
  const rec = await Notification.create({ channel: 'email', kind: meta.kind || 'transactional', template, to: maskEmail(to), user: meta.user, order: meta.order }).catch(() => null);
  const t = templates[template](data);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await sendEmail({ to, ...t });
      if (rec) { rec.status = 'sent'; rec.provider = r.provider; rec.providerMessageId = r.id; rec.attempts = attempt; await rec.save(); }
      return r;
    } catch (e) {
      logger.warn({ template, attempt, err: e.message }, 'email send failed');
      if (attempt < 3) await sleep(500 * attempt);
      else if (rec) { rec.status = 'failed'; rec.error = e.message.slice(0, 200); rec.attempts = attempt; await rec.save(); }
    }
  }
  return null;
}
export async function notifySms(phone, vars, meta = {}) {
  if (!phone) return null;
  try {
    const r = await sendTransactionalSms(phone, vars);
    if (r) await Notification.create({ channel: 'sms', template: meta.template, to: maskPhone(phone), order: meta.order, status: 'sent', provider: r.provider, providerMessageId: r.id });
    return r;
  } catch (e) {
    await Notification.create({ channel: 'sms', template: meta.template, to: maskPhone(phone), order: meta.order, status: 'failed', error: e.message.slice(0, 200) }).catch(() => {});
    return null;
  }
}
export const notifyAdmin = (template, data) => (env.ADMIN_ALERT_EMAIL ? notifyEmail(template, env.ADMIN_ALERT_EMAIL, data) : null);
