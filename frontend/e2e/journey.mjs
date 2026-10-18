// Browser E2E journey (Playwright). Usage: node e2e/journey.mjs <path-to-api-log> <screenshot-dir>
// Requires: API running with EMAIL_PROVIDER=console and LOG_LEVEL=info writing to the log file (to read the dev OTP),
// Vite on :5173, seeded catalogue, and an owner created with: OWNER_PASSWORD=... npm run create-owner -- owner@eshtyle.test
import { chromium } from 'playwright';
import fs from 'node:fs';
const LOG = process.argv[2]; const OUT = process.argv[3];
const B = 'http://localhost:5173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
const step = (s) => console.log('✓', s);
await p.goto(B + '/category/earrings', { waitUntil: 'networkidle' }); await shot('m1_category'); step('category');
await p.getByRole('link', { name: 'Golden Geometric Textured Drop Earrings' }).first().click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200); await shot('m2_product'); step('product');
await p.getByRole('button', { name: 'Add to bag' }).click(); await p.getByRole('dialog', { name: 'Your bag' }).waitFor(); await shot('m3_bag'); step('bag drawer');
await p.getByRole('button', { name: 'Checkout' }).click(); await p.waitForURL(/login/); step('redirect to login');
await p.getByRole('link', { name: 'Create an account' }).click();
const email = `asha${Date.now()}@example.com`;
await p.getByLabel('Full name', { exact: true }).fill('Asha Verma'); await p.getByLabel('Email', { exact: true }).fill(email); await p.getByLabel('Password', { exact: true }).fill('Jewel2026ok');
await p.getByRole('button', { name: 'Create account' }).click(); await p.waitForURL(/verify-email/); step('registered');
await p.waitForTimeout(500);
const log = fs.readFileSync(LOG, 'utf8').split('\n').reverse().find((l) => l.includes(email) && l.includes('DEV EMAIL'));
const code = log.match(/code is (\d{6})/)?.[1] || log.match(/\b(\d{6})\b/)[1];
await p.getByLabel('6-digit code').fill(code); await p.getByRole('button', { name: 'Verify email' }).click();
await p.waitForURL(/checkout/); step('verified → checkout');
await p.getByLabel('Full name', { exact: true }).fill('Asha Verma'); await p.getByLabel('Mobile number', { exact: true }).fill('9876543210'); await p.getByLabel('House / flat, street').fill('12 MG Road'); await p.getByLabel('Pincode', { exact: true }).fill('411001'); await p.getByLabel('City', { exact: true }).fill('Pune'); await p.getByLabel('State', { exact: true }).selectOption('Maharashtra');
await p.locator('input[name=pm]').nth(1).check();
await p.getByRole('checkbox', { name: /I agree to the/ }).check(); await p.waitForTimeout(600); await shot('m4_checkout');
await p.getByRole('button', { name: /Place order/ }).click(); await p.waitForURL(/confirmed/); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500); await p.evaluate(() => scrollTo(0, 0)); await shot('m5_confirmed'); step('COD order placed');
const orderNo = p.url().match(/order\/([^/]+)/)[1];
await p.goto(B + `/account/orders/${orderNo}`, { waitUntil: 'networkidle' }); await shot('m6_order'); step('order detail');
// Admin on desktop
const a = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
a.on('pageerror', (e) => errs.push(String(e)));
await a.goto(B + '/login?next=/admin', { waitUntil: 'networkidle' });
await a.getByLabel('Email', { exact: true }).fill('owner@eshtyle.test'); await a.getByLabel('Password', { exact: true }).fill('OwnerPass2026!x'); await a.getByRole('button', { name: 'Sign in' }).click();
await a.waitForURL(/admin/); await a.waitForLoadState('networkidle'); await a.waitForTimeout(800); await a.screenshot({ path: `${OUT}/a1_dashboard.png`, fullPage: true }); step('admin dashboard');
await a.goto(B + '/admin/orders', { waitUntil: 'networkidle' }); await a.getByRole('link', { name: orderNo }).click(); await a.waitForLoadState('networkidle');
await a.getByRole('button', { name: 'Mark as being packed' }).click(); await a.waitForTimeout(800); await a.screenshot({ path: `${OUT}/a2_order.png`, fullPage: true }); step('admin order');
await a.goto(B + '/admin/products', { waitUntil: 'networkidle' }); await a.screenshot({ path: `${OUT}/a3_products.png` }); step('admin products');
await a.getByRole('link', { name: 'Golden Geometric Textured Drop Earrings' }).click(); await a.waitForLoadState('networkidle'); await a.waitForTimeout(500); await a.screenshot({ path: `${OUT}/a4_edit.png`, fullPage: true });
await a.getByRole('button', { name: 'Save product' }).click(); await a.waitForTimeout(1000); step('product saved: ' + (await a.locator('text=Product saved').count()));
await a.goto(B + '/admin/settings', { waitUntil: 'networkidle' }); await a.getByLabel('Support email').fill('care@eshtyle.in'); await a.getByRole('button', { name: 'Save settings' }).click(); await a.waitForTimeout(800); step('settings saved: ' + (await a.locator('text=Settings saved').count()));
for (const path of ['/admin/marketing', '/admin/categories', '/admin/customers', '/admin/returns', '/admin/reviews', '/admin/support', '/admin/staff', '/admin/audit']) { await a.goto(B + path, { waitUntil: 'networkidle' }); }
await a.screenshot({ path: `${OUT}/a5_audit.png` }); step('admin pages load');
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
