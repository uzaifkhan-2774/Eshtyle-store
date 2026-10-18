import path from 'node:path';
import dotenv from 'dotenv';
import { BACKEND_ROOT } from './paths.js';
dotenv.config({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });
import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32),
  REFRESH_TOKEN_PEPPER: z.string().min(32),
  OTP_PEPPER: z.string().min(32),
  COOKIE_DOMAIN: z.string().optional(),
  TRUST_PROXY: z.coerce.number().default(0),
  LOG_LEVEL: z.string().default('info'),

  // Storage
  STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Email
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('E-SHTYLE <no-reply@example.com>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  ADMIN_ALERT_EMAIL: z.string().optional(),

  // SMS (India — DLT registration required)
  SMS_PROVIDER: z.enum(['none', 'console', 'msg91']).default('console'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_OTP_TEMPLATE_ID: z.string().optional(),
  MSG91_FLOW_TEMPLATE_ID: z.string().optional(),

  // Payments
  PAYMENT_PROVIDER: z.enum(['razorpay', 'cashfree', 'none']).default('none'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  CASHFREE_APP_ID: z.string().optional(),
  CASHFREE_SECRET_KEY: z.string().optional(),
  CASHFREE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),

  // Shiprocket
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_PICKUP_LOCATION: z.string().optional(),
  SHIPROCKET_PICKUP_PINCODE: z.string().optional(),
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional(),
  SHIPROCKET_BASE_URL: z.string().url().default('https://apiv2.shiprocket.in/v1/external'),

  // Meta (Facebook/Instagram) Conversions API — server-side Purchase events for ad optimisation
  META_CAPI_TOKEN: z.string().optional(),
  META_GRAPH_VERSION: z.string().default('v24.0'),
  META_TEST_EVENT_CODE: z.string().optional(),

  ENABLE_JOBS: bool.default('true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Print only the names of invalid variables — never their values.
  console.error('Invalid environment configuration:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}
const env = parsed.data;

if (env.NODE_ENV === 'production') {
  const problems = [];
  if (env.EMAIL_PROVIDER === 'console') problems.push('EMAIL_PROVIDER must be a real provider in production');
  if (env.SMS_PROVIDER === 'console') problems.push('SMS_PROVIDER must be msg91, or none to launch with email login only');
  if (env.SMS_PROVIDER === 'msg91' && !(env.MSG91_AUTH_KEY && env.MSG91_OTP_TEMPLATE_ID)) problems.push('SMS_PROVIDER=msg91 needs MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID');
  if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) problems.push('EMAIL_PROVIDER=resend needs RESEND_API_KEY');
  if (env.EMAIL_PROVIDER === 'smtp' && !(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)) problems.push('EMAIL_PROVIDER=smtp needs SMTP_HOST, SMTP_USER and SMTP_PASS');
  if (env.STORAGE_DRIVER === 'local') console.warn('[env] STORAGE_DRIVER=local in production: uploaded images live on the server disk. Use cloudinary for multi-instance hosting.');
  if (problems.length) {
    console.error('Production configuration errors:', problems.join('; '));
    process.exit(1);
  }
}

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
export const integrations = {
  payment: env.PAYMENT_PROVIDER === 'razorpay' ? Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)
    : env.PAYMENT_PROVIDER === 'cashfree' ? Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY) : false,
  shiprocket: Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD && env.SHIPROCKET_PICKUP_LOCATION),
  email: env.EMAIL_PROVIDER !== 'console',
  sms: env.SMS_PROVIDER === 'msg91',
  phoneLogin: env.SMS_PROVIDER !== 'none',
  metaCapi: Boolean(env.META_CAPI_TOKEN),
  cloudinary: env.STORAGE_DRIVER === 'cloudinary' && Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
};
export default env;
