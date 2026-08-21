import 'dotenv/config';
import { getConfig } from './config.js';
import { logger } from './logger.js';
import { deliveryWorker } from './queue.js';
import { startScheduler, stopScheduler } from './scheduler.js';

const config = getConfig();

async function main(): Promise<void> {
  logger.info({ version: '1.0.0', env: config.NODE_ENV }, 'Starting Delivery Worker');

  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down Delivery Worker');
    stopScheduler();
    await deliveryWorker.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start the scheduler
  startScheduler();

  logger.info('Delivery Worker started successfully');
}

main().catch((error) => {
  logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Delivery Worker failed to start');
  process.exit(1);
});
