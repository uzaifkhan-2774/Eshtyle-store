import env from '../../config/env.js';
import { formatINR } from '../../lib/money.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const logoUrl = () => `${env.APP_URL}/brand/logo.png`;

function layout(title, bodyHtml, preheader = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#FFF8EE;font-family:Georgia,'Times New Roman',serif;color:#241D19">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8EE;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E9DCCB">
<tr><td align="center" style="padding:28px 24px 12px;border-bottom:1px solid #E9DCCB"><img src="${logoUrl()}" alt="E-SHTYLE" width="180" style="display:block;width:180px;height:auto"></td></tr>
<tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#241D19">${bodyHtml}</td></tr>
<tr><td style="padding:18px 32px;background:#442B22;color:#E9DCCB;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5" align="center">
E-SHTYLE · Everyday Elegance. Made to Shine.<br><a href="${env.APP_URL}" style="color:#C6A15B">${esc(env.APP_URL.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`;
}
const h = (t) => `<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;color:#442B22;margin:0 0 16px">${esc(t)}</h1>`;
const btn = (label, url) => `<p style="margin:24px 0"><a href="${esc(url)}" style="background:#442B22;color:#FFF8EE;text-decoration:none;padding:12px 26px;display:inline-block;letter-spacing:.08em;font-size:13px;text-transform:uppercase">${esc(label)}</a></p>`;
const codeBox = (code) => `<p style="font-size:32px;letter-spacing:10px;font-family:'Courier New',monospace;color:#442B22;background:#FFF8EE;border:1px solid #E9DCCB;padding:14px;text-align:center;margin:20px 0">${esc(code)}</p>`;

function itemsTable(order) {
  const rows = order.items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #E9DCCB">${esc(i.name)}${i.variantTitle && i.variantTitle !== 'Default' ? `<br><span style="color:#7a6a5e;font-size:13px">${esc(i.variantTitle)}</span>` : ''} × ${i.quantity}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #E9DCCB">${formatINR(i.lineTotal)}</td></tr>`).join('');
  const t = order.totals;
  const line = (l, v) => `<tr><td style="padding:4px 0;color:#7a6a5e">${l}</td><td align="right">${v}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
${line('Subtotal', formatINR(t.subtotal))}${t.discount ? line('Discount', '−' + formatINR(t.discount)) : ''}${line('Shipping', t.shipping ? formatINR(t.shipping) : 'Free')}${t.codFee ? line('COD fee', formatINR(t.codFee)) : ''}
<tr><td style="padding:8px 0;font-weight:bold">Total</td><td align="right" style="font-weight:bold">${formatINR(t.total)}</td></tr>
<tr><td colspan="2" style="color:#7a6a5e;font-size:12px">${t.taxInclusive ? `Includes GST of ${formatINR(t.tax)}` : `GST ${formatINR(t.tax)}`}</td></tr></table>`;
}

export const templates = {
  otp: ({ code, purpose }) => {
    const what = { verify_email: 'verify your email', reset_password: 'reset your password', login: 'sign in', verify_phone: 'verify your phone' }[purpose] || 'continue';
    return { subject: `${code} is your E-SHTYLE code`, html: layout('Your code', `${h('Your verification code')}<p>Use this code to ${what}. It expires in 10 minutes.</p>${codeBox(code)}<p style="color:#7a6a5e;font-size:13px">If you didn't request this, you can safely ignore this email. E-SHTYLE will never ask you to share this code.</p>`, `Your code is ${code}`), text: `Your E-SHTYLE code is ${code}. It expires in 10 minutes.` };
  },
  welcome: ({ name }) => ({ subject: 'Welcome to E-SHTYLE', html: layout('Welcome', `${h(`Welcome${name ? ', ' + name : ''}`)}<p>Thank you for joining E-SHTYLE. Discover everyday jewellery designed to complement your style — from essentials to statement pieces.</p>${btn('Explore the collection', env.APP_URL + '/shop')}`) }),
  orderConfirmation: ({ order }) => ({ subject: `Order ${order.orderNumber} confirmed`, html: layout('Order confirmed', `${h('Thank you for your order')}<p>Your order <strong>${esc(order.orderNumber)}</strong> has been received${order.paymentMethod === 'cod' ? ' (Cash on Delivery)' : ' and payment confirmed'}. We'll let you know when it ships.</p>${itemsTable(order)}${btn('View your order', `${env.APP_URL}/account/orders/${order.orderNumber}`)}`) }),
  paymentFailed: ({ order }) => ({ subject: `Payment not completed for ${order.orderNumber}`, html: layout('Payment failed', `${h('Your payment did not go through')}<p>We couldn't confirm payment for order <strong>${esc(order.orderNumber)}</strong>. No money has been captured for a failed payment; if your account was debited, the bank usually reverses it automatically within 5–7 working days.</p>${btn('Try again', `${env.APP_URL}/account/orders/${order.orderNumber}`)}`) }),
  shipped: ({ order, shipment }) => ({ subject: `Your E-SHTYLE order ${order.orderNumber} has shipped`, html: layout('Shipped', `${h('Your order is on its way')}<p>Order <strong>${esc(order.orderNumber)}</strong> has been dispatched${shipment?.courierName ? ` with ${esc(shipment.courierName)}` : ''}.${shipment?.awb ? ` Tracking number: <strong>${esc(shipment.awb)}</strong>.` : ''}</p><p style="background:#FFF8EE;border:1px solid #E9DCCB;padding:12px 14px"><strong>Please record an unboxing video.</strong> Start recording before you open the sealed parcel, show the shipping label, and keep it as one continuous take. If anything arrives damaged, defective, wrong or missing, this video is required to approve a return (within 7 days of delivery, tag intact).</p>${btn('Track order', `${env.APP_URL}/track?order=${order.orderNumber}`)}`) }),
  delivered: ({ order }) => ({ subject: `Delivered: ${order.orderNumber}`, html: layout('Delivered', `${h('Delivered with love')}<p>Your order <strong>${esc(order.orderNumber)}</strong> has been delivered. We hope it makes you shine. Read our care guide to keep your pieces beautiful.</p><p>Something not right? If the piece arrived damaged, defective, wrong or missing, report it from your account within 7 days and upload the unboxing video you recorded. The tag must be intact and the piece unused. Returns for change of mind are not accepted.</p>${btn('Jewellery care guide', `${env.APP_URL}/care-guide`)}`) }),
  trackingUpdate: ({ order, status }) => ({ subject: `Update on order ${order.orderNumber}`, html: layout('Update', `${h('Shipment update')}<p>Order <strong>${esc(order.orderNumber)}</strong>: ${esc(status)}.</p>${btn('Track order', `${env.APP_URL}/track?order=${order.orderNumber}`)}`) }),
  cancelled: ({ order }) => ({ subject: `Order ${order.orderNumber} cancelled`, html: layout('Cancelled', `${h('Your order has been cancelled')}<p>Order <strong>${esc(order.orderNumber)}</strong> has been cancelled.${order.paymentStatus === 'refund_pending' ? ' Your refund has been initiated and we will email you once it is processed.' : ''}</p>`) }),
  refund: ({ order, amount, status }) => ({ subject: `Refund ${status} for ${order.orderNumber}`, html: layout('Refund', `${h(`Refund ${status}`)}<p>A refund of <strong>${formatINR(amount)}</strong> for order <strong>${esc(order.orderNumber)}</strong> is ${esc(status)}. Banks typically take 5–7 working days to reflect refunds.</p>`) }),
  returnStatus: ({ order, status, note }) => ({ subject: `Return request ${status}: ${order.orderNumber}`, html: layout('Return update', `${h('Return request update')}<p>Your return request for order <strong>${esc(order.orderNumber)}</strong> is now <strong>${esc(status.replace(/_/g, ' '))}</strong>.</p>${note ? `<p>${esc(note)}</p>` : ''}`) }),
  passwordReset: ({ code }) => templates.otp({ code, purpose: 'reset_password' }),
  adminOrderAlert: ({ order }) => ({ subject: `New order ${order.orderNumber} — ${formatINR(order.totals.total)} (${order.paymentMethod.toUpperCase()})`, html: layout('New order', `${h('New order received')}${itemsTable(order)}${btn('Open in admin', `${env.APP_URL}/admin/orders/${order._id}`)}`) }),
  abandonedCart: ({ name, unsubscribeUrl }) => ({ subject: 'You left something beautiful behind', html: layout('Your bag', `${h(`Still thinking it over${name ? ', ' + name : ''}?`)}<p>Your E-SHTYLE bag is saved and waiting for you.</p>${btn('Return to bag', `${env.APP_URL}/cart`)}<p style="font-size:12px;color:#7a6a5e">You received this because you opted in to emails. <a href="${esc(unsubscribeUrl)}" style="color:#7a6a5e">Unsubscribe</a>.</p>`) }),
};
