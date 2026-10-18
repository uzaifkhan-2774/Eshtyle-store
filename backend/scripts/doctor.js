/** Health check: `npm run doctor` (from the eshtyle folder).
 *  Explains in plain words why products / images might not show. Read-only — changes nothing. */
import fs from 'node:fs';
import path from 'node:path';
import { BACKEND_ROOT } from '../src/config/paths.js';

const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const bad = (m, fix) => { console.log(`  \x1b[31m✘ ${m}\x1b[0m${fix ? `\n      → ${fix}` : ''}`); problems++; };
let problems = 0;
console.log('\nE-SHTYLE doctor\n');

// 1) Files that must be in the project
const envFile = path.join(BACKEND_ROOT, '.env');
fs.existsSync(envFile) ? ok('backend/.env found') : bad('backend/.env missing', 'Run "npm run dev" once (it creates it), or copy backend/.env.live.example to backend/.env on the live server.');
const seedDir = path.join(BACKEND_ROOT, 'uploads', 'seed');
const folders = fs.existsSync(seedDir) ? fs.readdirSync(seedDir).length : 0;
folders > 50 ? ok(`Product photos folder present (${folders} folders in backend/uploads/seed)`) : bad(`Product photos folder missing or incomplete: ${seedDir}`, 'Extract the full eshtyle-complete.zip again — the backend/uploads/seed folder holds all photos. When uploading to a server, upload this folder too.');

// 2) Database: use .env, or the local database started by "npm run dev"
if (!process.env.MONGODB_URI) {
  const raw = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const fromFile = raw.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
  if (!fromFile || fromFile.includes('<user>')) process.env.MONGODB_URI = 'mongodb://127.0.0.1:27027/eshtyle';
}
let env;
try { env = (await import('../src/config/env.js')).default; } catch (e) { bad('backend/.env has errors', e.message); process.exit(1); }
const mongoose = (await import('mongoose')).default;
try {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const dbName = mongoose.connection.name;
  ok(`Database connected (name: ${dbName})`);
  if (dbName === 'test') console.log('  • Your MONGODB_URI has no database name, so MongoDB uses "test". Better: add /eshtyle before the "?" in the link, e.g. ...mongodb.net/eshtyle?retryWrites=true');
} catch {
  bad('Cannot reach the database', process.env.MONGODB_URI.includes('27027') ? 'Start the site with "npm run dev" in another terminal first, then run "npm run doctor" again.' : 'Check MONGODB_URI in backend/.env (and in MongoDB Atlas → Network Access allow your server IP).');
  console.log(`\n${problems} problem(s) found.\n`); process.exit(1);
}
const { Product, Banner } = await import('../src/models/index.js');
const count = await Product.countDocuments();
count ? ok(`${count} products in the database`) : bad('No products in the database', 'Local: "npm run seed". Live server: "npm run seed:live".');

// 3) Every image path stored in the database must exist on disk
const missing = [];
const check = (u) => { if (u && u.startsWith('/uploads/') && !fs.existsSync(path.join(BACKEND_ROOT, decodeURIComponent(u.split('?')[0])))) missing.push(u); };
for (const p of await Product.find({}, 'images').lean()) for (const im of p.images || []) { check(im.url); check(im.thumb); }
for (const b of await Banner.find({}, 'image mobileImage').lean()) { check(b.image?.url); check(b.mobileImage?.url); }
missing.length ? bad(`${missing.length} image file(s) listed in the database are missing on disk, e.g. ${missing[0]}`, 'Re-extract backend/uploads from the zip. If you changed products in admin, re-upload those photos.') : ok('All product and banner image files exist on disk');

// 4) Is the server running and serving images?
const port = env.PORT || 4000;
const sample = (await Product.findOne({ 'images.0': { $exists: true } }, 'images').lean())?.images?.[0]?.url;
try {
  const h = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(3000) });
  ok(`Server is running on port ${port} (health ${h.status})`);
  if (sample) {
    const r = await fetch(`http://127.0.0.1:${port}${sample}`, { signal: AbortSignal.timeout(5000) });
    r.ok ? ok(`Server delivers images (${sample} → ${r.status})`) : bad(`Server could not deliver ${sample} (status ${r.status})`, 'Start the server from the project (npm run dev / npm start) so it can find backend/uploads.');
  }
} catch {
  console.log(`  • Server not running on port ${port} — start it with "npm run dev" (local) or "npm start" (live) and run doctor again to test images over the network.`);
}

await mongoose.disconnect();
console.log(problems ? `\n${problems} problem(s) found — follow the → hints above.\n` : '\nEverything looks good.\n');
process.exit(problems ? 1 : 0);
