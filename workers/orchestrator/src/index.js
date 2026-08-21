/**
 * Campaign Orchestrator Worker - Entry Point
 * 
 * Main worker that:
 * 1. Consumes campaign creation requests from queue
 * 2. Orchestrates multi-platform viral campaigns
 * 3. Coordinates with intelligence, processor, and publisher workers
 * 4. Provides health checks and metrics
 */
import config from './config.js';
import logger from './logger.js';
import db from './db.js';
import { CampaignOrchestrator } from './orchestrator.js';
import { connect, consumeFromQueue, close as closeQueue, healthCheck as queueHealth } from './queue.js';

const orchestrator = new CampaignOrchestrator();

/**
 * Handle campaign creation request from queue
 */
async function handleCreateCampaign(message) {
  const { workspaceId, videoId, name, platforms, niche, goal, budget, abTestEnabled, customHooks, scheduleStrategy } = message;
  
  logger.info('Processing campaign creation', { workspaceId, videoId, name });

  try {
    const result = await orchestrator.createCampaign({
      workspaceId,
      videoId,
      name,
      platforms,
      niche,
      goal,
      budget,
      abTestEnabled,
      customHooks,
      scheduleStrategy,
    });

    logger.info('Campaign created successfully', { campaignId: result.campaign.id });
    return result;
  } catch (error) {
    logger.error('Campaign creation failed', { error: error.message, workspaceId, videoId });
    throw error;
  }
}

/**
 * Handle campaign status check request
 */
async function handleCampaignStatus(message) {
  const { campaignId } = message;
  
  try {
    const campaign = await db.getCampaign(campaignId);
    if (!campaign) {
      return { error: 'Campaign not found' };
    }

    const variants = await db.getCampaignVariants(campaignId);
    const scheduledPosts = await db.getCampaignScheduledPosts(campaignId);
    const metrics = await db.getCampaignMetrics(campaignId);

    return { campaign, variants, scheduledPosts, metrics };
  } catch (error) {
    logger.error('Campaign status check failed', { error: error.message, campaignId });
    throw error;
  }
}

/**
 * Handle A/B test completion check
 */
async function handleABTestCheck(message) {
  const { testId } = message;
  
  try {
    const abTest = await db.getABTest(testId);
    if (!abTest || abTest.status !== 'running') {
      return abTest;
    }

    // Get metrics for each variant
    // This would compare performance and determine winner
    // For now, return the test as-is
    return abTest;
  } catch (error) {
    logger.error('A/B test check failed', { error: error.message, testId });
    throw error;
  }
}

/**
 * Message router - routes incoming messages to handlers
 */
async function routeMessage(message, msg) {
  const { type, payload } = message;
  
  logger.debug('Routing message', { type, messageId: msg.properties.messageId });

  switch (type) {
    case 'create_campaign':
      return await handleCreateCampaign(payload);
    
    case 'campaign_status':
      return await handleCampaignStatus(payload);
    
    case 'ab_test_check':
      return await handleABTestCheck(payload);
    
    default:
      logger.warn('Unknown message type', { type });
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Start the worker
 */
async function start() {
  logger.info('Starting Campaign Orchestrator Worker', { version: config.VERSION });

  try {
    // Initialize database
    await db.initializeTables();
    
    // Connect to RabbitMQ
    await connect();
    
    // Start consuming from campaign queue
    await consumeFromQueue(config.RABBITMQ_QUEUE_CAMPAIGN, routeMessage, {
      prefetch: config.WORKER_CONCURRENCY,
    });

    logger.info('Campaign Orchestrator Worker started successfully');
    
    // Log startup info
    logger.info('Configuration', {
      concurrency: config.WORKER_CONCURRENCY,
      defaultPlatforms: config.DEFAULT_PLATFORMS,
      maxVariantsPerPlatform: config.MAX_VARIANTS_PER_PLATFORM,
      abTestingEnabled: config.ENABLE_AB_TESTING,
    });

  } catch (error) {
    logger.error('Failed to start worker', { error: error.message });
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await closeQueue();
    await db.close();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

// Start the worker
start();

export { orchestrator, start, shutdown };