/** Send one test email and show exactly what the email provider answered.
 *  Usage (from the eshtyle folder):  npm run test-email -- you@gmail.com */
import env from '../src/config/env.js';
import { sendEmail } from '../src/services/notify/email.js';

const to = process.argv[2];
if (!to || !/^\S+@\S+\.\S+$/.test(to)) { console.error('Usage: npm run test-email -- you@gmail.com'); process.exit(1); }
console.log(`\nEMAIL_PROVIDER = ${env.EMAIL_PROVIDER}\nEMAIL_FROM     = ${env.EMAIL_FROM}\nSending to     = ${to}\n`);
if (env.EMAIL_PROVIDER === 'console') {
  console.log('✘ EMAIL_PROVIDER is "console": emails are only PRINTED in the terminal, never delivered.\n  → In backend/.env set EMAIL_PROVIDER=resend and RESEND_API_KEY=re_..., then restart "npm run dev".\n');
  process.exit(1);
}
try {
  const r = await sendEmail({ to, subject: 'E-SHTYLE test email', html: '<p>If you can read this, email sending works. 🎉</p>', text: 'If you can read this, email sending works.' });
  console.log(`✔ Accepted by ${r.provider} (id ${r.id}).\n  Check the inbox AND the Spam folder of ${to}. In Resend → Emails you can see whether it was delivered or bounced.\n`);
} catch (e) {
  console.log(`✘ Not sent: ${e.message}\n`);
  if (/only send testing emails|verify a domain|domain is not verified|not verified/i.test(e.message)) console.log('  → Your domain is not verified in Resend yet. Resend → Domains → add the DNS records shown there at your domain provider, wait for "Verified",\n    and make EMAIL_FROM use that domain (e.g. E-SHTYLE <orders@your-domain.in>). Until then Resend only delivers to your own Resend login email.\n');
  else if (/401|403|api key/i.test(e.message)) console.log('  → RESEND_API_KEY is wrong or was deleted. Create a new key in Resend → API Keys and paste it into backend/.env.\n');
  else if (/422|from/i.test(e.message)) console.log('  → EMAIL_FROM is not valid for Resend. Use: E-SHTYLE <orders@your-verified-domain.in>\n');
  process.exit(1);
}
process.exit(0);
