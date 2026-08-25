import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let queue: Queue | undefined;
let redis: IORedis | undefined;

function getQueue() {
  if (!queue) {
    redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
    queue = new Queue('video-processing', { connection: redis });
  }
  return queue;
}

export function processingJobId(videoId: string) {
  return `video-processing:${videoId}`;
}

export async function enqueueVideoProcessing(videoId: string) {
  const processingQueue = getQueue();
  const deterministicId = processingJobId(videoId);
  const existing = await processingQueue.getJob(deterministicId);
  if (existing) {
    const state = await existing.getState();
    if (state === 'waiting' || state === 'active' || state === 'delayed' || state === 'prioritized') {
      return { jobId: deterministicId, status: 'already_queued' as const };
    }
    if (state === 'failed') {
      await existing.retry('failed');
      return { jobId: deterministicId, status: 'retried' as const };
    }
    if (state === 'completed') {
      await existing.remove();
    }
  }
  const job = await processingQueue.add('process-video', { videoId }, {
    jobId: deterministicId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 5000 },
  });
  return { jobId: job.id || deterministicId, status: 'queued' as const };
}

export async function closeProcessingDispatcher() {
  await queue?.close();
  await redis?.quit();
  queue = undefined;
  redis = undefined;
}
