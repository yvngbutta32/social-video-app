import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('social_video'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string(),
  
  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  
  // MinIO / S3
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string().default('social-video'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  
  // Workers
  VIDEO_CONCURRENCY: z.coerce.number().default(2),
  VIDEO_RATE_LIMIT: z.coerce.number().default(10),
  PUBLISH_CONCURRENCY: z.coerce.number().default(3),
  PUBLISH_RATE_LIMIT: z.coerce.number().default(20),
  ANALYTICS_CONCURRENCY: z.coerce.number().default(2),
  ANALYTICS_RATE_LIMIT: z.coerce.number().default(30),
  
  // Health
  HEALTH_PORT: z.coerce.number().default(3001),
  
  // Platform APIs
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  INSTAGRAM_CLIENT_ID: z.string().optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  
  // AI / LLM
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.1:8b'),
  
  // Encryption
  ENCRYPTION_KEY: z.string().length(32),
  
  // Webhooks
  WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  env: parsed.data.NODE_ENV,
  db: {
    host: parsed.data.DB_HOST,
    port: parsed.data.DB_PORT,
    name: parsed.data.DB_NAME,
    user: parsed.data.DB_USER,
    password: parsed.data.DB_PASSWORD,
  },
  redis: {
    url: parsed.data.REDIS_URL,
  },
  minio: {
    endpoint: parsed.data.MINIO_ENDPOINT,
    port: parsed.data.MINIO_PORT,
    accessKey: parsed.data.MINIO_ACCESS_KEY,
    secretKey: parsed.data.MINIO_SECRET_KEY,
    bucket: parsed.data.MINIO_BUCKET,
    useSSL: parsed.data.MINIO_USE_SSL,
  },
  workers: {
    videoConcurrency: parsed.data.VIDEO_CONCURRENCY,
    videoRateLimit: parsed.data.VIDEO_RATE_LIMIT,
    publishConcurrency: parsed.data.PUBLISH_CONCURRENCY,
    publishRateLimit: parsed.data.PUBLISH_RATE_LIMIT,
    analyticsConcurrency: parsed.data.ANALYTICS_CONCURRENCY,
    analyticsRateLimit: parsed.data.ANALYTICS_RATE_LIMIT,
  },
  healthPort: parsed.data.HEALTH_PORT,
  platforms: {
    tiktok: {
      clientKey: parsed.data.TIKTOK_CLIENT_KEY,
      clientSecret: parsed.data.TIKTOK_CLIENT_SECRET,
    },
    instagram: {
      clientId: parsed.data.INSTAGRAM_CLIENT_ID,
      clientSecret: parsed.data.INSTAGRAM_CLIENT_SECRET,
    },
    youtube: {
      clientId: parsed.data.YOUTUBE_CLIENT_ID,
      clientSecret: parsed.data.YOUTUBE_CLIENT_SECRET,
    },
    facebook: {
      appId: parsed.data.FACEBOOK_APP_ID,
      appSecret: parsed.data.FACEBOOK_APP_SECRET,
    },
    twitter: {
      clientId: parsed.data.TWITTER_CLIENT_ID,
      clientSecret: parsed.data.TWITTER_CLIENT_SECRET,
    },
    linkedin: {
      clientId: parsed.data.LINKEDIN_CLIENT_ID,
      clientSecret: parsed.data.LINKEDIN_CLIENT_SECRET,
    },
  },
  ai: {
    ollamaUrl: parsed.data.OLLAMA_URL,
    model: parsed.data.OLLAMA_MODEL,
  },
  encryptionKey: parsed.data.ENCRYPTION_KEY,
  webhookSecret: parsed.data.WEBHOOK_SECRET,
};