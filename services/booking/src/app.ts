import express from 'express';
import 'express-async-errors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from '@tripparty/shared/logger';
import { errorHandler } from '@tripparty/shared/middlewares/error.middleware';
import { HttpError } from '@tripparty/shared/errors/HttpError';
import bookingRoutes from './routes/booking.routes';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.use('/', bookingRoutes);

app.all('*', () => {
  throw new HttpError(404, 'Not Found');
});

app.use(errorHandler);

export { app };
