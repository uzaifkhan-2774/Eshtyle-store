import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.otp', '*.code', '*.token', '*.secret', '*.razorpay_signature', 'password', 'otp', 'token'],
    censor: '[redacted]',
  },
  base: { service: 'eshtyle-api' },
});
export default logger;
