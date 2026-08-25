import { config } from './config.js';
import { logger } from './logger.js';
import { pgPool } from './db.js';
import { healthCheck, readinessCheck, livenessCheck } from './health.js';
import { processVideoJob } from './processor.js';
import { processPublishJob } from './publisher.js';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import express from 'express';
import cors from 'cors';

// Redis connection
const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// Queues
export const videoProcessingQueue = new Queue('video-processing', { connection: redis });
export const videoPublishingQueue = new Queue('video-publishing', { connection: redis });

// Queue events for monitoring
const processingEvents = new QueueEvents('video-processing', { connection: redis });
const publishingEvents = new QueueEvents('video-publishing', { connection: redis });

processingEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.info({ jobId, returnvalue }, 'Video processing job completed');
});

processingEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Video processing job failed');
});

publishingEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.info({ jobId, returnvalue }, 'Video publishing job completed');
});

publishingEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Video publishing job failed');
});

// Workers
const deps = { pgPool, redis, config, logger };

// Video processing worker
new Worker('video-processing', async (job) => {
  const childLogger = logger.child({ jobId: job.id, jobName: job.name });
  childLogger.info({ data: job.data }, 'Processing video job');
  
  try {
    const result = await processVideoJob(job, deps);
    return result;
  } catch (error) {
    childLogger.error({ err: error }, 'Video processing job error');
    throw error;
  }
}, { 
  connection: redis,
  concurrency: config.workers.videoConcurrency || 2,
  limiter: { max: 10, duration: 60000 },
});

// Video publishing worker
new Worker('video-publishing', async (job) => {
  const childLogger = logger.child({ jobId: job.id, jobName: job.name });
  childLogger.info({ data: job.data }, 'Processing publish job');
  
  try {
    const result = await processPublishJob(job, deps);
    return result;
  } catch (error) {
    childLogger.error({ err: error }, 'Video publishing job error');
    throw error;
  }
}, { 
  connection: redis,
  concurrency: config.workers.publishConcurrency || 3,
  limiter: { max: 20, duration: 60000 },
});

// Bull Board for queue monitoring
const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [
    new BullMQAdapter(videoProcessingQueue),
    new BullMQAdapter(videoPublishingQueue),
  ],
  serverAdapter,
});

// Express app for health checks and Bull Board
const app = express();
app.use(cors());
app.use(express.json());

// Health endpoints
app.get('/health', async (req, res) => {
  const health = await healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

app.get('/ready', async (req, res) => {
  const health = await readinessCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

app.get('/live', async (req, res) => {
  const health = await livenessCheck();
  res.status(200).json(health);
});

// Bull Board UI
serverAdapter.setBasePath('/admin/queues');
app.use('/admin/queues', serverAdapter.getRouter());

// Queue stats endpoint
app.get('/api/queues/stats', async (req, res) => {
  try {
    const [processingStats, publishingStats] = await Promise.all([
      videoProcessingQueue.getJobCounts(),
      videoPublishingQueue.getJobCounts(),
    ]);
    
    res.json({
      videoProcessing: processingStats,
      videoPublishing: publishingStats,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get queue stats');
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

// Manual job trigger endpoints (for testing)
app.post('/api/jobs/process-video', async (req, res) => {
  try {
    const { videoId, platforms } = req.body;
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }
    
    const job = await videoProcessingQueue.add('process-video', { videoId, platforms });
    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    logger.error({ err: error }, 'Failed to queue video processing job');
    res.status(500).json({ error: 'Failed to queue job' });
  }
});

app.post('/api/jobs/publish', async (req, res) => {
  try {
    const { publicationId, campaignId } = req.body;
    if (!publicationId && !campaignId) {
      return res.status(400).json({ error: 'publicationId or campaignId is required' });
    }
    
    const job = await videoPublishingQueue.add('publish', { publicationId, campaignId });
    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    logger.error({ err: error }, 'Failed to queue publish job');
    res.status(500).json({ error: 'Failed to queue job' });
  }
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down processor worker...');
  
  await videoProcessingQueue.close();
  await videoPublishingQueue.close();
  await processingEvents.close();
  await publishingEvents.close();
  await redis.quit();
  await pgPool.end();
  
  logger.info('Processor worker shut down complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

const PORT = config.healthPort || 3003;
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Processor worker started');
  logger.info({ port: PORT }, `Bull Board available at http://localhost:${PORT}/admin/queues`);
});