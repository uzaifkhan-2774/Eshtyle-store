/** Local development only. Creates two fixed TEST logins (and refreshes their passwords on every
 *  `npm run dev`) so testing is easy:
 *     admin:    admin@eshtyle.test    / Eshtyle@2026
 *     customer: customer@eshtyle.test / Eshtyle@2026
 *  They are marked devOnly, so they are refused on the live site (NODE_ENV=production) even if the
 *  same database is used there. For the real owner login use `npm run create-owner`. */
import fs from 'node:fs';
import path from 'node:path';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { isProd } from '../src/config/env.js';
import { BACKEND_ROOT } from '../src/config/paths.js';
import { User } from '../src/models/index.js';
import { hashPassword } from '../src/services/authService.js';

if (isProd) { console.error('ensure-dev-owner is for local development only.'); process.exit(1); }
export const TEST_PASSWORD = 'Eshtyle@2026';
const ACCOUNTS = [
  { email: 'admin@eshtyle.test', name: 'Test Admin', role: 'owner' },
  { email: 'customer@eshtyle.test', name: 'Test Customer', role: 'customer' },
];
await connectDb();
const hash = await hashPassword(TEST_PASSWORD);
for (const a of ACCOUNTS) {
  const u = (await User.findOne({ email: a.email })) || new User({ email: a.email });
  Object.assign(u, { name: a.name, role: a.role, emailVerified: true, status: 'active', devOnly: true, failedLogins: 0, lockedUntil: undefined, passwordHash: hash });
  await u.save();
}
fs.writeFileSync(path.join(BACKEND_ROOT, 'ADMIN-LOGIN-LOCAL.txt'), `E-SHTYLE test logins (local testing only — they do not work on the live site)

Admin panel:  http://localhost:5173/admin
  Email:    admin@eshtyle.test
  Password: ${TEST_PASSWORD}

Customer (to test shopping / orders):
  Email:    customer@eshtyle.test
  Password: ${TEST_PASSWORD}

Real owner login for the live site: npm run create-owner -- you@example.com "Your Name"
`);
console.log(`Test logins ready → admin@eshtyle.test / ${TEST_PASSWORD}  (customer@eshtyle.test, same password)`);
await disconnectDb();
