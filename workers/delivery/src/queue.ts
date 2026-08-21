import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { getConfig } from './config.js';
import { logger, createChildLogger } from './logger.js';
import { DeliveryJob } from './storage/base.js';
import { getStorageProvider } from './storage/factory.js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const config = getConfig();
const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const connection = new Redis.default({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

export const deliveryQueue = new Queue('delivery', { connection });

export const deliveryWorker = new Worker<DeliveryJob>(
  'delivery',
  async (job: Job<DeliveryJob>) => {
    const childLogger = createChildLogger({ jobId: job.id, mirrorId: job.data.mirrorId });
    childLogger.info('Processing delivery job');

    const { mirrorId, configId, destination, archivePath, variantIds, metadata, retryCount } = job.data;

    try {
      // Get the mirror record to verify it exists and get details
      const mirror = await prisma.contentMirror.findUnique({
        where: { id: mirrorId },
      });

      if (!mirror) {
        throw new Error(`Mirror ${mirrorId} not found`);
      }

      // Get delivery config
      const deliveryConfig = await prisma.deliveryConfig.findUnique({
        where: { id: configId },
      });

      if (!deliveryConfig) {
        throw new Error(`Delivery config ${configId} not found`);
      }

      if (!deliveryConfig.enabled) {
        throw new Error(`Delivery config ${configId} is disabled`);
      }

      // Get storage provider
      const provider = getStorageProvider(destination);

      // Download archive from MinIO (where Mirror Worker stores it)
      const minioProvider = getStorageProvider('MINIO');
      const archiveStream = await minioProvider.download(archivePath);

      // Upload to destination
      const result = await provider.upload(
        `${mirrorId}/${archivePath.split('/').pop()}`,
        archiveStream,
        {
          mirrorId,
          variantIds: (mirror.variantIds as string[]).join(','),
          originalChecksum: mirror.checksum,
          deliveredAt: new Date().toISOString(),
          ...metadata,
        }
      );

      // Create delivery log
      await prisma.deliveryLog.create({
        data: {
          mirrorId,
          configId,
          destination,
          status: 'COMPLETED',
          filePath: result.path,
          size: result.size,
          checksum: result.checksum,
          url: result.url,
          metadata: result.metadata as any,
          retryCount,
        },
      });

      // Update mirror with delivery info
      await prisma.contentMirror.update({
        where: { id: mirrorId },
        data: {
          deliveryStatus: 'COMPLETED',
          deliveredAt: new Date(),
          deliveryPath: result.path,
        },
      });

      childLogger.info({ destination, filePath: result.path, size: result.size }, 'Delivery completed');
      return result;
    } catch (error) {
      childLogger.error({ error: error instanceof Error ? error.message : String(error) }, 'Delivery failed');

      // Create failure log
      await prisma.deliveryLog.create({
        data: {
          mirrorId,
          configId,
          destination,
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
          retryCount,
        },
      });

      // Retry logic
      if (retryCount < config.MAX_RETRIES) {
        childLogger.info({ retryCount: retryCount + 1 }, 'Scheduling retry');
        throw error; // BullMQ will retry
      }

      // Max retries exceeded
      await prisma.contentMirror.update({
        where: { id: mirrorId },
        data: {
          deliveryStatus: 'FAILED',
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: config.WORKER_CONCURRENCY,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
);

deliveryWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Delivery job completed');
});

deliveryWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Delivery job failed');
});

deliveryWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Delivery worker error');
});

export async function scheduleDelivery(mirrorId: string, configId: string): Promise<void> {
  const deliveryConfig = await prisma.deliveryConfig.findUnique({
    where: { id: configId },
  });

  if (!deliveryConfig || !deliveryConfig.enabled) {
    logger.warn({ configId }, 'Delivery config not found or disabled');
    return;
  }

  const mirror = await prisma.contentMirror.findUnique({
    where: { id: mirrorId },
  });

  if (!mirror) {
    logger.error({ mirrorId }, 'Mirror not found for delivery');
    return;
  }

  const jobData: DeliveryJob = {
    id: `delivery-${mirrorId}-${configId}-${Date.now()}`,
    mirrorId,
    configId,
    destination: deliveryConfig.destination,
    archivePath: mirror.archivePath,
    variantIds: (mirror.variantIds as string[]) || [],
    metadata: {
      creatorId: mirror.creatorId,
      sourcePlatform: 'unknown', // ContentMirror doesn't have this directly
      originalUrl: '', // ContentMirror doesn't have this directly
    },
    retryCount: 0,
    createdAt: new Date(),
  };

  await deliveryQueue.add(`delivery-${mirrorId}`, jobData, {
    attempts: config.MAX_RETRIES,
    backoff: {
      type: 'exponential',
      delay: config.RETRY_DELAY_MS,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });

  logger.info({ mirrorId, configId, destination: deliveryConfig.destination }, 'Delivery job scheduled');
}

export async function scheduleRecurringDeliveries(): Promise<void> {
  const configs = await prisma.deliveryConfig.findMany({
    where: { enabled: true },
  });

  for (const config of configs) {
    // Find mirrors that haven't been delivered to this destination
    const mirrors = await prisma.contentMirror.findMany({
      where: {
        deliveryStatus: { not: 'COMPLETED' },
        deliveryLogs: { none: { configId: config.id } },
      },
      take: 100,
    });

    for (const mirror of mirrors) {
      await scheduleDelivery(mirror.id, config.id);
    }
  }
}