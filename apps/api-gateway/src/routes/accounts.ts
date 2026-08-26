import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import type { Variables } from '../index.js';
import { encryptToken } from '../lib/token-crypto.js';
import { getPlatformCapability, listPlatformCapabilities } from '../lib/platform-capabilities.js';
import { requireCreatorWorkspaceAccess, requireWorkspaceAccess } from '../lib/pilot-access.js';

const accountSchema = z.object({
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
  platformUserId: z.string(),
  username: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  scopes: z.array(z.string()).optional(),
  isBusinessAccount: z.boolean().default(false),
  followerCount: z.number().int().nonnegative().default(0),
});

const updateAccountSchema = accountSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']).optional(),
  status: z.enum(['active', 'expired', 'revoked', 'error']).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'followerCount', 'username']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

async function selectedAccountWorkspace(c: any, user: { id: string; email: string; role: string }, creatorWrite = false) {
  const workspaceId = c.req.header('x-workspace-id');
  if (!workspaceId) throw new HTTPException(400, { message: 'A valid x-workspace-id header is required for creator account requests.' });
  if (creatorWrite) await requireCreatorWorkspaceAccess(user, workspaceId);
  else await requireWorkspaceAccess(user, workspaceId);
  return workspaceId;
}

export function createAccountRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/', zValidator('query', querySchema), async (c: any) => {
    const { page, limit, platform, status, sortBy, sortOrder } = c.req.valid('query');
    const user = c.get('user');
    const workspaceId = await selectedAccountWorkspace(c, user);
    
    const where: any = { workspaceId };
    
    if (platform) {
      where.platform = platform;
    }
    
    if (status) {
      where.isActive = status === 'active';
    }
    
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    
    const [accounts, total] = await Promise.all([
      prisma.socialAccount.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.socialAccount.count({ where }),
    ]);
    
    // Don't return encrypted tokens
    const safeAccounts = accounts.map((acc: any) => {
      const { accessTokenEncrypted: _accessToken, refreshTokenEncrypted: _refreshToken, ...safe } = acc;
      return {
        ...safe,
        capability: getPlatformCapability(acc.platform),
        connectionState: !acc.isActive ? 'revoked' : acc.tokenExpiresAt && new Date(acc.tokenExpiresAt) <= new Date() ? 'token_expired' : 'connected',
      };
    });
    
    return c.json({
      data: safeAccounts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  app.get('/capabilities', async (c: any) => {
    return c.json({ data: listPlatformCapabilities(), safeguards: ['Only creator-authorized official integrations may publish or collect platform data.', 'A capability marked connector_required is not presented as production-ready.'] });
  });

  app.get('/:id', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedAccountWorkspace(c, user);
    
    const account = await prisma.socialAccount.findFirst({
      where: { id, workspaceId },
    });
    
    if (!account) {
      throw new HTTPException(404, { message: 'Account not found' });
    }
    
    // Don't return encrypted tokens
    const { accessTokenEncrypted: _accessToken, refreshTokenEncrypted: _refreshToken, ...safeAccount } = account;
    return c.json({ data: { ...safeAccount, capability: getPlatformCapability(account.platform), connectionState: !account.isActive ? 'revoked' : account.tokenExpiresAt && account.tokenExpiresAt <= new Date() ? 'token_expired' : 'connected' } });
  });

  app.post('/', zValidator('json', accountSchema), async (c: any) => {
const body = c.req.valid('json');
const user = c.get('user');
const workspaceId = await selectedAccountWorkspace(c, user, true);

const account = await prisma.socialAccount.create({
data: {
        workspaceId,
platform: body.platform,
        platformUserId: body.platformUserId,
        username: body.username,
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        accessTokenEncrypted: encryptToken(body.accessToken),
        refreshTokenEncrypted: body.refreshToken ? encryptToken(body.refreshToken) : null,
        tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
        scopes: body.scopes || [],
        isActive: true,
        isBusinessAccount: body.isBusinessAccount,
        followerCount: body.followerCount,
      },
    });
    
    // Don't return encrypted tokens
    const { accessTokenEncrypted: _, refreshTokenEncrypted: __, ...safeAccount } = account;
    
    return c.json({ 
      data: { 
        ...safeAccount, 
        userId: user.id, 
        isActive: true,
        connectedAt: account.connectedAt.toISOString() 
      } 
    }, 201);
  });

  app.patch('/:id', zValidator('json', updateAccountSchema), async (c: any) => {
const id = c.req.param('id');
const body = c.req.valid('json');
const user = c.get('user');
    const workspaceId = await selectedAccountWorkspace(c, user, true);
    
const account = await prisma.socialAccount.findFirst({
      where: { id, workspaceId },
});
    
    if (!account) {
      throw new HTTPException(404, { message: 'Account not found' });
    }
    
    const updated = await prisma.socialAccount.update({
      where: { id },
      data: {
        accessTokenEncrypted: body.accessToken ? encryptToken(body.accessToken) : undefined,
        refreshTokenEncrypted: body.refreshToken ? encryptToken(body.refreshToken) : undefined,
        username: body.username,
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        isActive: body.isActive,
        scopes: body.scopes,
        tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : undefined,
        isBusinessAccount: body.isBusinessAccount,
        followerCount: body.followerCount,
      },
    });
    
    const { accessTokenEncrypted: _, refreshTokenEncrypted: __, ...safeAccount } = updated;
    
    return c.json({ data: safeAccount });
  });

  app.delete('/:id', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedAccountWorkspace(c, user, true);
    const account = await prisma.socialAccount.findFirst({ where: { id, workspaceId } });
    if (!account) throw new HTTPException(404, { message: 'Account not found' });
    await prisma.socialAccount.delete({ where: { id } });
    return c.json({ success: true });
  });

  app.post('/:id/refresh-token', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedAccountWorkspace(c, user, true);
    const account = await prisma.socialAccount.findFirst({ where: { id, workspaceId } });
    if (!account) throw new HTTPException(404, { message: 'Account not found' });
    throw new HTTPException(501, { message: `Official ${account.platform} token refresh connector is not configured yet. Reconnect this creator-authorized account through the official OAuth flow.` });
  });

  app.post('/:id/sync-metrics', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedAccountWorkspace(c, user, true);
    const account = await prisma.socialAccount.findFirst({ where: { id, workspaceId } });
    if (!account) throw new HTTPException(404, { message: 'Account not found' });
    throw new HTTPException(501, { message: `Official ${account.platform} metrics connector is not configured yet. No synthetic sync timestamp was recorded.` });
  });

  app.get('/:id/analytics', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedAccountWorkspace(c, user);
    
    const account = await prisma.socialAccount.findFirst({
      where: { id, workspaceId },
      include: {
        scheduledPosts: {
          include: {
            variant: {
              include: {
                video: true,
              },
            },
            metrics: { orderBy: { recordedAt: 'desc' } },
          },
        },
      },
    });
    
    if (!account) {
      throw new HTTPException(404, { message: 'Account not found' });
    }
    
    // Aggregate analytics across all posts
    const analytics = {
      totalPosts: account.scheduledPosts.length,
      postedCount: account.scheduledPosts.filter((p: any) => p.status === 'posted').length,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalSaves: 0,
      totalReach: 0,
      totalImpressions: 0,
      totalFollowerGain: 0,
      byPost: [] as any[],
    };
    
    for (const post of account.scheduledPosts) {
      const latestMetric = post.metrics[0];
      if (latestMetric) {
        analytics.totalViews += Number(latestMetric.views);
        analytics.totalLikes += Number(latestMetric.likes);
        analytics.totalComments += Number(latestMetric.comments);
        analytics.totalShares += Number(latestMetric.shares);
        analytics.totalSaves += Number(latestMetric.saves);
        analytics.totalReach += Number(latestMetric.reach);
        analytics.totalImpressions += Number(latestMetric.impressions);
        analytics.totalFollowerGain += Number(latestMetric.followerGain);
        
        analytics.byPost.push({
          postId: post.id,
          variantId: post.variantId,
          videoTitle: post.variant?.video?.title,
          status: post.status,
          scheduledAt: post.scheduledAt,
          postedAt: post.postedAt,
          views: Number(latestMetric.views),
          likes: Number(latestMetric.likes),
          comments: Number(latestMetric.comments),
          shares: Number(latestMetric.shares),
          engagementRate: Number(latestMetric.views ?? 0) > 0 
            ? (Number(latestMetric.likes ?? 0) + Number(latestMetric.comments ?? 0) + Number(latestMetric.shares ?? 0)) / Number(latestMetric.views ?? 0)
            : 0,
        });
      }
    }
    
    return c.json({ data: analytics });
  });

  app.get('/:id/videos', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedAccountWorkspace(c, user);
    
    const account = await prisma.socialAccount.findFirst({
      where: { id, workspaceId },
      include: {
        scheduledPosts: {
          include: {
            variant: {
              include: {
                video: true,
              },
            },
          },
        },
      },
    });
    
    if (!account) {
      throw new HTTPException(404, { message: 'Account not found' });
    }
    
    const videos = account.scheduledPosts
      .map((p: any) => p.variant?.video)
      .filter(Boolean);
    
    return c.json({ data: videos });
  });

  return app;
}
