import { app } from './app';
// Fallback if logger is missing in shared
let logger: any;
try {
  logger = require('@tripparty/shared/logger').logger;
} catch (e) {
  logger = console;
}

const PORT = process.env.PORT || 8000;

const start = () => {
  try {
    app.listen(PORT, () => {
      if (logger && typeof logger.info === 'function') {
        logger.info(`API Gateway listening on port ${PORT}`);
      } else {
        console.log(`API Gateway listening on port ${PORT}`);
      }
    });
  } catch (err) {
    if (logger && typeof logger.error === 'function') {
      logger.error(err, 'Failed to start API Gateway');
    } else {
      console.error('Failed to start API Gateway', err);
    }
    process.exit(1);
  }
};

start();
