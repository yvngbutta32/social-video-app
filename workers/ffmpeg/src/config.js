/**
 * Configuration for FFmpeg Worker
 * All config via environment variables with validation
 */

import { z } from 'zod';

const envSchema = z.object({
  // RabbitMQ
  RABBITMQ_URL: z.string().url().default('amqp://guest:guest@rabbitmq:5672'),

  // PostgreSQL
  DATABASE_URL: z.string().url().default('postgresql://postgres:password@postgres:5432/social_video'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('minio:9000'),
  MINIO_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  MINIO_SECRET_KEY: z.string().min(1).default('minioadmin'),
  MINIO_BUCKET_VIDEOS: z.string().default('videos'),
  MINIO_BUCKET_THUMBNAILS: z.string().default('thumbnails'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),

  // Redis (for caching)
  REDIS_URL: z.string().url().default('redis://redis:6379'),

  // Processing
  MAX_CONCURRENT_JOBS: z.coerce.int().positive().default(1),
  FFMPEG_THREADS: z.coerce.int().positive().default(4),
  PROCESSING_TIMEOUT_MS: z.coerce.int().positive().default(600000), // 10 minutes

  // Feature flags
  AUTO_CAPTIONS: z.coerce.boolean().default(true),
  SHOW_SAFE_ZONES: z.coerce.boolean().default(false),

  // Platform specs
  TIKTOK_MAX_DURATION: z.coerce.int().positive().default(180), // 3 minutes
  INSTAGRAM_REEL_MAX_DURATION: z.coerce.int().positive().default(90),
  YOUTUBE_SHORT_MAX_DURATION: z.coerce.int().positive().default(60),
  FACEBOOK_REEL_MAX_DURATION: z.coerce.int().positive().default(90),

  // Video quality
  TARGET_BITRATE_MBPS: z.coerce.number().positive().default(8),
  TARGET_CRF: z.coerce.int().min(18).max(28).default(23),
  PRESET: z.enum(['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow']).default('fast'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),

  // Health
  HEALTH_PORT: z.coerce.int().positive().default(3001),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

// Platform-specific encoding presets
export const PLATFORM_SPECS = {
  tiktok: {
    aspectRatio: '9:16',
    maxDuration: config.TIKTOK_MAX_DURATION,
    variants: [
      { name: 'feed', width: 1080, height: 1920, bitrate: '8M', maxDuration: config.TIKTOK_MAX_DURATION },
      { name: 'story', width: 1080, height: 1920, bitrate: '6M', maxDuration: 60 },
    ],
    codec: 'libx264',
    audioCodec: 'aac',
    audioBitrate: '128k',
  },
  instagram: {
    aspectRatio: '9:16',
    maxDuration: config.INSTAGRAM_REEL_MAX_DURATION,
    variants: [
      { name: 'reel', width: 1080, height: 1920, bitrate: '8M', maxDuration: config.INSTAGRAM_REEL_MAX_DURATION },
      { name: 'story', width: 1080, height: 1920, bitrate: '6M', maxDuration: 60 },
      { name: 'feed', width: 1080, height: 1350, bitrate: '6M', maxDuration: 60 }, // 4:5
    ],
    codec: 'libx264',
    audioCodec: 'aac',
    audioBitrate: '128k',
  },
  youtube: {
    aspectRatio: '9:16',
    maxDuration: config.YOUTUBE_SHORT_MAX_DURATION,
    variants: [
      { name: 'short', width: 1080, height: 1920, bitrate: '10M', maxDuration: config.YOUTUBE_SHORT_MAX_DURATION },
    ],
    codec: 'libx264',
    audioCodec: 'aac',
    audioBitrate: '128k',
  },
  facebook: {
    aspectRatio: '9:16',
    maxDuration: config.FACEBOOK_REEL_MAX_DURATION,
    variants: [
      { name: 'reel', width: 1080, height: 1920, bitrate: '8M', maxDuration: config.FACEBOOK_REEL_MAX_DURATION },
      { name: 'story', width: 1080, height: 1920, bitrate: '6M', maxDuration: 60 },
    ],
    codec: 'libx264',
    audioCodec: 'aac',
    audioBitrate: '128k',
  },
  x: {
    aspectRatio: '16:9',
    maxDuration: 140,
    variants: [
      { name: 'feed', width: 1280, height: 720, bitrate: '6M', maxDuration: 140 },
    ],
    codec: 'libx264',
    audioCodec: 'aac',
    audioBitrate: '128k',
  },
  linkedin: {
    aspectRatio: '16:9',
    maxDuration: 600, // 10 minutes
    variants: [
      { name: 'feed', width: 1920, height: 1080, bitrate: '8M', maxDuration: 600 },
      { name: 'square', width: 1080, height: 1080, bitrate: '6M', maxDuration: 600 },
    ],
    codec: 'libx264',
    audioCodec: 'aac',
    audioBitrate: '128k',
  },
};

// Hook type templates for overlay generation
export const HOOK_TEMPLATES = {
  curiosity: {
    fontSize: 72,
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'top',
    animation: 'fadeInUp',
  },
  authority: {
    fontSize: 64,
    color: '#FFD700',
    strokeColor: '#000000',
    strokeWidth: 2,
    position: 'top',
    animation: 'slideInLeft',
  },
  transformation: {
    fontSize: 68,
    color: '#00FF7F',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'center',
    animation: 'zoomIn',
  },
  mistake: {
    fontSize: 70,
    color: '#FF4444',
    strokeColor: '#FFFFFF',
    strokeWidth: 2,
    position: 'top',
    animation: 'shake',
  },
  contrarian: {
    fontSize: 66,
    color: '#FF6B35',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'top',
    animation: 'flipIn',
  },
  money: {
    fontSize: 72,
    color: '#00FF00',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'top',
    animation: 'bounceIn',
  },
  protocol: {
    fontSize: 60,
    color: '#00BFFF',
    strokeColor: '#000000',
    strokeWidth: 2,
    position: 'top',
    animation: 'fadeInDown',
  },
};

export default config;