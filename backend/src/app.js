import express from 'express';
import path from 'node:path';
import { BACKEND_ROOT } from './config/paths.js';
import fs from 'node:fs';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import env, { corsOrigins, isProd, integrations } from './config/env.js';
import logger from './lib/logger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { csrfProtect } from './middleware/csrf.js';
import { optionalAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { UPLOAD_DIR } from './services/storage.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import accountRoutes from './routes/account.js';
import checkoutRoutes from './routes/checkout.js';
import webhookRoutes from './routes/webhooks.js';
import miscRoutes from './routes/misc.js';
import adminRoutes from './routes/admin/index.js';
import seoRoutes from './routes/seo.js';
import { metaForPath, injectMeta } from './services/seoRender.js';
import logger2 from './lib/logger.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  app.use(pinoHttp({ logger, genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(), autoLogging: { ignore: (req) => req.url.startsWith('/uploads') || req.url === '/health' }, customProps: () => ({}) }));
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://checkout.razorpay.com', 'https://sdk.cashfree.com', 'https://www.googletagmanager.com', 'https://connect.facebook.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://www.facebook.com', 'https://www.google-analytics.com'],
        mediaSrc: ["'self'", 'https://res.cloudinary.com'],
        connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', 'https://*.cashfree.com', 'https://www.google-analytics.com', 'https://*.google-analytics.com'],
        frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://*.cashfree.com'],
        objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'", 'https://*.cashfree.com'], frameAncestors: ["'none'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));
  app.use(compression());
  app.use(cors({ origin: (origin, cb) => (!origin || corsOrigins.includes(origin) ? cb(null, true) : cb(null, false)), credentials: true }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));
  app.get('/health/ready', (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({ ok: db, db, integrations });
  });
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, fallthrough: false }));
  app.use(seoRoutes);

  // Webhooks need the raw body for signature checks — mounted before JSON parsing and CSRF.
  app.use('/api/v1/webhooks', webhookRoutes);

  app.use('/api/v1', express.json({ limit: '200kb' }), apiLimiter, csrfProtect, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/catalog', (req, res, next) => { if (req.method === 'GET') res.set('Cache-Control', 'public, max-age=60'); next(); }, catalogRoutes);
  app.use('/api/v1/cart', optionalAuth, cartRoutes);
  app.use('/api/v1/account', accountRoutes);
  app.use('/api/v1/checkout', checkoutRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1', miscRoutes);
  app.use('/api', notFoundHandler);

  // Optional: serve the built storefront from the same origin (single-service deployment).
  const dist = process.env.FRONTEND_DIST ? path.resolve(BACKEND_ROOT, process.env.FRONTEND_DIST) : null;
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    app.use(express.static(dist, { maxAge: '1y', index: false, setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
    app.get('*', async (req, res) => {
      let html = indexHtml; let status = 200;
      try {
        const meta = await metaForPath(req.path);
        if (meta === null) status = 404; // product/category that doesn't exist: tell crawlers
        html = injectMeta(indexHtml, meta);
      } catch (e) { logger2.warn({ err: e.message }, 'seo render failed'); }
      res.status(status).set('Cache-Control', 'no-cache').type('html').send(html);
    });
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
