import 'dotenv/config';
import config from './config.js';
import logger from './logger.js';
import db from './db/index.js';
import queueConsumer from './queue/consumer.js';
import viralPredictor from './models/viralPredictor.js';
import hookGenerator from './hooks/generator.js';
import conceptGenerator from './concepts/generator.js';

async function initialize() {
  logger.info('Initializing Intelligence Worker...');

  try {
    // Initialize database
    await db.initializeTables();
    logger.info('Database initialized');

    // Initialize ML model
    await viralPredictor.load();
    logger.info('Viral predictor model initialized');

    // Connect to message queue
    await queueConsumer.connect();
    logger.info('Queue consumer connected');

    // Schedule nightly training job (runs at 2 AM UTC)
    scheduleNightlyTraining();
    logger.info('Nightly training scheduled');

    logger.info('Intelligence Worker started successfully');
  } catch (err) {
    logger.error('Failed to initialize Intelligence Worker', { error: err.message });
    process.exit(1);
  }
}

// Schedule nightly training at 2 AM UTC
function scheduleNightlyTraining() {
  const now = new Date();
  const nextRun = new Date();
  nextRun.setUTCHours(2, 0, 0, 0);
  
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }
  
  const msUntilRun = nextRun.getTime() - now.getTime();
  
  setTimeout(async () => {
    try {
      logger.info('Running scheduled nightly training');
      await viralPredictor.runNightlyTraining();
    } catch (err) {
      logger.error('Nightly training failed', { error: err.message });
    }
    
    // Schedule next run (24 hours)
    setInterval(async () => {
      try {
        logger.info('Running scheduled nightly training');
        await viralPredictor.runNightlyTraining();
      } catch (err) {
        logger.error('Nightly training failed', { error: err.message });
      }
    }, 24 * 60 * 60 * 1000);
  }, msUntilRun);
}

// Health check endpoint data
let healthStatus = {
  status: 'starting',
  timestamp: new Date().toISOString(),
  checks: {
    database: false,
    model: false,
    queue: false,
  },
};

async function updateHealth() {
  try {
    // Check database
    await db.query('SELECT 1');
    healthStatus.checks.database = true;
  } catch (err) {
    healthStatus.checks.database = false;
  }

  // Check model
  healthStatus.checks.model = viralPredictor.isLoaded;

  // Check queue
  healthStatus.checks.queue = !!queueConsumer.channel;

  healthStatus.status = Object.values(healthStatus.checks).every(v => v) ? 'healthy' : 'degraded';
  healthStatus.timestamp = new Date().toISOString();
}

setInterval(updateHealth, 30000);

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down Intelligence Worker...');
  healthStatus.status = 'shutting down';

  try {
    await queueConsumer.close();
    await db.close();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason: reason?.message || reason });
});

// Start the worker
initialize();

export default {
  viralPredictor,
  hookGenerator,
  conceptGenerator,
  queueConsumer,
  getHealth: () => healthStatus,
};

// TODO LIST UPDATE
// - [x] Phase 1: Core Engine Completion (Weeks 1-4)
// - [ ] Phase 2: Intelligence Loop & Analytics (Weeks 5-8)
// - [ ] Phase 3: Growth Features & Polish (Weeks 9-12)
// - [ ] Immediate: Complete FFmpeg processor with scene detection & auto-captions
// - [ ] Immediate: Wire ViralPredictor training pipeline using post_metrics hypertable
// - [ ] Immediate: Build Playwright publisher for TikTok + Instagram
// - [ ] Immediate: Implement hook A/B testing integration
// - [ ] Immediate: Add WebSocket real-time updates to dashboard
// - [ ] Immediate: Build Campaign Orchestrator (1 video -> all platforms)
// - [ ] Immediate: Create Viral Boost Dashboard for solo creators
// - [ ] Immediate: Add official API publishers (TikTok, Instagram, YouTube)
