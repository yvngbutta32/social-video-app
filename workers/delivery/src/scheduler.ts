import cron from 'node-cron';
import { getConfig } from './config.js';
import { logger } from './logger.js';
import { scheduleRecurringDeliveries } from './queue.js';

const config = getConfig();

export function startScheduler(): void {
  logger.info('Starting delivery scheduler');

  // Run recurring deliveries every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled delivery check');
    try {
      await scheduleRecurringDeliveries();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Scheduled delivery check failed');
    }
  });

  // Also run on startup
  scheduleRecurringDeliveries().catch((error) => {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Initial delivery check failed');
  });

  logger.info('Delivery scheduler started');
}

export function stopScheduler(): void {
  cron.getTasks().forEach(task => task.stop());
  logger.info('Delivery scheduler stopped');
}