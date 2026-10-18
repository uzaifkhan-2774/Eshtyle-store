// All money is stored in paise (integer) to avoid floating point errors.
export const rupeesToPaise = (r) => Math.round(Number(r) * 100);
export const paiseToRupees = (p) => Math.round(p) / 100;
export const formatINR = (p) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
