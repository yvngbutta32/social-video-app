import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { prettyJSON } from 'hono/pretty-json';
import { HTTPException } from 'hono/http-exception';
import { verify } from 'hono/jwt';
import { bodyLimit } from 'hono/body-limit';
import pino from 'pino';
import IORedis from 'ioredis';

import { createVideoRoutes } from './routes/videos.js';
import { createCampaignRoutes } from './routes/campaigns.js';
import { createAccountRoutes } from './routes/accounts.js';
import { createAnalyticsRoutes } from './routes/analytics.js';
import { createAuthRoutes } from './routes/auth.js';
import { createWebhookRoutes } from './routes/webhooks.js';
import { createIntelligenceRoutes } from './routes/intelligence.js';
import { createOwnerRoutes } from './routes/owner.js';
import { createGrowthRoutes } from './routes/growth.js';
import { createPublishingRoutes } from './routes/publishing.js';
import { createInternalConnectorRoutes } from './routes/internal-connectors.js';
import { checkOperationalReadiness, FixedWindowRateLimiter, RedisFixedWindowRateLimiter, type RateLimitResult, trustedClientKey } from './lib/operational-guards.js';
import { prisma } from './lib/prisma.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

type Bindings = {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
};

export type Variables = {
  user: { id: string; email: string; role: string };
  jwtPayload: Record<string, unknown>;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const limiter = new FixedWindowRateLimiter();
let rateLimitRedis: IORedis | undefined;
let rateLimitCacheUnavailableUntil = 0;
const readinessTimeoutMs = Math.min(10_000, Math.max(250, Number(process.env.READINESS_TIMEOUT_MS || 2_000)));
const maxJsonBodyBytes = Math.min(5 * 1024 * 1024, Math.max(16 * 1024, Number(process.env.MAX_JSON_BODY_BYTES || 1_048_576)));
const maxSourceUploadBytes = Math.min(2 * 1024 * 1024 * 1024, Math.max(1_048_576, Number(process.env.MAX_SOURCE_UPLOAD_BYTES || 524_288_000)));

const defaultBodyLimit = bodyLimit({
  maxSize: maxJsonBodyBytes,
  onError: (c) => c.json({ error: 'Request body exceeds the allowed private API limit.' }, 413),
});
const sourceBodyLimit = bodyLimit({
  maxSize: maxSourceUploadBytes,
  onError: (c) => c.json({ error: 'Source video exceeds the configured private upload limit.' }, 413),
});

function getRateLimitRedis() {
  if (!rateLimitRedis) {
    rateLimitRedis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 500,
    });
    rateLimitRedis.on('error', () => undefined);
  }
  return rateLimitRedis;
}

async function takeRateLimit(key: string, limit: number): Promise<RateLimitResult> {
  const now = Date.now();
  if (now < rateLimitCacheUnavailableUntil) return limiter.take(key, limit, 60_000, now);
  try {
    const redis = getRateLimitRedis();
    if (redis.status === 'wait') await redis.connect();
    return await new RedisFixedWindowRateLimiter(redis).take(`viralboost:rate-limit:v1:${key}`, limit, 60_000, now);
  } catch {
    rateLimitCacheUnavailableUntil = now + 5_000;
    rateLimitRedis?.disconnect();
    rateLimitRedis = undefined;
    return limiter.take(key, limit, 60_000, now);
  }
}

async function requestLimit(c: any, next: () => Promise<void>) {
  const user = c.get('user') as Variables['user'] | undefined;
  const client = user ? `user:${user.id}` : trustedClientKey(c.req.raw.headers, process.env.TRUST_PROXY === 'true');
  const sensitive = c.req.path.startsWith('/api/v1/auth/') || c.req.path.startsWith('/api/v1/webhooks/platform/');
  const limit = sensitive ? 12 : 120;
  const result = await takeRateLimit(`${sensitive ? 'sensitive' : 'api'}:${client}`, limit);
  c.header('RateLimit-Limit', String(limit));
  c.header('RateLimit-Remaining', String(result.remaining));
  c.header('RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed) throw new HTTPException(429, { message: 'Request rate limit reached. Wait briefly before trying again.' });
  return next();
}

async function probeRedis() {
  const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: readinessTimeoutMs,
  });
  redis.on('error', () => undefined);
  try {
    await redis.connect();
    await redis.ping();
  } finally {
    redis.disconnect();
  }
}

app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-ViralBoost-Client'],
  credentials: true,
}));
app.use('/internal/connectors/*', defaultBodyLimit);
app.use('/api/v1/*', async (c, next) => c.req.path === '/api/v1/videos/upload' ? sourceBodyLimit(c, next) : defaultBodyLimit(c, next));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.route('/internal/connectors', createInternalConnectorRoutes());

app.get('/ready', async (c) => {
  const readiness = await checkOperationalReadiness({
    database: () => prisma.$queryRawUnsafe('SELECT 1'),
    redis: probeRedis,
  }, readinessTimeoutMs);
  return c.json({ ...readiness, timestamp: new Date().toISOString() }, readiness.status === 'ready' ? 200 : 503);
});

const publicAuthPaths = new Set([
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/verify-email/confirm',
]);

const isPublicAuthPath = (path: string) => publicAuthPaths.has(path);
const isPublicProviderCallback = (path: string) => /^\/api\/v1\/webhooks\/platform\/[^/]+$/.test(path);

app.use('/api/v1/*', async (c, next) => {
  if (isPublicAuthPath(c.req.path) || isPublicProviderCallback(c.req.path)) return next();
  const authorization = c.req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new HTTPException(401, { message: 'Unauthorized' });
  const secret = (c.env as Bindings | undefined)?.JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new HTTPException(503, { message: 'Authentication is not configured.' });

  try {
    const payload = await verify(authorization.slice('Bearer '.length), secret, 'HS256');
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
      throw new HTTPException(401, { message: 'Invalid authentication claims.' });
    }
    c.set('jwtPayload', payload);
    c.set('user', { id: payload.sub, email: payload.email, role: payload.role });
    await next();
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(401, { message: 'Invalid authentication token.' });
  }
});
app.use('/api/v1/*', requestLimit);

app.route('/api/v1/auth', createAuthRoutes());
app.route('/api/v1/videos', createVideoRoutes());
app.route('/api/v1/campaigns', createCampaignRoutes());
app.route('/api/v1/accounts', createAccountRoutes());
app.route('/api/v1/analytics', createAnalyticsRoutes());
app.route('/api/v1/webhooks', createWebhookRoutes());
app.route('/api/v1/intelligence', createIntelligenceRoutes());
app.route('/api/v1/growth', createGrowthRoutes());
app.route('/api/v1/publishing', createPublishingRoutes());
app.route('/api/v1/owner', createOwnerRoutes());

app.onError((err, c) => {
  log.error({ err }, 'Unhandled error');
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  return c.json({ error: 'Internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

const port = parseInt(process.env.PORT || '3000', 10);
log.info(`Server starting on port ${port}`);

export default {
  fetch: app.fetch,
  port,
};
