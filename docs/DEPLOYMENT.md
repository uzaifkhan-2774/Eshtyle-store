# Deployment

## Recommended: one service, one domain
Build the storefront into the API image so the site and API share an origin (simplest cookies, no CORS):

```bash
docker build -f backend/Dockerfile -t eshtyle .
docker run -p 4000:4000 --env-file backend/.env eshtyle
```
Works on Render, Railway, Fly.io, DigitalOcean App Platform, AWS App Runner or any VPS. Put it behind HTTPS and set `TRUST_PROXY=1`, `APP_URL=API_URL=https://www.your-domain.in`, `CORS_ORIGINS=https://www.your-domain.in`.

Without Docker: `cd frontend && npm ci && npm run build`, then run the API with `FRONTEND_DIST=../frontend/dist NODE_ENV=production node src/server.js` (use pm2 or systemd).

## Alternative: static site + API subdomain
> SEO note: with this setup, product/category pages are not pre-filled with titles, descriptions and structured data for crawlers (Google still renders JavaScript, but WhatsApp/Instagram link previews won't show product details). The single-service setup above is recommended for SEO.

Frontend on Vercel/Netlify/Cloudflare Pages (`VITE_API_URL=https://api.your-domain.in`, SPA fallback to `index.html`), API on `api.your-domain.in`. Set `COOKIE_DOMAIN=.your-domain.in` so the CSRF cookie is readable by the site, and `CORS_ORIGINS=https://www.your-domain.in`. Proxy `/sitemap.xml` and `/robots.txt` to the API.

## Images
`STORAGE_DRIVER=local` keeps uploads on the server disk (mount a persistent volume at `backend/uploads`). For multiple instances or ephemeral hosts use `STORAGE_DRIVER=cloudinary`. Customer unboxing videos for return claims are stored in `backend/private-uploads/returns` (never under the public `/uploads` path) and are streamed only to staff with the `returns:write` permission — mount a persistent, backed-up volume there too and delete videos after the return is closed plus your dispute window (e.g. 90 days). Seed images live in `backend/uploads/seed` and ship with the image; move them to Cloudinary/CDN later by exporting the CSV, uploading, and re-importing URLs.

## Database
MongoDB Atlas M10+ for production (M0 is fine for staging). Enable **continuous cloud backup** with point-in-time restore. Restrict network access to your host's IPs and use a dedicated database user with `readWrite` on the `eshtyle` DB only. Indexes are created automatically on startup (`autoIndex`); for very large collections build them during low traffic.

**Backup & recovery**: Atlas backups (daily snapshots + PITR) are the primary mechanism. Additionally run a weekly `mongodump --uri "$MONGODB_URI" --archive=eshtyle-$(date +%F).gz --gzip` to separate storage, and test a restore into a staging cluster every quarter (`mongorestore --gzip --archive=...`).

## Operations
- Health: `GET /health` (liveness), `GET /health/ready` (DB + integration flags).
- Logs: structured JSON (pino) on stdout with secrets redacted; ship to your host's log service.
- Background jobs (stock-release + tracking polling) run in the API process. With more than one instance, set `ENABLE_JOBS=true` on exactly one.
- Graceful shutdown on SIGTERM (finishes in-flight requests, closes DB).
- Data retention: OTPs and expired sessions are removed automatically (TTL indexes). Customers can delete their account; orders are retained for tax law (8 years under GST rules — confirm with your CA).
