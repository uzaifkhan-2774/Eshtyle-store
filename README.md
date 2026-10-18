# E-SHTYLE — Jewellery e-commerce platform

Storefront, admin dashboard and API for **E-SHTYLE**, an Indian fashion & anti-tarnish jewellery brand.

| Part | Stack |
|---|---|
| `frontend/` | React 19 · Vite · TypeScript · Tailwind CSS 4 · React Router · TanStack Query · React Hook Form + Zod |
| `backend/` | Node 22 · Express 4 · MongoDB (Mongoose 8) · Zod · Argon2 · Pino |
| Integrations | Razorpay **or** Cashfree (adapter), Shiprocket, SMTP/Resend email, MSG91 SMS OTP, Cloudinary (optional) |

The catalogue is pre-built from the owner's own product photos: **59 products, 99 SKUs, ~420 optimised WebP images**, in 14 categories.

---

## 0. Quick start (local, 2 commands)

Needs only **Node.js 22+** (https://nodejs.org). No MongoDB install needed.

```bash
cd eshtyle
npm i          # installs everything (backend + frontend + a local database)
npm run dev    # first run: creates backend/.env, starts the database, loads the catalogue, creates an admin login
```

Open http://localhost:5173 (store) and http://localhost:5173/admin — the admin login is written to `backend/ADMIN-LOGIN-LOCAL.txt` on first run.
Stop with Ctrl+C; next time just `npm run dev`. Data stays in `backend/.local-db`.
To use MongoDB Atlas instead, paste its link after `MONGODB_URI=` in `backend/.env`.
OTP codes and emails are printed in the terminal (`[api]` lines) until you configure real email/SMS providers.

## 1. Run it locally (manual)

Prerequisites: Node 22+, and MongoDB 7 (local, Docker `docker run -p 27017:27017 mongo:7`, or a free Atlas cluster).

```bash
# API
cd backend
cp .env.example .env            # then set MONGODB_URI and generate the 3 secrets (command is in the file)
npm install
npm run seed                    # categories, collections, banners, 59 products (flagged as sample data)
OWNER_PASSWORD='choose-a-long-password' npm run create-owner -- you@yourdomain.in "Your Name"
npm run dev                     # http://localhost:4000

# Storefront + admin (new terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173  — admin at /admin
```

In development, `EMAIL_PROVIDER=console` and `SMS_PROVIDER=console` print OTP codes and emails **to the API log** instead of sending them (production refuses to start with these values).

With no payment gateway configured, checkout offers **Cash on Delivery only**; with no Shiprocket credentials, delivery estimates come from your store settings and shipments can't be created. The admin overview shows exactly which integrations are missing.

## 2. Tests

```bash
cd backend && npm test                      # unit + API integration (needs MongoDB at MONGODB_URI_TEST)
cd frontend && npx tsc -p tsconfig.app.json --noEmit && npm run build
node frontend/e2e/journey.mjs <api.log> <shots-dir>   # browser journey: browse → bag → register → OTP → COD order → admin
```

The API suite covers auth (OTP hashing, cooldowns, attempt limits, refresh-token reuse detection, CSRF), permissions, server-side pricing & coupons, cart merge, COD checkout, idempotent replays, stock restore on cancel, Razorpay signature + webhook replay, reservation expiry, Shiprocket shipment de-duplication and status mapping, returns and refunds. Payment and courier HTTP calls are mocked **only inside tests**.

> The one concurrency test (“never oversells under concurrent purchases”) is skipped automatically on MongoDB-compatible servers that lack atomic conditional updates (e.g. FerretDB). Run against real MongoDB (CI does) for full coverage.

## 3. Project structure

```
backend/
  src/app.js, server.js        express app, graceful shutdown, background jobs
  src/config/                  env validation (zod), db
  src/models/                  24 Mongoose models (User, Product, ProductVariant, Order, Payment, Shipment, …)
  src/routes/                  /api/v1: auth, catalog, cart, account, checkout, webhooks, misc, admin/*
  src/services/                pricing, inventory, orders, shipments, auth, storage,
                               payments/{razorpay,cashfree}, shipping/shiprocket, notify/{email,sms,templates}
  src/middleware/              auth + RBAC, CSRF, validation, rate limits, errors
  seed/                        seed.js + catalog.json (generated from the photo folders)
  uploads/seed/                optimised product images
  tests/                       vitest + supertest
frontend/
  src/pages/                   storefront pages
  src/admin/                   admin app (lazy-loaded at /admin)
  src/components, hooks, lib   UI kit, cart/auth/wishlist state, API client, SEO, consent-aware analytics
scripts/                       photo → WebP → catalog.json pipeline
docs/                          architecture, API, deployment, launch checklist, CSV format
```

## 4. Documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, page map, data model, order & payment lifecycle
- [docs/API.md](docs/API.md) — every endpoint
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — hosting, domains, backups, operations
- [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) — credentials, business approvals, sandbox testing, security checklist
- [docs/CSV_IMPORT.md](docs/CSV_IMPORT.md) — bulk product import format
- [docs/SEO.md](docs/SEO.md) — how products get found on Google, Search Console & Merchant Center setup, renamed product list
