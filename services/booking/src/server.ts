import { app } from './app';
import mongoose from 'mongoose';
import { logger } from '@tripparty/shared/logger';
// Initialize Kafka producer singleton here if needed by the shared library setup
// import { kafkaProducer } from '@tripparty/shared/events/kafkaProducer';

const PORT = process.env.PORT || 8013;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tripparty_booking';

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to Booking MongoDB');

    // await kafkaProducer.connect();
    // logger.info('Connected to Kafka');

    app.listen(PORT, () => {
      logger.info(`Booking Service listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error(err, 'Failed to start Booking Service');
    process.exit(1);
  }
};

start();
