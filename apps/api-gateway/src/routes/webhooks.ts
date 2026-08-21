import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { verify } from 'hono/jwt';
import { prisma } from '../lib/prisma.js';
import axios from 'axios';
import crypto from 'crypto';
import type { Variables } from '../index.js';

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

export function createWebhookRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/', zValidator('query', querySchema), async (c: any) => {
    const { page, limit, isActive, sortBy, sortOrder } = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    
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
      data: webhooks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  app.get('/:id', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const webhook = await prisma.webhook.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
    });
    
    if (!webhook) {
      throw new HTTPException(404, { message: 'Webhook not found' });
    }
    
    return c.json({ data: webhook });
  });

  app.post('/', zValidator('json', webhookSchema), async (c: any) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    // Generate secret if not provided
    const secret = body.secret || generateSecret();
    
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: workspaceMember.workspaceId,
        name: body.name,
        url: body.url,
        events: body.events,
        secret,
        isActive: body.isActive,
        retryPolicy: body.retryPolicy || { maxRetries: 3, backoffMultiplier: 2, initialDelayMs: 1000 },
      },
    });
    
    return c.json({ 
      data: { 
        ...webhook,
        userId: user.id, 
        createdAt: webhook.createdAt.toISOString() 
      } 
    }, 201);
  });

  app.patch('/:id', zValidator('json', updateWebhookSchema), async (c: any) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const webhook = await prisma.webhook.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
    });
    
    if (!webhook) {
      throw new HTTPException(404, { message: 'Webhook not found' });
    }
    
    const updated = await prisma.webhook.update({
      where: { id },
      data: {
        name: body.name,
        url: body.url,
        events: body.events,
        secret: body.secret,
        isActive: body.isActive,
        retryPolicy: body.retryPolicy,
      },
    });
    
    return c.json({ data: updated });
  });

  app.delete('/:id', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const webhook = await prisma.webhook.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
    });
    
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
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const webhook = await prisma.webhook.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
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
      const response = await axios.post(webhook.url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': generateSignature(JSON.stringify(testPayload), webhook.secret),
        },
        timeout: 10000,
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
          responseBody: err.response?.data ? JSON.stringify(err.response.data) : String(err),
          success: false,
        },
      });
      
      return c.json({ 
        success: false, 
        message: 'Test webhook failed',
        error: String(err),
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
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const webhook = await prisma.webhook.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
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
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const webhook = await prisma.webhook.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
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
    
    // Retry the delivery
    try {
      const response = await axios.post(webhook.url, delivery.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': generateSignature(JSON.stringify(delivery.payload), webhook.secret),
        },
        timeout: 10000,
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
      
      return c.json({ success: true, message: 'Delivery retried', status: response.status });
    } catch (err: any) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          responseStatus: err.response?.status || 0,
          responseBody: err.response?.data ? JSON.stringify(err.response.data) : String(err),
          success: false,
          retryCount: delivery.retryCount + 1,
        },
      });
      
      return c.json({ success: false, message: 'Retry failed', error: String(err) });
    }
  });

  // Public endpoint for platform webhooks (no auth required)
  app.post('/platform/:platform', async (c: any) => {
    const platform = c.req.param('platform');
    const signature = c.req.header('x-signature') || c.req.header('x-hub-signature-256');
    const body = await c.req.text();
    
    // TODO: Verify signature, process platform webhook
    // This would handle callbacks from TikTok, Instagram, YouTube, etc.
    
    return c.json({ success: true });
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
  // In production, use proper HMAC
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
