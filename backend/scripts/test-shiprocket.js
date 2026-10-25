/** Check the Shiprocket connection: `npm run test-shiprocket` (from the eshtyle folder).
 *  Logs in with SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD from backend/.env and lists your pickup locations.
 *  Read-only — creates nothing in Shiprocket. Never prints the password. */
const env = (await import('../src/config/env.js')).default;
const sr = await import('../src/services/shipping/shiprocket.js');
const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✘ ${m}\x1b[0m`);
console.log('\nShiprocket check\n');
const email = env.SHIPROCKET_EMAIL || '';
if (!email || !env.SHIPROCKET_PASSWORD) { bad('SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD is empty in backend/.env'); process.exit(1); }
if (/YAHAN_|<|>/.test(env.SHIPROCKET_PASSWORD)) { bad('SHIPROCKET_PASSWORD is still the placeholder text — put the API user password'); process.exit(1); }
console.log(`  • Logging in as ${email}`);
try { await sr.token(); ok('Login works'); }
catch (e) {
  bad(e.message.split(' — ')[0]);
  if (/fetch failed|ENOTFOUND|ECONN/.test(e.message)) { console.log('  This computer could not reach Shiprocket — check the internet connection and try again.\n'); process.exit(1); }
  console.log(`
  How to fix:
   1. Shiprocket website → Settings → API → Configure → "Create an API User".
      Use a DIFFERENT email from your main login (e.g. eshtyle09+api@gmail.com) and set a password.
   2. In backend/.env put exactly that email and password:
        SHIPROCKET_EMAIL=eshtyle09+api@gmail.com
        SHIPROCKET_PASSWORD=the-api-user-password
      (no quotes, no spaces before/after; if the password has a # put it in "double quotes")
   3. Your normal Shiprocket login password does NOT work here.
   4. Stop the site (Ctrl+C), run "npm run dev" again, then run this check again.
`);
  process.exit(1);
}
try {
  const r = await sr.call('/settings/company/pickup');
  const list = r?.data?.shipping_address || [];
  const names = list.map((x) => x.pickup_location);
  console.log(`  • Pickup locations in Shiprocket: ${names.join(', ') || '(none)'}`);
  if (!names.length) bad('No pickup address in Shiprocket — add one in Shiprocket → Settings → Pickup Addresses');
  else if (names.includes(env.SHIPROCKET_PICKUP_LOCATION)) ok(`SHIPROCKET_PICKUP_LOCATION "${env.SHIPROCKET_PICKUP_LOCATION}" matches`);
  else bad(`SHIPROCKET_PICKUP_LOCATION is "${env.SHIPROCKET_PICKUP_LOCATION}" but Shiprocket has: ${names.join(', ')} — copy one of these names exactly into backend/.env`);
  const pin = list.find((x) => x.pickup_location === env.SHIPROCKET_PICKUP_LOCATION)?.pin_code;
  if (pin && env.SHIPROCKET_PICKUP_PINCODE && String(pin) !== String(env.SHIPROCKET_PICKUP_PINCODE)) bad(`SHIPROCKET_PICKUP_PINCODE is ${env.SHIPROCKET_PICKUP_PINCODE} but that pickup address uses ${pin}`);
} catch (e) { bad(`Could not read pickup locations: ${e.message}`); }
console.log('');
process.exit(0);
