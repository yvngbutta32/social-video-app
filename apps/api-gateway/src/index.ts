import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { prettyJSON } from 'hono/pretty-json';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { jwt } from 'hono/jwt';
import pino from 'pino';

import { createVideoRoutes } from './routes/videos.js';
import { createCampaignRoutes } from './routes/campaigns.js';
import { createAccountRoutes } from './routes/accounts.js';
import { createAnalyticsRoutes } from './routes/analytics.js';
import { createAuthRoutes } from './routes/auth.js';
import { createWebhookRoutes } from './routes/webhooks.js';
import { createIntelligenceRoutes } from './routes/intelligence.js';

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

app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/ready', async (c) => {
  try {
    // Check database connection
    // Check redis connection
    return c.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    return c.json({ status: 'not ready', error: String(error) }, 503);
  }
});

const authMiddleware = jwt({
  secret: (c) => c.env.JWT_SECRET,
});

app.use('/api/v1/*', authMiddleware, async (c, next) => {
  const payload = c.get('jwtPayload');
  if (!payload) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  c.set('user', {
    id: payload.sub as string,
    email: payload.email as string,
    role: payload.role as string,
  });
  await next();
});

app.route('/api/v1/auth', createAuthRoutes());
app.route('/api/v1/videos', createVideoRoutes());
app.route('/api/v1/campaigns', createCampaignRoutes());
app.route('/api/v1/accounts', createAccountRoutes());
app.route('/api/v1/analytics', createAnalyticsRoutes());
app.route('/api/v1/webhooks', createWebhookRoutes());
app.route('/api/v1/intelligence', createIntelligenceRoutes());

app.onError((err, c) => {
  log.error({ err }, 'Unhandled error');
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: 'Internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

const port = parseInt(process.env.PORT || '3000', 10);
log.info(`Server starting on port ${port}`);

export default {
  fetch: app.fetch,
  port,
};