import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import axios from 'axios';
import crypto from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Variables } from '../index.js';
import { decideRetry, type RetryPolicy } from '../lib/reliability.js';
import { verifyPlatformWebhook, SUPPORTED_PLATFORM_WEBHOOKS } from '../lib/platform-webhook-security.js';
import { decryptToken, encryptToken, isEncryptedToken } from '../lib/token-crypto.js';
import { requireCreatorWorkspaceAccess, requireWorkspaceAccess } from '../lib/pilot-access.js';

const webhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum([
    'video.created', 'video.updated', 'video.deleted', 'video.published', 'video.failed',
    'campaign.created', 'campaign.started', 'campaign.paused', 'campaign.completed',
    'account.connected', 'account.disconnected', 'account.token_expired',
    'analytics.threshold_reached', 'export.completed'
  ])).min(1),
  secret: z.string().min(16).max(64).optional(),
  isActive: z.boolean().default(true),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(10).default(3),
    backoffMultiplier: z.number().positive().default(2),
    initialDelayMs: z.number().int().positive().default(1000),
  }).optional(),
});

const updateWebhookSchema = webhookSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  isActive: z.boolean().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const testWebhookSchema = z.object({
  event: z.enum([
    'video.created', 'video.updated', 'video.deleted', 'video.published', 'video.failed',
    'campaign.created', 'campaign.started', 'campaign.paused', 'campaign.completed',
    'account.connected', 'account.disconnected', 'account.token_expired',
    'analytics.threshold_reached', 'export.completed'
  ]),
});

async function selectedWebhookWorkspace(c: any, user: { id: string; email: string; role: string }, creatorWrite = false) {
  const workspaceId = c.req.header('x-workspace-id');
  if (!workspaceId) throw new HTTPException(400, { message: 'A valid x-workspace-id header is required for webhook management requests.' });
  if (creatorWrite) await requireCreatorWorkspaceAccess(user, workspaceId);
  else await requireWorkspaceAccess(user, workspaceId);
  return workspaceId;
}

export function createWebhookRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/', zValidator('query', querySchema), async (c: any) => {
    const { page, limit, isActive, sortBy, sortOrder } = c.req.valid('query');
    const user = c.get('user');
    const workspaceId = await selectedWebhookWorkspace(c, user);
    
    const where: any = { workspaceId };
    
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    
    const [webhooks, total] = await Promise.all([
      prisma.webhook.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.webhook.count({ where }),
    ]);
    
    return c.json({
      data: webhooks.map(redactWebhook),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  app.get('/:id', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedWebhookWorkspace(c, user);
    const webhook = await prisma.webhook.findFirst({ where: { id, workspaceId } });
    if (!webhook) throw new HTTPException(404, { message: 'Webhook not found' });
    return c.json({ data: redactWebhook(webhook) });
  });

  app.post('/', zValidator('json', webhookSchema), async (c: any) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const workspaceId = await selectedWebhookWorkspace(c, user, true);
    
    // Generate secret if not provided
    const signingSecret = body.secret || generateSecret();
    
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId,
        name: body.name,
        url: body.url,
        events: body.events,
        secret: encryptToken(signingSecret),
        isActive: body.isActive,
        retryPolicy: body.retryPolicy || { maxRetries: 3, backoffMultiplier: 2, initialDelayMs: 1000 },
      },
    });
    
    return c.json({ 
      data: { 
        ...redactWebhook(webhook),
        userId: user.id, 
        createdAt: webhook.createdAt.toISOString(),
        signingSecret,
      } 
    }, 201);
  });

  app.patch('/:id', zValidator('json', updateWebhookSchema), async (c: any) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const user = c.get('user');
    const workspaceId = await selectedWebhookWorkspace(c, user, true);
    const webhook = await prisma.webhook.findFirst({ where: { id, workspaceId } });
    
    if (!webhook) {
      throw new HTTPException(404, { message: 'Webhook not found' });
    }
    
    const updated = await prisma.webhook.update({
      where: { id },
      data: {
        name: body.name,
        url: body.url,
        events: body.events,
        secret: body.secret ? encryptToken(body.secret) : undefined,
        isActive: body.isActive,
        retryPolicy: body.retryPolicy,
      },
    });
    
    return c.json({ data: redactWebhook(updated) });
  });

  app.delete('/:id', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedWebhookWorkspace(c, user, true);
    const webhook = await prisma.webhook.findFirst({ where: { id, workspaceId } });
    
    if (!webhook) {
      throw new HTTPException(404, { message: 'Webhook not found' });
    }
    
    await prisma.webhook.delete({ where: { id } });
    
    return c.json({ success: true });
  });

  app.post('/:id/test', zValidator('json', testWebhookSchema), async (c: any) => {
    const id = c.req.param('id');
    const { event } = c.req.valid('json');
    const user = c.get('user');
    const workspaceId = await selectedWebhookWorkspace(c, user, true);
    
    const webhook = await prisma.webhook.findFirst({
      where: { id, workspaceId },
    });
    
    if (!webhook) {
      throw new HTTPException(404, { message: 'Webhook not found' });
    }
    
    // Send test payload to webhook URL
    const testPayload = {
      event,
      timestamp: new Date().toISOString(),
      test: true,
      data: { message: 'This is a test webhook delivery' },
    };
    
    try {
      await assertPublicWebhookUrl(webhook.url);
      const signingSecret = decryptWebhookSecret(webhook.secret);
      const response = await axios.post(webhook.url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': generateSignature(JSON.stringify(testPayload), signingSecret),
        },
        timeout: 10000,
        maxRedirects: 0,
      });
      
      // Record delivery attempt
      await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: testPayload,
          responseStatus: response.status,
          responseBody: JSON.stringify(response.data),
          success: response.status >= 200 && response.status < 300,
        },
      });
      
      return c.json({ 
        success: true, 
        message: 'Test webhook sent',
        status: response.status,
      });
    } catch (err: any) {
      await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: testPayload,
          responseStatus: err.response?.status || 0,
          responseBody: safeDeliveryFailureSummary(err),
          success: false,
        },
      });
      
      return c.json({ 
        success: false, 
        message: 'Test webhook failed',
        error: 'The webhook delivery could not be completed. Review the endpoint and retry when it is available.',
      });
    }
  });

  app.get('/:id/deliveries', zValidator('query', z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['pending', 'delivered', 'failed', 'retrying']).optional(),
  })), async (c: any) => {
    const id = c.req.param('id');
    const query = c.req.valid('query');
    const user = c.get('user');
    const workspaceId = await selectedWebhookWorkspace(c, user);
    
    const webhook = await prisma.webhook.findFirst({
      where: { id, workspaceId },
    });
    
    if (!webhook) {
      throw new HTTPException(404, { message: 'Webhook not found' });
    }
    
    const where: any = { webhookId: id };
    
    if (query.status) {
      where.success = query.status === 'delivered';
    }
    
    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.webhookDelivery.count({ where }),
    ]);
    
    return c.json({
      data: deliveries,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  });

  app.post('/:id/deliveries/:deliveryId/retry', async (c: any) => {
    const id = c.req.param('id');
    const deliveryId = c.req.param('deliveryId');
    const user = c.get('user');
    const workspaceId = await selectedWebhookWorkspace(c, user, true);
    
    const webhook = await prisma.webhook.findFirst({
      where: { id, workspaceId },
    });
    
    if (!webhook) {
      throw new HTTPException(404, { message: 'Webhook not found' });
    }
    
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, webhookId: id },
    });
    
    if (!delivery) {
      throw new HTTPException(404, { message: 'Delivery not found' });
    }
    
    const retryPolicy = webhook.retryPolicy as unknown as Partial<RetryPolicy>;
    const priorDecision = decideRetry({
      retryCount: delivery.retryCount,
      responseStatus: delivery.responseStatus,
      policy: retryPolicy,
    });

    if (!priorDecision.retryable) {
      return c.json({ success: false, message: priorDecision.reason, retry: priorDecision }, 409);
    }

    // Retry the delivery within its configured recovery budget.
    try {
      await assertPublicWebhookUrl(webhook.url);
      const signingSecret = decryptWebhookSecret(webhook.secret);
      const response = await axios.post(webhook.url, delivery.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': generateSignature(JSON.stringify(delivery.payload), signingSecret),
        },
        timeout: 10000,
        maxRedirects: 0,
      });
      
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          responseStatus: response.status,
          responseBody: JSON.stringify(response.data),
          success: response.status >= 200 && response.status < 300,
          retryCount: delivery.retryCount + 1,
        },
      });
      
      return c.json({ success: true, message: 'Delivery retried', status: response.status, retry: { retryable: false, exhausted: false, nextDelayMs: null, reason: 'Delivery recovered successfully.' } });
    } catch (err: any) {
      const responseStatus = err.response?.status || 0;
      const retryCount = delivery.retryCount + 1;
      const retry = decideRetry({ retryCount, responseStatus, policy: retryPolicy });
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          responseStatus,
          responseBody: safeDeliveryFailureSummary(err),
          success: false,
          retryCount,
        },
      });
      
      return c.json({ success: false, message: 'Retry failed', error: 'The webhook delivery could not be completed. Review the endpoint and retry when it is available.', retry });
    }
  });

  // Public endpoint for official provider callbacks. A verified delivery is never treated as processed until a certified connector owns it.
  app.post('/platform/:platform', async (c: any) => {
    const platform = c.req.param('platform').toLowerCase();
    if (!SUPPORTED_PLATFORM_WEBHOOKS.includes(platform as (typeof SUPPORTED_PLATFORM_WEBHOOKS)[number])) {
      throw new HTTPException(404, { message: 'Unsupported platform webhook.' });
    }

    const body = await c.req.text();
    const signature = c.req.header('x-signature') || c.req.header('x-hub-signature-256');
    const timestamp = c.req.header('x-webhook-timestamp') || c.req.header('x-timestamp');
    const verification = verifyPlatformWebhook({ platform, payload: body, signature, timestamp });

    if (!verification.configured) {
      throw new HTTPException(503, { message: `Official ${platform} webhook verification is not configured.` });
    }
    if (!verification.valid) {
      throw new HTTPException(401, { message: 'Invalid platform webhook signature.' });
    }

    // Do not acknowledge a provider event as processed until its official connector maps it to a creator-owned account and durable state transition.
    throw new HTTPException(501, { message: `Verified ${platform} webhook received, but no certified connector processor is configured.` });
  });

  return app;
}

function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function redactWebhook<T extends { secret: string }>(webhook: T) {
  const { secret: _secret, ...safeWebhook } = webhook;
  return safeWebhook;
}

function decryptWebhookSecret(storedSecret: string) {
  return isEncryptedToken(storedSecret) ? decryptToken(storedSecret) : storedSecret;
}

function safeDeliveryFailureSummary(error: unknown) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  return status ? `Webhook endpoint returned HTTP ${status}.` : 'Webhook delivery could not be completed.';
}

export function isPrivateOrReservedAddress(address: string) {
  if (address.includes(':')) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('::ffff:127.');
  }
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 || first >= 224 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 100 && second >= 64 && second <= 127);
}

export async function assertPublicWebhookUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HTTPException(400, { message: 'Webhook URL must be a valid public HTTPS URL.' });
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port && parsed.port !== '443') {
    throw new HTTPException(400, { message: 'Webhook delivery requires a public HTTPS URL without embedded credentials.' });
  }
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost')) {
    throw new HTTPException(400, { message: 'Webhook delivery cannot target local or private network addresses.' });
  }
  let addresses: { address: string }[];
  try {
    addresses = isIP(parsed.hostname) ? [{ address: parsed.hostname }] : await lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new HTTPException(400, { message: 'Webhook URL must resolve to a public network address.' });
  }
  if (!addresses.length || addresses.some((record) => isPrivateOrReservedAddress(record.address))) {
    throw new HTTPException(400, { message: 'Webhook delivery cannot target local or private network addresses.' });
  }
}
