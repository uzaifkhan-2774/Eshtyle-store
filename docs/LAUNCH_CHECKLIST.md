# Launch checklist

## A. Business approvals & accounts you need

| Item | Why | Notes |
|---|---|---|
| GST registration (GSTIN) | invoices, payment gateway onboarding, Shiprocket | enter in Admin → Settings |
| Current bank account in business name | gateway settlements | |
| **Razorpay** *or* **Cashfree** merchant account (KYC complete, website reviewed) | online payments | gateways review your live site: policies, contact details and prices must be visible |
| **Shiprocket** account + pickup address + KYC + wallet recharge | shipping | the pickup location *name* goes in `SHIPROCKET_PICKUP_LOCATION` |
| Email sending: **Resend** or any SMTP (Zoho, Google Workspace, Amazon SES) with SPF + DKIM + DMARC on your domain | OTP & order emails | |
| **MSG91** account + **DLT** registration (entity ID, sender ID/header, OTP template, order-update template) | SMS OTP | Indian SMS without approved DLT templates will not be delivered |
| Domain + HTTPS hosting, MongoDB Atlas | | |
| Cloudinary (optional) | image CDN | |
| Google Search Console + Google Merchant Center (free) | appear in Google search & Shopping | see docs/SEO.md |
| Meta Business Suite: Pixel + Conversions API token + Commerce Manager catalog (`/feeds/meta.csv`) | targeted Instagram/Facebook ads & retargeting | token → `META_CAPI_TOKEN` |
| Google Analytics 4 / Meta Pixel IDs (optional) | analytics | loaded only after cookie consent |
| A CA / lawyer review of GST rate (HSN 7117), invoice format, and the policy pages | compliance | policy pages are good-faith drafts, not legal advice |

## B. Server environment variables
Set in your host's secret store (never in git, never in `VITE_*`): `MONGODB_URI`, `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `OTP_PEPPER` (48 random bytes each), `APP_URL`, `API_URL`, `CORS_ORIGINS`, `TRUST_PROXY=1`, `EMAIL_PROVIDER` + credentials, `EMAIL_FROM`, `ADMIN_ALERT_EMAIL`, `SMS_PROVIDER=msg91` + `MSG91_*`, `PAYMENT_PROVIDER` + keys + webhook secret, `SHIPROCKET_*`, optionally `CLOUDINARY_*`.

## C. Sandbox testing (do all before going live)

**Razorpay** (test mode keys `rzp_test_…`):
1. Dashboard → Settings → Webhooks → add `https://<your-domain>/api/v1/webhooks/razorpay`, events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`; set a secret → `RAZORPAY_WEBHOOK_SECRET`.
2. Place an order with test UPI `success@razorpay` → order becomes Confirmed/Paid. Try `failure@razorpay` → Payment failed, retry from the order page works.
3. Close the payment window → order stays Awaiting payment; after 30 min it expires and stock returns.
4. Issue a partial and a full refund from the admin; confirm the webhook marks it processed.

**Cashfree** (`CASHFREE_ENV=sandbox`): Developers → Webhooks → `https://<your-domain>/api/v1/webhooks/cashfree`; run the same four scenarios with sandbox test cards/UPI.

**Shiprocket**:
1. Settings → API → create an API user (separate email) → `SHIPROCKET_EMAIL/PASSWORD`.
2. Settings → Webhooks → URL `https://<your-domain>/api/v1/webhooks/shiprocket`, token → `SHIPROCKET_WEBHOOK_TOKEN`.
3. Check a few pincodes on a product page (COD and prepaid). Create a shipment for a test order, download the label, then **cancel** it in the admin before pickup so you are not charged.
4. Watch tracking events arrive on the order timeline.

**Email/SMS**: register, verify by email OTP, sign in by phone OTP, reset a password, place an order — confirm every message arrives and isn't in spam.

## D. Content to finish in the admin
- [ ] Products flagged “Sample price — review”: set the real price and **real stock** for every variant (seed stock is 12 per SKU), then untick “needs price review”.
- [ ] Product claims: anti-tarnish is only set for the two pieces whose names said so — confirm with your supplier. Add material/size/weight where known.
- [ ] Some supplied photos carry a third-party watermark (e.g. “AETERNA” on the butterfly pendant and emerald baguette necklace) — replace them.
- [ ] Several product names were made trademark-safe (e.g. folders named “Cartier” became “Screw Motif”). Keep it that way: do not use other brands' names.
- [ ] Settings: legal name, GSTIN, address/state, support email/phone/WhatsApp, Instagram link, shipping fee & free-shipping threshold, COD fee and limits, return window.
- [ ] Marketing: activate a real welcome coupon (the seeded `WELCOME10` is off), review hero banners.
- [ ] Replace the logo files in `frontend/public/brand/` with the original high-resolution artwork (the current files were cropped from a phone screenshot) — same file names.

## E. Production security checklist
- [ ] `NODE_ENV=production`; HTTPS only; HSTS on (automatic).
- [ ] Unique 48-byte secrets; rotate if ever exposed (rotating `REFRESH_TOKEN_PEPPER` signs everyone out).
- [ ] `CORS_ORIGINS` contains only your site's origin(s).
- [ ] Atlas: IP allow-list, least-privilege DB user, backups + PITR enabled.
- [ ] Owner account uses a 16+ character password; staff accounts only for people who need them, with the narrowest role.
- [ ] Payment gateway & Shiprocket webhooks configured **with** secrets/tokens.
- [ ] `ADMIN_ALERT_EMAIL` set; check the audit log weekly.
- [ ] Dependency updates monthly (`npm audit`, `npm outdated`).
- [ ] Run `npm test` against a real MongoDB before every deploy (CI does this).

## F. Known limitations (honest status)
- Payment, Shiprocket, email (SMTP/Resend), MSG91 and Cloudinary adapters are implemented against the providers' documented APIs and tested with **mocked** HTTP; they have **not** been exercised against live sandbox accounts — complete section C before launch.
- Exchanges are recorded as return requests; the replacement order is created manually.
- Abandoned-cart emails: the template and consent fields exist, but no automated sender job is enabled (turn on only with a consent-compliant provider).
- Hindi: copy is in English; UI strings are in components (not yet extracted to a translation file).
- Search uses case-insensitive matching on name/tags/SKU/colour — good for hundreds of products; switch to Atlas Search beyond a few thousand.

## Returns policy (7 days, damaged/defective/wrong/missing only, unboxing video required)
- [ ] Have a lawyer review the Returns and Shipping & delivery policies (Consumer Protection (E-Commerce) Rules 2020) before launch.
- [ ] Mount a persistent, backed-up volume at `backend/private-uploads` and set a retention period for customer videos (e.g. delete 90 days after the return closes).
- [ ] Print an “Please record an unboxing video” card for every parcel.
- [ ] Train support staff: approve only when the video shows the sealed parcel + label, the intact tag and the problem.
