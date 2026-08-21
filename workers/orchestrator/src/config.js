/**
 * Campaign Orchestrator Configuration
 * Centralized config with Zod validation
 */
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/social_video'),
  
  // RabbitMQ
  RABBITMQ_URL: z.string().url().default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_QUEUE_CAMPAIGN: z.string().default('campaign.orchestrator'),
  RABBITMQ_QUEUE_PROCESSOR: z.string().default('video.processor'),
  RABBITMQ_QUEUE_INTELLIGENCE: z.string().default('intelligence.tasks'),
  RABBITMQ_QUEUE_PUBLISHER: z.string().default('video.publisher'),
  
  // API Gateway
  API_GATEWAY_URL: z.string().url().default('http://localhost:3001'),
  API_GATEWAY_SECRET: z.string().default('dev-secret-change-me'),
  
  // Worker settings
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(3),
  CAMPAIGN_TIMEOUT_MS: z.coerce.number().int().positive().default(30 * 60 * 1000), // 30 min
  
  // Viral optimization
  DEFAULT_PLATFORMS: z.string().default('tiktok,instagram,youtube,facebook,x,linkedin'),
  MAX_VARIANTS_PER_PLATFORM: z.coerce.number().int().positive().default(3),
  ENABLE_AB_TESTING: z.coerce.boolean().default(true),
  AB_TEST_TRAFFIC_SPLIT: z.coerce.number().min(0).max(1).default(0.5),
  
  // Scheduling
  OPTIMAL_POSTING_WINDOWS: z.string().default('{"tiktok":["11:00-13:00","19:00-21:00"],"instagram":["11:00-13:00","19:00-21:00"],"youtube":["14:00-16:00","20:00-22:00"],"facebook":["13:00-15:00","19:00-21:00"],"x":["08:00-10:00","12:00-14:00","17:00-19:00"],"linkedin":["08:00-10:00","12:00-14:00","17:00-19:00"]}'),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
  
  // Health
  HEALTH_PORT: z.coerce.number().int().positive().default(3008),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export default parsed.data;