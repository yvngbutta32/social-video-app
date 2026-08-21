const amqp = require('amqplib');
const config = require('../config');
const logger = require('../logger');
const viralPredictor = require('../models/viralPredictor');
const hookGenerator = require('../hooks/generator');
const conceptGenerator = require('../concepts/generator');
const db = require('../db');

class IntelligenceQueueConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queues = config.rabbitmq.queues;
  }

  async connect() {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      // Set prefetch for fair dispatch
      await this.channel.prefetch(10);

      // Assert queues
      for (const queue of Object.values(this.queues)) {
        await this.channel.assertQueue(queue, { durable: true });
      }

      // Handle connection events
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', { error: err.message });
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting reconnect...');
        setTimeout(() => this.connect(), 5000);
      });

      logger.info('Connected to RabbitMQ');

      // Start consumers
      await this.consumeViralPrediction();
      await this.consumeHookGeneration();
      await this.consumeTrendToConcept();
      await this.consumeConceptOptimization();

    } catch (err) {
      logger.error('Failed to connect to RabbitMQ', { error: err.message });
      setTimeout(() => this.connect(), 5000);
    }
  }

  async consumeViralPrediction() {
    await this.channel.consume(this.queues.viralPrediction, async (msg) => {
      if (!msg) return;

      const startTime = Date.now();
      try {
        const task = JSON.parse(msg.content.toString());
        logger.info('Processing viral prediction task', { videoId: task.videoId, platform: task.platform });

        const result = await viralPredictor.predict(task.videoData, task.userData, { platform: task.platform });

        // Save prediction
        await db.createViralPrediction({
          video_id: task.videoId,
          user_id: task.userId,
          platform: task.platform,
          ...result,
        });

        // Publish result for downstream processing
        await this.publishResult('viral.prediction.completed', {
          ...task,
          prediction: result,
          processingTime: Date.now() - startTime,
        });

        this.channel.ack(msg);
        logger.info('Viral prediction completed', { videoId: task.videoId, score: result.viralScore, time: Date.now() - startTime });

      } catch (err) {
        logger.error('Viral prediction failed', { error: err.message });
        this.channel.nack(msg, false, false); // Don't requeue, send to DLQ
      }
    });
  }

  async consumeHookGeneration() {
    await this.channel.consume(this.queues.hookGeneration, async (msg) => {
      if (!msg) return;

      const startTime = Date.now();
      try {
        const task = JSON.parse(msg.content.toString());
        logger.info('Processing hook generation task', { videoId: task.videoId, platform: task.platform });

        const hooks = await hookGenerator.generateHooks(task.videoData, task.userData, task.platform, task.count);

        // Publish result
        await this.publishResult('hook.generation.completed', {
          ...task,
          hooks: hooks.map(h => ({
            id: h.id,
            type: h.hook_type,
            text: h.hook_text,
            score: h.hook_score,
            position: h.position,
          })),
          processingTime: Date.now() - startTime,
        });

        this.channel.ack(msg);
        logger.info('Hook generation completed', { videoId: task.videoId, count: hooks.length, time: Date.now() - startTime });

      } catch (err) {
        logger.error('Hook generation failed', { error: err.message });
        this.channel.nack(msg, false, false);
      }
    });
  }

  async consumeTrendToConcept() {
    await this.channel.consume(this.queues.trendToConcept, async (msg) => {
      if (!msg) return;

      const startTime = Date.now();
      try {
        const task = JSON.parse(msg.content.toString());
        logger.info('Processing trend-to-concept task', { trendId: task.trendId, userId: task.userId });

        const concepts = await conceptGenerator.generateConceptsFromTrend(
          task.trendData,
          task.userData,
          task.platforms
        );

        // Publish result
        await this.publishResult('trend.to.concept.completed', {
          ...task,
          concepts: concepts.map(c => ({
            id: c.id,
            title: c.concept_title,
            description: c.concept_description,
            viralPotential: c.viral_potential,
            platform: c.platform,
            difficulty: c.difficulty,
            estimatedDuration: c.estimated_duration,
          })),
          processingTime: Date.now() - startTime,
        });

        this.channel.ack(msg);
        logger.info('Trend-to-concept completed', { trendId: task.trendId, count: concepts.length, time: Date.now() - startTime });

      } catch (err) {
        logger.error('Trend-to-concept failed', { error: err.message });
        this.channel.nack(msg, false, false);
      }
    });
  }

  async consumeConceptOptimization() {
    await this.channel.consume(this.queues.conceptOptimization, async (msg) => {
      if (!msg) return;

      const startTime = Date.now();
      try {
        const task = JSON.parse(msg.content.toString());
        logger.info('Processing concept optimization task', { conceptId: task.conceptId });

        const optimized = await conceptGenerator.optimizeConcept(task.conceptId, task.feedbackData);

        // Publish result
        await this.publishResult('concept.optimization.completed', {
          ...task,
          optimizedConcept: optimized,
          processingTime: Date.now() - startTime,
        });

        this.channel.ack(msg);
        logger.info('Concept optimization completed', { conceptId: task.conceptId, time: Date.now() - startTime });

      } catch (err) {
        logger.error('Concept optimization failed', { error: err.message });
        this.channel.nack(msg, false, false);
      }
    });
  }

  async publishResult(routingKey, data) {
    try {
      const exchange = 'intelligence.results';
      await this.channel.assertExchange(exchange, 'topic', { durable: true });
      this.channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(data)), {
        persistent: true,
        contentType: 'application/json',
      });
    } catch (err) {
      logger.error('Failed to publish result', { routingKey, error: err.message });
    }
  }

  // Publish tasks to queues
  async publishViralPrediction(task) {
    await this.channel.sendToQueue(this.queues.viralPrediction, Buffer.from(JSON.stringify(task)), {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async publishHookGeneration(task) {
    await this.channel.sendToQueue(this.queues.hookGeneration, Buffer.from(JSON.stringify(task)), {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async publishTrendToConcept(task) {
    await this.channel.sendToQueue(this.queues.trendToConcept, Buffer.from(JSON.stringify(task)), {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async publishConceptOptimization(task) {
    await this.channel.sendToQueue(this.queues.conceptOptimization, Buffer.from(JSON.stringify(task)), {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    logger.info('RabbitMQ connection closed');
  }
}

module.exports = new IntelligenceQueueConsumer();