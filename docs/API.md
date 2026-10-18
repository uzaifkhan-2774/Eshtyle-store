# API reference — `/api/v1`

JSON in/out. Money in **paise**. Errors: `{ "error": { "code", "message", "details?" } }`.
Every non-GET request needs header `X-CSRF-Token` equal to the `esh_csrf` cookie (get it from `GET /auth/csrf`). Webhooks are exempt.
Auth uses httpOnly cookies (`esh_at` 15 min, `esh_rt` 30 days, rotated).

## Auth `/auth`
| Method | Path | Body / notes |
|---|---|---|
| GET | `/csrf` | issues CSRF cookie |
| POST | `/register` | `{name,email,password,marketingConsent?}` → 202, emails OTP (generic response) |
| POST | `/verify-email` | `{email,code}` → signs in |
| POST | `/login` | `{email,password}` → 401 generic / 403 `EMAIL_UNVERIFIED` |
| POST | `/otp/request` | `{channel:'sms'|'email', target, purpose:'login'|'verify_email'}` |
| POST | `/otp/verify` | `{channel,target,code,name?}` → signs in (creates account on first phone login) |
| POST | `/forgot-password` · `/reset-password` | `{email}` · `{email,code,password}` (revokes all sessions) |
| POST | `/refresh` · `/logout` | rotate / end session |
| GET | `/me` | current user |
| POST | `/phone/request` · `/phone/verify` · `/change-password` | signed-in |

## Catalogue `/catalog` (public, cached 60 s)
`GET /home` · `GET /categories` · `GET /categories/:slug` · `GET /collections/:slug` · `GET /products?q&category&minPrice&maxPrice&colour&finish&material&type&tag&inStock&onSale&antiTarnish&rating&sort(featured|newest|price_asc|price_desc|bestselling)&page&limit` (returns `facets`) · `GET /products/:slug` (variants, related, frequently bought together, shipping) · `POST /products/by-ids` · `GET /products/:id/reviews` · `GET /search/suggest?q` · `GET /pincode/:pincode` · `GET /settings/public` · `GET /pages/:slug`

## Cart `/cart` (guest cookie or user)
`GET /` · `POST /items {variantId,quantity}` · `PATCH /items/:itemId {quantity}` · `DELETE /items/:itemId` · `POST /coupon {code}` · `DELETE /coupon` — responses always contain server-computed `totals`, `cod` eligibility and `issues`.

## Account `/account` (signed-in)
`PATCH /profile` · addresses `GET/POST /addresses`, `PUT/DELETE /addresses/:id` · wishlist `GET/POST /wishlist`, `POST /wishlist/merge`, `DELETE /wishlist/:productId` · `GET /orders` · `GET /orders/:orderNumber` · `POST /orders/:no/cancel {reason}` · `POST /orders/:no/returns` multipart: `video` (unboxing video, MP4/WebM ≤100 MB, required) + `data` JSON `{type,items[{orderItem,quantity}],reason (must be one of settings.returns.reasons),comments,confirmations{tagIntact,unused,originalPackaging,unboxingVideo all true}}` — refused outside the 7-day window · `POST /reviews {productId,rating,title,body}` (delivered orders only; moderated) · `POST /delete {confirm:'DELETE'}`

## Checkout `/checkout` (signed-in)
| Method | Path | Notes |
|---|---|---|
| POST | `/quote` | `{addressId|pincode, paymentMethod}` → totals, COD eligibility, serviceability |
| POST | `/orders` | `{addressId | address, saveAddress?, paymentMethod:'online'|'cod', idempotencyKey, acceptTerms:true, notes?, attribution?}` → `{order, payment}`; `payment` holds the gateway checkout payload (public key only) |
| POST | `/orders/:no/pay` | retry payment while stock is held |
| POST | `/payments/razorpay/verify` | `{orderNumber, razorpay_order_id, razorpay_payment_id, razorpay_signature}` |
| POST | `/payments/confirm` | server asks the gateway (Cashfree return / any pending) |
| POST | `/payments/failed` | records a client-reported failure (never marks paid) |

## Webhooks `/webhooks` (raw body, signature-verified, idempotent)
`POST /razorpay` (`X-Razorpay-Signature`, HMAC of body with webhook secret) · `POST /cashfree` (`x-webhook-signature`, HMAC of timestamp+body) · `POST /shiprocket` (`x-api-key` = `SHIPROCKET_WEBHOOK_TOKEN`)

## Misc
`POST /newsletter {email,consent:true}` · `GET /newsletter/unsubscribe?token` · `POST /contact` · `GET /track?order&contact`
Outside `/api`: `GET /health`, `GET /health/ready`, `GET /sitemap.xml`, `GET /robots.txt`, `GET /feeds/google.xml` (Merchant Center), `GET /feeds/meta.csv` (Meta catalog), `/uploads/*`.
Admin: `GET /admin/dashboard/attribution?from&to` — orders and revenue by source, campaign, ad and coupon.

## Admin `/admin` (staff; permission in brackets)
- `GET /me` · `GET /dashboard?from&to` [dashboard]
- Products [products:*, inventory:write]: `GET /products`, `GET /products/:id`, `POST /products`, `PUT /products/:id` (with `variants[]`), `PATCH /products/:id/status`, `PATCH /products/variants/:id/stock {stock|adjust}`, `POST /products/images` (multipart `images`), `GET /products/export/csv`, `POST /products/import/csv?dryRun=true|false` (multipart `file`)
- Orders [orders:*]: `GET /orders?status&paymentStatus&paymentMethod&from&to&q`, `GET /orders/export/csv`, `GET /orders/:id`, `POST /orders/:id/status`, `POST /orders/:id/notes`, `POST /orders/:id/cancel`, `POST /orders/:id/refund` [refunds:write], `POST /orders/refunds/:id/mark-processed`, `GET /orders/:id/couriers`, `POST /orders/:id/ship` [shipping:write], `POST /orders/:id/track-refresh`, `POST /orders/:id/rto-received`, `GET /orders/:id/invoice` (printable HTML), `GET /orders/returns/list`, `GET /orders/returns/:id/video` (private stream, staff only), `POST /orders/returns/:id` (approve refused when no video)
- Catalogue & marketing: CRUD `/categories`, `/collections`, `/coupons`, `/banners`, `/pages`; `POST /categories-reorder`; `GET /newsletter`, `GET /newsletter/export`; `GET /reviews`, `POST /reviews/:id`
- Customers & support: `GET /customers`, `GET /customers/:id`, `POST /customers/:id/status`, `GET /tickets`, `POST /tickets/:id`
- `GET/PUT /settings` [settings:read / owner] · `GET/POST /staff`, `POST /staff/:id` [owner] · `GET /audit`, `GET /notifications`
