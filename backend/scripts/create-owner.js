/** Create or promote the store owner account. Usage: npm run create-owner -- owner@example.com "Owner Name"
 *  You will be prompted for a password (min 12 chars); it is never echoed or logged. */
import readline from 'node:readline';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { User } from '../src/models/index.js';
import { hashPassword } from '../src/services/authService.js';

const [email, ...nameParts] = process.argv.slice(2);
if (!email) { console.error('Usage: npm run create-owner -- <email> "<name>"'); process.exit(1); }
const ask = (q) => new Promise((res) => {
  if (process.env.OWNER_PASSWORD) return res(process.env.OWNER_PASSWORD);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
  rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); res(a); });
});
const pw = await ask('Password (min 12 characters): ');
if (!pw || pw.length < 12) { console.error('Password must be at least 12 characters.'); process.exit(1); }
await connectDb();
const u = (await User.findOne({ email: email.toLowerCase() })) || new User({ email: email.toLowerCase() });
Object.assign(u, { name: nameParts.join(' ') || u.name || 'Owner', role: 'owner', emailVerified: true, status: 'active', passwordHash: await hashPassword(pw) });
await u.save();
console.log(`Owner account ready: ${u.email}`);
await disconnectDb();
