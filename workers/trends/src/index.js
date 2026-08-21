import { config } from './config.js';
import { logger } from './logger.js';
import { db } from './db.js';
import { runTrendDetectionJob, healthCheck, scrapeTikTokTrends, scrapeInstagramTrends, scrapeYouTubeTrends, scrapeTwitterTrends, scrapeLinkedInTrends } from './platforms/index.js';
import { processTrendForConcepts } from './concepts/generator.js';
import { createServer } from 'http';
import amqp from 'amqplib';
import cron from 'node-cron';

// Start HTTP server for health checks
const server = createServer(async (req, res) => {
  if (req.url === '/health') {
    const health = await healthCheck();
    res.writeHead(health.status === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  } else if (req.url === '/health/live') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'alive', timestamp: new Date().toISOString() }));
  } else if (req.url === '/health/ready') {
    const health = await healthCheck();
    res.writeHead(health.status === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(config.port, () => {
  logger.info({ port: config.port }, 'Trends worker HTTP server started');
});

// RabbitMQ connection for concept queue
let conceptChannel = null;
async function connectConceptQueue() {
  try {
    const connection = await amqp.connect(config.rabbitmq.url);
    conceptChannel = await connection.createChannel();
    await conceptChannel.assertQueue('concept.generation', { durable: true });
    logger.info('Connected to concept generation queue');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to concept queue');
  }
}

// Enhanced trend detection with concept generation
async function runEnhancedTrendDetectionJob() {
  logger.info('Running enhanced trend detection with concept generation');
  
  try {
    // Get active users who want trend-based concepts
    const users = await db.getUsersWithTrendPreferences();
    
    // Run standard trend detection
    const trends = await runTrendDetectionJob();
    
    // For each user, process top trends for concept generation
    for (const user of users) {
      const relevantTrends = trends.filter(t => 
        user.preferredPlatforms.includes(t.platform) &&
        (user.preferredCategories.length === 0 || user.preferredCategories.includes(t.category))
      ).slice(0, 5); // Top 5 relevant trends per user
      
      for (const trend of relevantTrends) {
        try {
          await processTrendForConcepts(trend, user.id);
        } catch (error) {
          logger.error({ err: error, userId: user.id, trendId: trend.id }, 'Failed to process trend for user');
        }
      }
    }
    
    logger.info({ trendsFound: trends.length, usersProcessed: users.length }, 'Enhanced trend detection complete');
    return trends;
  } catch (error) {
    logger.error({ err: error }, 'Enhanced trend detection job failed');
    throw error;
  }
}

// Schedule trend detection job
if (config.trends.detectionInterval) {
  cron.schedule(config.trends.detectionInterval, async () => {
    logger.info('Running scheduled enhanced trend detection job');
    try {
      await runEnhancedTrendDetectionJob();
    } catch (error) {
      logger.error({ err: error }, 'Scheduled enhanced trend detection job failed');
    }
  });
  logger.info({ schedule: config.trends.detectionInterval }, 'Enhanced trend detection job scheduled');
}

// Run initial detection on startup
setTimeout(async () => {
  logger.info('Running initial enhanced trend detection on startup');
  await connectConceptQueue();
  try {
    await runEnhancedTrendDetectionJob();
  } catch (error) {
    logger.error({ err: error }, 'Initial enhanced trend detection failed');
  }
}, 5000);

// Graceful shutdown
async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down trends worker');
  server.close();
  if (conceptChannel) await conceptChannel.close();
  await db.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info('Trends worker started');
