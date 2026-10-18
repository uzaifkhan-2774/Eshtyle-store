#!/usr/bin/env node
/**
 * One-command local run for E-SHTYLE.
 *   npm i        → installs root + backend + frontend
 *   npm run dev  → creates backend/.env (with fresh random secrets) if missing,
 *                  starts a local MongoDB (unless MONGODB_URI is set), seeds the
 *                  catalogue on first run, creates a local admin login, and runs
 *                  the API (4000) and the storefront (5173) together.
 * Local development only — production uses `npm start` in backend with a real .env.
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const ENV_FILE = path.join(BACKEND, '.env');
const seedOnly = process.argv.includes('--seed-only');
const say = (m) => console.log(`\x1b[33m[eshtyle]\x1b[0m ${m}`);
const die = (m) => { console.error(`\x1b[31m[eshtyle] ${m}\x1b[0m`); process.exit(1); };

// 1) Node version
const [maj] = process.versions.node.split('.').map(Number);
if (maj < 22) die(`Node.js 22 or newer is required (you have ${process.versions.node}). Install it from https://nodejs.org`);
for (const d of [BACKEND, FRONTEND]) if (!fs.existsSync(path.join(d, 'node_modules'))) die('Dependencies are missing. Run "npm i" in the eshtyle folder first.');

// 2) backend/.env — created once with random secrets; never overwritten.
const secret = () => crypto.randomBytes(48).toString('base64url');
if (!fs.existsSync(ENV_FILE)) {
  let t = fs.readFileSync(path.join(BACKEND, '.env.example'), 'utf8');
  t = t.replace(/^MONGODB_URI=.*$/m, '# Leave empty to use the built-in local database. For Atlas paste your connection link here.\nMONGODB_URI=')
    .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret()}`)
    .replace(/^REFRESH_TOKEN_PEPPER=.*$/m, `REFRESH_TOKEN_PEPPER=${secret()}`)
    .replace(/^OTP_PEPPER=.*$/m, `OTP_PEPPER=${secret()}`)
    .replace(/^NODE_ENV=.*$/m, 'NODE_ENV=development');
  fs.writeFileSync(ENV_FILE, t, { mode: 0o600 });
  say('Created backend/.env with new random secrets (keep this file private).');
}
const fileEnv = Object.fromEntries(fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
if (fileEnv.NODE_ENV === 'production') die('backend/.env says NODE_ENV=production. This script is for local development only.');

// 3) Database: the user's MONGODB_URI, or a persistent local MongoDB in backend/.local-db
let mongod = null;
let MONGODB_URI = process.env.MONGODB_URI || fileEnv.MONGODB_URI || '';
if (!MONGODB_URI || MONGODB_URI.includes('<user>')) {
  let MongoMemoryServer;
  try { ({ MongoMemoryServer } = await import('mongodb-memory-server')); } catch { die('Local database package is missing. Run "npm i" in the eshtyle folder.'); }
  const dbPath = path.join(BACKEND, '.local-db');
  fs.mkdirSync(dbPath, { recursive: true });
  say('Starting the local database (first time downloads MongoDB, ~100 MB — please wait)…');
  try {
    mongod = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger', port: 27027, dbName: 'eshtyle' } });
  } catch (e) {
    die(`Could not start the local database: ${e.message}\nTip: create a free cluster on https://www.mongodb.com/atlas, paste its link after MONGODB_URI= in backend/.env, and run "npm run dev" again.`);
  }
  MONGODB_URI = mongod.getUri('eshtyle');
  say(`Local database ready (data is kept in backend/.local-db).`);
} else say('Using your MONGODB_URI database.');

const env = { ...process.env, MONGODB_URI, NODE_ENV: 'development', FORCE_COLOR: '1' };
const runNode = (args, cwd) => spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' }).status === 0;

// 4) First-run setup: catalogue + local admin login
if (!runNode(['seed/seed.js', ...(seedOnly ? process.argv.slice(2).filter((x) => x !== '--seed-only') : ['--if-empty'])], BACKEND)) { await mongod?.stop({ doCleanup: false }); die('Seeding failed — see the error above.'); }
if (!runNode(['scripts/ensure-dev-owner.js'], BACKEND)) { await mongod?.stop({ doCleanup: false }); die('Could not create the local admin login.'); }
if (seedOnly) { await mongod?.stop({ doCleanup: false }); process.exit(0); }

// 5) API + storefront together
const kids = [];
const start = (name, color, args, cwd) => {
  const p = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (s, out) => { let buf = ''; s.on('data', (d) => { buf += d; const lines = buf.split('\n'); buf = lines.pop(); for (const l of lines) out.write(tag + l + '\n'); }); };
  pipe(p.stdout, process.stdout); pipe(p.stderr, process.stderr);
  p.on('exit', (code) => { if (!stopping) { say(`${name} stopped (code ${code}). Shutting down.`); stop(); } });
  kids.push(p);
};
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  for (const k of kids) { try { k.kill(); } catch { /* already gone */ } }
  await mongod?.stop({ doCleanup: false });
  process.exit(0);
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);

start('api', 36, ['--watch', 'src/server.js'], BACKEND);
start('web', 35, [path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5173', '--strictPort'], FRONTEND);
setTimeout(() => {
  say('──────────────────────────────────────────────');
  say('Store:  http://localhost:5173');
  say('Admin:  http://localhost:5173/admin   →  admin@eshtyle.test / Eshtyle@2026');
  say('Test customer login: customer@eshtyle.test / Eshtyle@2026 (test logins work only on this computer)');
  say(/^EMAIL_PROVIDER=resend/m.test(fs.readFileSync(ENV_FILE, 'utf8')) || process.env.EMAIL_PROVIDER === 'resend' ? 'Emails are sent through Resend. Check one with: npm run test-email -- you@gmail.com' : 'Emails are NOT delivered (EMAIL_PROVIDER=console) — codes are printed here in the [api] lines.');
  say('Press Ctrl+C to stop.');
  say('──────────────────────────────────────────────');
}, 4000);
