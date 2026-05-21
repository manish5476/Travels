import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorMiddleware, requestLogger, requestId } from '@tripparty/shared';
import vendorRoutes from './routes/vendor.routes';

export function createApp() {
  const app = express();

  // ── Security & parsing ───────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(requestId);
  app.use(requestLogger);

  // ── Health check ─────────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'vendor', ts: new Date() }));

  // ── Routes ───────────────────────────────────────────────────────────
  app.use('/v1/vendors', vendorRoutes);

  // ── Error handler (must be last) ─────────────────────────────────────
  app.use(errorMiddleware);

  return app;
}
