export const inr = (paise?: number | null) => (paise == null ? '' : `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`);
export const discountPct = (price: number, compare?: number | null) => (compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0);
export const date = (d?: string | Date) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const dateTime = (d?: string | Date) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
export const titleCase = (s = '') => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment', confirmed: 'Confirmed', processing: 'Being packed', ready_to_ship: 'Ready to ship', shipped: 'Shipped', out_for_delivery: 'Out for delivery',
  delivered: 'Delivered', cancelled: 'Cancelled', return_requested: 'Return requested', returned: 'Returned', rto: 'Returning to us', payment_failed: 'Payment failed', expired: 'Expired',
};
export const PAYMENT_LABEL: Record<string, string> = { pending: 'Pending', paid: 'Paid', failed: 'Failed', cod_pending: 'Due on delivery', cod_collected: 'COD collected', refund_pending: 'Refund pending', partially_refunded: 'Partly refunded', refunded: 'Refunded' };
export const newKey = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36));
