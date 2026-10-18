import env from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import logger from './lib/logger.js';
import { startJobs, stopJobs } from './jobs/index.js';
import { logConfigStatus } from './services/shipping/shiprocket.js';
import { getPaymentAdapter } from './services/payments/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from './services/storage.js';

await connectDb();
const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`E-SHTYLE API listening on :${env.PORT} (${env.NODE_ENV})`);
  logConfigStatus();
  const seedImgs = path.join(UPLOAD_DIR, 'seed');
  if (!fs.existsSync(seedImgs)) logger.error(`Product images folder is missing: ${seedImgs} — copy the backend/uploads folder from the project zip, or images will not show.`);
  else logger.info(`Images served from ${UPLOAD_DIR}`);
  if (!getPaymentAdapter()) logger.warn('Online payments NOT configured — checkout will offer COD only.');
});
server.requestTimeout = 30000;
if (env.ENABLE_JOBS) startJobs();

let closing = false;
async function shutdown(signal) {
  if (closing) return; closing = true;
  logger.info({ signal }, 'Shutting down gracefully');
  stopJobs();
  server.close(async () => { await disconnectDb(); process.exit(0); });
  setTimeout(() => process.exit(1), 15000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (e) => logger.error({ err: e }, 'unhandledRejection'));
