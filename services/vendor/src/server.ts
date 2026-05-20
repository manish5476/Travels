import { app } from './app';
import mongoose from 'mongoose';
import { logger } from '@tripparty/shared/logger';

const PORT = process.env.PORT || 8012;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tripparty_vendor';

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to Vendor MongoDB');

    app.listen(PORT, () => {
      logger.info(`Vendor Service listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error(err, 'Failed to start Vendor Service');
    process.exit(1);
  }
};

start();
