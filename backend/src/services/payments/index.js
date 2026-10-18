import env from '../../config/env.js';
import * as razorpay from './razorpay.js';
import * as cashfree from './cashfree.js';

const adapters = { razorpay, cashfree };
export function getPaymentAdapter(name = env.PAYMENT_PROVIDER) {
  const a = adapters[name];
  return a && a.isConfigured() ? a : null;
}
export const adapterByName = (n) => adapters[n];
