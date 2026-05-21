import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import pinoHttp from 'pino-http';
// Fallback if logger is missing in shared
let logger: any;
try {
  logger = require('@tripparty/shared/logger').logger;
} catch (e) {
  logger = console;
}

const app = express();

app.use(helmet());
app.use(cors());
if (logger && logger !== console) {
  app.use(pinoHttp({ logger }));
}

// Global middlewares for the gateway (like JWT validation) can be injected here
// let jwtAuth: any = (req: any, res: any, next: any) => next();
// try {
//   jwtAuth = require('@tripparty/shared/middlewares/auth.middleware').authMiddleware;
// } catch(e) {}
// Add these two lines to services/api-gateway/src/app.ts
// alongside your existing service proxies

app.use('/v1/vendors', createProxyMiddleware({
  target: process.env.VENDOR_SERVICE_URL || 'http://vendor:8012',
  changeOrigin: true,
  on: { error: (err, _req, res: any) => res.status(502).json({ success: false, message: 'Vendor service unavailable' }) },
}));

app.use('/v1/bookings', createProxyMiddleware({
  target: process.env.BOOKING_SERVICE_URL || 'http://booking:8013',
  changeOrigin: true,
  on: { error: (err, _req, res: any) => res.status(502).json({ success: false, message: 'Booking service unavailable' }) },
}));

// app.use('/v1/vendors', createProxyMiddleware({
//   target: 'http://localhost:8012',
//   changeOrigin: true,
//   pathRewrite: {
//     '^/v1/vendors': '/v1/vendors'
//   }
// }));

// app.use('/v1/bookings', createProxyMiddleware({
//   target: 'http://localhost:8013',
//   changeOrigin: true,
//   pathRewrite: {
//     '^/v1/bookings': '/v1/bookings'
//   }
// }));

export { app };
