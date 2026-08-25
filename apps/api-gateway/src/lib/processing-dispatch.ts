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
  const job = await getQueue().add('process-video', { videoId }, {
    jobId: processingJobId(videoId),
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 5000 },
  });
  return { jobId: job.id || processingJobId(videoId), status: 'queued' as const };
}

export async function closeProcessingDispatcher() {
  await queue?.close();
  await redis?.quit();
  queue = undefined;
  redis = undefined;
}
