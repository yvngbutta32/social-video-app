/**
 * Mirror Worker Configuration
 */
export const config = {
  // Worker settings
  WORKER_NAME: 'mirror-worker',
  CONCURRENCY: 2,
  POLL_INTERVAL_MS: 5000,

  // RabbitMQ
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  RABBITMQ_QUEUE: process.env.MIRROR_QUEUE || 'mirror.content',
  RABBITMQ_EXCHANGE: 'content.events',
  RABBITMQ_EXCHANGE_TYPE: 'topic',
  ROUTING_KEY: 'content.created',

  // MinIO / S3
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost',
  MINIO_PORT: parseInt(process.env.MINIO_PORT || '9000'),
  MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'minioadmin',
  MINIO_BUCKET: process.env.MINIO_BUCKET || 'social-video',
  MIRROR_BUCKET: process.env.MIRROR_BUCKET || 'social-video-mirror',

  // Encryption
  ENCRYPTION_KEY: process.env.MIRROR_ENCRYPTION_KEY || '',
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  KEY_DERIVATION_ITERATIONS: 100000,

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://social_video:password@localhost:5432/social_video',

  // Mirror settings
  MIRROR_DELAY_MS: parseInt(process.env.MIRROR_DELAY_MS || '0'),
  MAX_FILE_SIZE_GB: parseInt(process.env.MAX_FILE_SIZE_GB || '10'),
  INCLUDE_THUMBNAILS: process.env.INCLUDE_THUMBNAILS !== 'false',
  INCLUDE_METADATA: process.env.INCLUDE_METADATA !== 'false',
  COMPRESSION_LEVEL: parseInt(process.env.COMPRESSION_LEVEL || '6'),

  // Retention
  MIRROR_RETENTION_DAYS: parseInt(process.env.MIRROR_RETENTION_DAYS || '2555'), // 7 years
  DELETE_AFTER_DELIVERY: process.env.DELETE_AFTER_DELIVERY === 'true',

  // Health
  HEALTH_PORT: parseInt(process.env.HEALTH_PORT || '3005'),
  METRICS_PORT: parseInt(process.env.METRICS_PORT || '9095'),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

export default config;