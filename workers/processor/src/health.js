import { pgPool } from './db.js';
import { config } from './config.js';
import { logger } from './logger.js';

export async function healthCheck() {
  const checks = {
    database: false,
    minio: false,
    redis: false,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  };
  
  // Database check
  try {
    await pgPool.query('SELECT 1');
    checks.database = true;
  } catch (error) {
    logger.error({ err: error }, 'Database health check failed');
  }
  
  // MinIO check
  try {
    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      endpoint: `http://${config.minio.endpoint}:${config.minio.port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.minio.accessKey,
        secretAccessKey: config.minio.secretKey,
      },
      forcePathStyle: true,
    });
    await s3Client.send(new HeadBucketCommand({ Bucket: config.minio.bucket }));
    checks.minio = true;
  } catch (error) {
    logger.error({ err: error }, 'MinIO health check failed');
  }
  
  // Redis check
  try {
    const redis = (await import('ioredis')).default;
    const client = new redis(config.redis.url);
    await client.ping();
    await client.quit();
    checks.redis = true;
  } catch (error) {
    logger.error({ err: error }, 'Redis health check failed');
  }
  
  const healthy = checks.database && checks.minio && checks.redis;
  
  return {
    healthy,
    checks,
    status: healthy ? 'healthy' : 'degraded',
  };
}

export async function readinessCheck() {
  // More thorough check for readiness (can accept traffic)
  const health = await healthCheck();
  return health;
}

export async function livenessCheck() {
  // Simple check - is the process alive
  return { alive: true, timestamp: new Date().toISOString() };
}