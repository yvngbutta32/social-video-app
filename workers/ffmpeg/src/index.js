/**
 * FFmpeg Video Processing Worker
 * Handles platform-specific video variant generation
 * Consumes jobs from RabbitMQ, processes with FFmpeg, uploads to MinIO
 */

import { createConnection, Channel } from 'amqplib';
import { MinioClient } from './minio.js';
import { DbClient } from './db.js';
import { processVideoJob } from './processor.js';
import { logger } from './logger.js';
import { config } from './config.js';

const QUEUE_NAME = 'video_processing';
const DLQ_NAME = 'video_processing_dlq';
const MAX_RETRIES = 3;

class FFmpegWorker {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.minio = new MinioClient();
    this.db = new DbClient();
    this.isShuttingDown = false;
  }

  async start() {
    logger.info('Starting FFmpeg worker...');

    // Initialize connections
    await this.minio.connect();
    await this.db.connect();
    await this.connectRabbitMQ();

    // Setup queues
    await this.setupQueues();

    // Start consuming
    await this.consume();

    // Handle graceful shutdown
    this.setupSignalHandlers();

    logger.info('FFmpeg worker started successfully');
  }

  async connectRabbitMQ() {
    const rabbitmqUrl = config.rabbitmqUrl;
    this.connection = await createConnection(rabbitmqUrl);
    this.channel = await this.connection.createChannel();

    // Prefetch 1 job per worker for fair distribution
    await this.channel.prefetch(1);

    this.connection.on('error', (err) => {
      logger.error({ err }, 'RabbitMQ connection error');
    });

    this.connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      if (!this.isShuttingDown) {
        setTimeout(() => this.reconnect(), 5000);
      }
    });

    logger.info('Connected to RabbitMQ');
  }

  async reconnect() {
    logger.info('Attempting to reconnect to RabbitMQ...');
    try {
      await this.connectRabbitMQ();
      await this.setupQueues();
      await this.consume();
    } catch (err) {
      logger.error({ err }, 'Reconnection failed, retrying in 10s');
      setTimeout(() => this.reconnect(), 10000);
    }
  }

  async setupQueues() {
    // Dead letter queue
    await this.channel.assertQueue(DLQ_NAME, { durable: true });

    // Main queue with DLX
    await this.channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': DLQ_NAME,
        'x-message-ttl': 86400000, // 24 hours
      },
    });

    logger.info('Queues declared');
  }

  async consume() {
    await this.channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      const job = JSON.parse(msg.content.toString());
      const retryCount = msg.properties.headers?.['x-retry-count'] || 0;

      logger.info({ jobId: job.id, type: job.type, retryCount }, 'Processing job');

      try {
        await processVideoJob(job, this.minio, this.db, logger);
        this.channel.ack(msg);
        logger.info({ jobId: job.id }, 'Job completed successfully');
      } catch (err) {
        logger.error({ err, jobId: job.id, retryCount }, 'Job failed');

        if (retryCount >= MAX_RETRIES) {
          logger.error({ jobId: job.id }, 'Max retries exceeded, sending to DLQ');
          this.channel.nack(msg, false, false); // Don't requeue, goes to DLQ
        } else {
          // Requeue with incremented retry count
          this.channel.nack(msg, false, false);
          await this.requeueWithRetry(job, retryCount + 1);
        }
      }
    });

    logger.info(`Consuming from queue: ${QUEUE_NAME}`);
  }

  async requeueWithRetry(job, retryCount) {
    await this.channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(job)), {
      persistent: true,
      headers: {
        'x-retry-count': retryCount,
      },
    });
  }

  setupSignalHandlers() {
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutdown signal received');
      this.isShuttingDown = true;

      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      await this.db.disconnect();

      logger.info('Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Start worker
const worker = new FFmpegWorker();
worker.start().catch((err) => {
  logger.error({ err }, 'Failed to start worker');
  process.exit(1);
});

export { FFmpegWorker };