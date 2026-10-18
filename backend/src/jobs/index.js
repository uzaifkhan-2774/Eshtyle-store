import { expireStaleOrders } from '../services/orderService.js';
import { pollActiveShipments } from '../services/shipmentService.js';
import logger from '../lib/logger.js';

const timers = [];
let running = {};
function every(name, ms, fn) {
  const tick = async () => {
    if (running[name]) return; running[name] = true;
    try { await fn(); } catch (e) { logger.error({ job: name, err: e.message }, 'job failed'); } finally { running[name] = false; }
  };
  timers.push(setInterval(tick, ms));
}
// For multiple server instances, run jobs on one instance only (ENABLE_JOBS=true) or move to a scheduler.
export function startJobs() {
  every('expire-stale-orders', 5 * 60 * 1000, expireStaleOrders);
  every('poll-shipments', 60 * 60 * 1000, pollActiveShipments);
  logger.info('Background jobs started');
}
export function stopJobs() { timers.forEach(clearInterval); }
