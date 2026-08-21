/**
 * Campaign Orchestrator - RabbitMQ Queue Client
 * Handles publishing messages to worker queues
 */
import amqp from 'amqplib';
import config from './config.js';
import logger from './logger.js';

let connection = null;
let channel = null;
let isConnecting = false;

/**
 * Establish RabbitMQ connection
 */
async function connect() {
  if (connection && connection.close) {
    return connection;
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return connection;
  }

  isConnecting = true;
  
  try {
    connection = await amqp.connect(config.RABBITMQ_URL);
    
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { error: err.message });
      connection = null;
      channel = null;
    });
    
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      connection = null;
      channel = null;
    });

    channel = await connection.createConfirmChannel();
    
    // Declare queues
    await channel.assertQueue(config.RABBITMQ_QUEUE_CAMPAIGN, { durable: true });
    await channel.assertQueue(config.RABBITMQ_QUEUE_PROCESSOR, { durable: true });
    await channel.assertQueue(config.RABBITMQ_QUEUE_INTELLIGENCE, { durable: true });
    await channel.assertQueue(config.RABBITMQ_QUEUE_PUBLISHER, { durable: true });
    
    logger.info('RabbitMQ connected and queues declared');
    isConnecting = false;
    return connection;
  } catch (error) {
    isConnecting = false;
    logger.error('Failed to connect to RabbitMQ', { error: error.message });
    throw error;
  }
}

/**
 * Publish message to queue with persistence and confirmation
 */
export async function publishToQueue(queueName, message, options = {}) {
  if (!channel) {
    await connect();
  }

  const content = Buffer.from(JSON.stringify(message));
  const publishOptions = {
    persistent: true,
    contentType: 'application/json',
    timestamp: Date.now(),
    messageId: options.messageId || `${queueName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...options,
  };

  return new Promise((resolve, reject) => {
    channel.sendToQueue(queueName, content, publishOptions, (err, ok) => {
      if (err) {
        logger.error('Failed to publish message', { queue: queueName, error: err.message });
        reject(err);
      } else {
        logger.debug('Message published', { queue: queueName, messageId: publishOptions.messageId });
        resolve(ok);
      }
    });
  });
}

/**
 * Publish to multiple queues (fanout pattern)
 */
export async function publishToQueues(queueNames, message) {
  const results = await Promise.allSettled(
    queueNames.map(queue => publishToQueue(queue, message))
  );
  
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    logger.error('Some queue publications failed', { failed: failed.length });
  }
  
  return results;
}

/**
 * Consume messages from queue
 */
export async function consumeFromQueue(queueName, handler, options = {}) {
  if (!channel) {
    await connect();
  }

  const prefetch = options.prefetch || config.WORKER_CONCURRENCY;
  await channel.prefetch(prefetch);

  await channel.consume(queueName, async (msg) => {
    if (!msg) return;

    const startTime = Date.now();
    let parsedMessage;
    
    try {
      parsedMessage = JSON.parse(msg.content.toString());
      logger.debug('Received message', { queue: queueName, messageId: msg.properties.messageId });
      
      await handler(parsedMessage, msg);
      
      channel.ack(msg);
      logger.debug('Message processed', { queue: queueName, duration: Date.now() - startTime });
    } catch (error) {
      logger.error('Message handler failed', { 
        queue: queueName, 
        error: error.message,
        message: parsedMessage,
      });
      
      // Requeue with exponential backoff logic could go here
      const requeue = options.requeue !== false;
      channel.nack(msg, false, requeue);
    }
  }, { noAck: false });

  logger.info('Started consuming from queue', { queue: queueName, prefetch });
}

/**
 * Close connection
 */
export async function close() {
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
  logger.info('RabbitMQ connection closed');
}

/**
 * Health check
 */
export async function healthCheck() {
  try {
    if (!connection || !channel) {
      return { healthy: false, reason: 'Not connected' };
    }
    return { healthy: true, connected: true };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
}

export default {
  connect,
  publishToQueue,
  publishToQueues,
  consumeFromQueue,
  close,
  healthCheck,
};