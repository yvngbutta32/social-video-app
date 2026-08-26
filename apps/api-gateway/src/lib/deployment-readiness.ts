import IORedis from 'ioredis';
import { prisma } from './prisma.js';
import { checkOperationalReadiness } from './operational-guards.js';
import { probePrivateSourceStorage } from './source-storage.js';

export function deploymentReadinessTimeoutMs() {
  return Math.min(10_000, Math.max(250, Number(process.env.READINESS_TIMEOUT_MS || 2_000)));
}

async function probeRedis(timeoutMs: number) {
  const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: timeoutMs,
  });
  redis.on('error', () => undefined);
  try {
    await redis.connect();
    await redis.ping();
  } finally {
    redis.disconnect();
  }
}

export async function getDeploymentReadiness() {
  const timeoutMs = deploymentReadinessTimeoutMs();
  return checkOperationalReadiness({
    database: () => prisma.$queryRawUnsafe('SELECT 1'),
    redis: () => probeRedis(timeoutMs),
    storage: probePrivateSourceStorage,
  }, timeoutMs);
}
