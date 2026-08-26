import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { prettyJSON } from 'hono/pretty-json';
import { HTTPException } from 'hono/http-exception';
import { verify } from 'hono/jwt';
import pino from 'pino';

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
  allowHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-ViralBoost-Client'],
  credentials: true,
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.route('/internal/connectors', createInternalConnectorRoutes());

app.get('/ready', async (c) => {
  try {
    // Check database connection
    // Check redis connection
    return c.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    return c.json({ status: 'not ready', error: String(error) }, 503);
  }
});

const publicAuthPaths = new Set([
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/verify-email/confirm',
]);

const isPublicAuthPath = (path: string) => publicAuthPaths.has(path);

app.use('/api/v1/*', async (c, next) => {
  if (isPublicAuthPath(c.req.path)) return next();
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
