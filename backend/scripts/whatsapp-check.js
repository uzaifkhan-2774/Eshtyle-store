/** npm run whatsapp-check — uses WHATSAPP_TOKEN from backend/.env to find your WhatsApp number's
 *  "Phone number ID" and checks the OTP template. Read-only: sends nothing. Never prints the token.
 *  If the account isn't found automatically, pass the WhatsApp account ID:  npm run whatsapp-check -- 1405553275001305 */
const env = (await import('../src/config/env.js')).default;
const G = 'https://graph.facebook.com/v21.0';
const tok = env.WHATSAPP_TOKEN;
const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✘ ${m}\x1b[0m`);
const get = async (path) => {
  const r = await fetch(`${G}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(tok)}`);
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b?.error?.message || `HTTP ${r.status}`);
  return b;
};

async function main() {
  console.log('\nWhatsApp check\n');
  if (!tok) return bad('WHATSAPP_TOKEN is empty in backend/.env');
  let wabas = [];
  try {
    const d = await get(`/debug_token?input_token=${encodeURIComponent(tok)}`);
    if (!d.data?.is_valid) return bad('Token is not valid (expired or revoked). Generate a new system-user token.');
    ok('Token is valid');
    const scopes = d.data.granular_scopes || [];
    const perms = scopes.map((s) => s.scope);
    for (const p of ['whatsapp_business_messaging', 'whatsapp_business_management']) if (!perms.includes(p)) bad(`Token is missing the permission ${p} — generate the token again with it ticked`);
    wabas = [...new Set(scopes.filter((s) => s.scope.startsWith('whatsapp_business')).flatMap((s) => s.target_ids || []))];
  } catch (e) { return bad(`Could not check the token: ${e.message}`); }
  const given = process.argv.slice(2).filter((a) => /^\d{6,}$/.test(a));
  if (given.length) wabas = given;
  if (!wabas.length) return bad('Could not find the WhatsApp account from the token. Run it with your WhatsApp account ID (Business Settings → Messaging accounts → ID), e.g.:\n      npm run whatsapp-check -- 1405553275001305');
  for (const w of wabas) {
    try {
      const nums = await get(`/${w}/phone_numbers?fields=id,display_phone_number,verified_name,status`);
      console.log(`\n  WhatsApp account ${w}`);
      if (!nums.data?.length) console.log('    (no phone numbers in this account)');
      for (const n of nums.data || []) {
        console.log(`    Number: ${n.display_phone_number}  (${n.verified_name || 'no name'})  status: ${n.status || '-'}`);
        console.log(`    \x1b[33mPhone number ID: ${n.id}\x1b[0m   ← put this in WHATSAPP_PHONE_NUMBER_ID`);
        if (env.WHATSAPP_PHONE_NUMBER_ID === n.id) ok('This matches WHATSAPP_PHONE_NUMBER_ID in backend/.env');
      }
      const t = await get(`/${w}/message_templates?name=${encodeURIComponent(env.WHATSAPP_OTP_TEMPLATE)}&fields=name,status,category,language`);
      const tp = (t.data || []).find((x) => x.name === env.WHATSAPP_OTP_TEMPLATE);
      if (!tp && process.argv.includes('--create-template')) {
        // Creates the standard WhatsApp "Authentication" OTP template (Meta writes the text; we only choose options).
        const r = await fetch(`${G}/${w}/message_templates`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: env.WHATSAPP_OTP_TEMPLATE, language: env.WHATSAPP_TEMPLATE_LANG, category: 'AUTHENTICATION',
            components: [{ type: 'BODY', add_security_recommendation: true }, { type: 'FOOTER', code_expiration_minutes: 10 }, { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copy code' }] }] }) });
        const b = await r.json().catch(() => ({}));
        if (r.ok) ok(`Template "${env.WHATSAPP_OTP_TEMPLATE}" created — status: ${b.status || 'PENDING'}. Run this check again in a few minutes to see APPROVED.`);
        else bad(`Could not create the template: ${b?.error?.error_user_msg || b?.error?.message || r.status}`);
      } else if (!tp) bad(`Template "${env.WHATSAPP_OTP_TEMPLATE}" not found. Create it automatically with:\n      npm run whatsapp-check -- ${w} --create-template`);
      else (tp.status === 'APPROVED' ? ok : bad)(`Template "${tp.name}" (${tp.language}, ${tp.category}): ${tp.status}`);
    } catch (e) { bad(`Account ${w}: ${e.message}`); }
  }
}

await main();
console.log('');