import * as shiprocket from './shipping/shiprocket.js';
import logger from '../lib/logger.js';

/** Pincode serviceability: uses Shiprocket when configured, otherwise store rules (clearly labelled as such). */
export async function quotePincode(pincode, settings, { cod = true, weightGrams } = {}) {
  if (!/^[1-9]\d{5}$/.test(String(pincode))) return { pincode, serviceable: false, reason: 'Please enter a valid 6-digit pincode.' };
  if (settings.shipping.blockedPincodes?.includes(String(pincode))) return { pincode, serviceable: false, source: 'store-rules', reason: 'We do not deliver to this pincode yet.' };
  if (shiprocket.isConfigured()) {
    try {
      const q = await shiprocket.serviceability({ pincode, cod, weightKg: (weightGrams || settings.shipping.defaultWeightGrams) / 1000 });
      if (!q.serviceable) return { pincode, serviceable: false, source: 'shiprocket', reason: 'Delivery is not available to this pincode yet.' };
      const best = q.couriers.find((c) => c.id === q.recommendedCourierId) || q.couriers[0];
      return { pincode, serviceable: true, source: 'shiprocket', codAvailable: q.codAvailable, etd: best.etd, etdDays: best.etdDays };
    } catch (e) {
      logger.warn({ err: e.message }, 'Shiprocket serviceability failed — falling back to store rules');
    }
  }
  return { pincode, serviceable: true, source: 'store-rules', codAvailable: settings.cod.enabled, estimateDays: [settings.shipping.estimateDaysMin, settings.shipping.estimateDaysMax] };
}
