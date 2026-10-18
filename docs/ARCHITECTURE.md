# Architecture

```
Browser (React SPA)  ──HTTPS──▶  Express API /api/v1  ──▶  MongoDB Atlas
  storefront + /admin              │  helmet, CORS, rate limits, CSRF, zod validation
                                   ├─▶ Razorpay / Cashfree   (orders, verification, refunds; webhooks back)
                                   ├─▶ Shiprocket            (serviceability, AWB, pickup, labels, tracking; webhooks back)
                                   ├─▶ SMTP / Resend, MSG91  (transactional email, OTP SMS)
                                   └─▶ Cloudinary or local disk (product images, WebP)
```

Money is stored as **integer paise** everywhere. Prices are **GST-inclusive** by default (configurable); GST is calculated per line on the server.

## Page map

Storefront: `/` · `/shop` · `/category/:slug` · `/collections/:slug` (bestsellers, new-arrivals, sale, anti-tarnish, earring-combos-edit, gift-ready) · `/search?q=` · `/product/:slug` · `/wishlist` · `/cart` · `/checkout` · `/checkout/return` · `/order/:no/confirmed` · `/login` · `/register` · `/verify-email` · `/forgot-password` · `/reset-password` · `/account` (profile, consent, phone OTP, password, delete) · `/account/addresses` · `/account/orders` · `/account/orders/:no` (timeline, tracking, cancel, return, review, retry payment) · `/track` · `/about` · `/contact` · `/faqs` · `/care-guide` · `/shipping-policy` · `/returns-policy` · `/privacy-policy` · `/terms` · `/offers/:slug` · 404.

Admin `/admin`: overview · orders · order detail (ship, invoice, refunds, cancel, notes, RTO) · returns · products · product editor (images, variants, stock, claims, SEO) · CSV import/export · categories · customers · support · marketing (coupons, banners, collections, campaign pages, newsletter) · reviews · settings · staff · audit log.

## Roles

| Role | Can |
|---|---|
| owner | everything, incl. settings, staff, cost prices |
| manager | products, inventory, orders, shipping, refunds, returns, customers, marketing, reviews, reports, audit (read settings) |
| inventory | products, stock, view orders, create shipments |
| support | view orders + add notes, returns, customers, reviews |

## Data model (MongoDB)

User · Session (hashed refresh tokens) · Otp (HMAC only) · Address · Category (tree) · Collection (manual / smart) · Product · ProductVariant (SKU, price, stock) · Cart (guest token or user) · Wishlist · Coupon · Order (with immutable OrderItem snapshots, address, totals, status history) · Payment · Refund · Shipment (+events, NDR, RTO) · ReturnRequest · Review (verified purchase, moderated) · Banner · Page (campaigns) · NewsletterSubscription (consent text + timestamp) · Notification (masked recipient) · SupportTicket · AuditLog · WebhookEvent (idempotency) · StoreSettings (singleton).

Key indexes: unique SKU (product + variant), unique slugs, unique email/phone (sparse), unique `(user, idempotencyKey)` on orders, unique `(provider, eventId)` on webhook events, unique forward shipment per order, TTL on sessions and OTPs.

## Order lifecycle

1. **Checkout** (`POST /checkout/orders`, signed-in, idempotency key): server reloads the cart, re-prices every line, validates coupon, pincode serviceability and COD eligibility.
2. **Stock** is reserved with an atomic conditional decrement per variant (`stock >= qty`); any failure rolls back earlier lines → no overselling.
3. **COD** → order `confirmed`, payment `cod_pending`. **Online** → order `pending_payment`, gateway order created server-side, stock held for `reservationMinutes` (default 30).
4. **Paid** only after a trusted check: Razorpay signature, signed webhook, or a server-side status fetch. Amount must match. Duplicate confirmations are no-ops.
5. Unpaid orders past the hold are **reconciled with the gateway first**, then expired and their stock released (job every 5 min).
6. **Ship** (admin): create Shiprocket order → assign AWB → schedule pickup → label. Each step is resumable; a mutex + unique index prevent duplicate shipments. Invoice number assigned (`PREFIX/FY/00001`).
7. **Tracking** via Shiprocket webhook (token-verified) and hourly polling. Only courier events move the order to shipped / out for delivery / delivered / RTO. A label is never treated as delivery.
8. **Cancel** (customer before AWB, or staff) releases stock and cancels the Shiprocket order; paid orders move to `refund_pending`.
9. **Returns**: customer requests within the window → staff approve / create pickup → receive & restock → refund (gateway or manual UPI/bank with reference).

## Security notes

Argon2id passwords · OTPs stored as HMAC with pepper, 10-min expiry, 60-s resend cooldown, 5/hour, 5 attempts · access JWT (15 min) + rotating refresh token with reuse detection, both httpOnly · double-submit CSRF token on every mutating request · generic auth errors and constant-time dummy hashing · account lockout after 8 failures · helmet CSP/HSTS · strict CORS allow-list · zod validation on every input · regex search input escaped · uploads validated by decoding with sharp (not by extension), re-encoded to WebP, metadata stripped · secrets only on the server; production refuses console email/SMS · logs redact cookies, passwords, codes and tokens · no stack traces to clients · audit log for sensitive admin actions.
