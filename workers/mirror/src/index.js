import amqp from 'amqplib';
import config from './config.js';
import logger from './logger.js';
import { processMirrorJob } from './processor.js';
import { closePool } from './db.js';

let connection = null;
let channel = null;
let isShuttingDown = false;

async function connectRabbitMQ() {
  const maxRetries = 10;
  let retries = 0;

  while (retries < maxRetries && !isShuttingDown) {
    try {
      connection = await amqp.connect(config.RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertExchange(config.RABBITMQ_EXCHANGE, config.RABBITMQ_EXCHANGE_TYPE, { durable: true });
      await channel.assertQueue(config.RABBITMQ_QUEUE, { durable: true });
      await channel.bindQueue(config.RABBITMQ_QUEUE, config.RABBITMQ_EXCHANGE, config.ROUTING_KEY);

      channel.prefetch(config.CONCURRENCY);

      logger.info({ queue: config.RABBITMQ_QUEUE, exchange: config.RABBITMQ_EXCHANGE }, 'Connected to RabbitMQ');

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        if (!isShuttingDown) {
          setTimeout(connectRabbitMQ, 5000);
        }
      });

      connection.on('error', (err) => {
        logger.error({ err }, 'RabbitMQ connection error');
      });

      return channel;
    } catch (error) {
      retries++;
      logger.error({ err: error, attempt: retries, maxRetries }, 'Failed to connect to RabbitMQ');
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  throw new Error('Failed to connect to RabbitMQ after max retries');
}

async function processMessage(msg) {
  if (!msg) return;

  const startTime = Date.now();
  let jobData = null;

  try {
    const content = msg.content.toString();
    jobData = JSON.parse(content);

    logger.debug({ jobData }, 'Received mirror job');

    await processMirrorJob(jobData);

    channel.ack(msg);
    logger.debug({ duration: Date.now() - startTime }, 'Message acknowledged');

  } catch (error) {
    logger.error({ err: error, jobData }, 'Failed to process mirror job');

    // Don't requeue on validation errors, only on transient failures
    const isValidationError = error.message.includes('not found') || error.message.includes('exceeds maximum');

    if (isValidationError) {
      channel.ack(msg);
      logger.warn('Validation error, message acknowledged without requeue');
    } else {
      channel.nack(msg, false, true); // Requeue for retry
    }
  }
}

async function startWorker() {
  logger.info('Starting Mirror Worker');

  const channel = await connectRabbitMQ();

  await channel.consume(config.RABBITMQ_QUEUE, processMessage, { noAck: false });

  logger.info({ concurrency: config.CONCURRENCY }, 'Mirror Worker consuming messages');
}

async function shutdown() {
  logger.info('Shutting down Mirror Worker');
  isShuttingDown = true;

  if (channel) {
    await channel.close();
  }
  if (connection) {
    await connection.close();
  }
  await closePool();

  logger.info('Mirror Worker stopped');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startWorker().catch((error) => {
  logger.error({ err: error }, 'Mirror Worker failed to start');
  process.exit(1);
});

export { startWorker, shutdown };