import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import type { Variables } from '../index.js';
import { assertPublishingAllowed, requireCreatorWorkspaceAccess, requireWorkspaceAccess } from '../lib/pilot-access.js';

const campaignSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  objective: z.enum(['views', 'engagement', 'followers', 'conversions', 'brand_awareness']),
  budget: z.number().positive().optional(),
  budgetType: z.enum(['daily', 'total']).default('total'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  targetAudience: z.object({
    ageMin: z.number().int().min(13).max(65).optional(),
    ageMax: z.number().int().min(13).max(65).optional(),
    genders: z.array(z.enum(['male', 'female', 'all'])).optional(),
    locations: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
  }).optional(),
  platforms: z.array(z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin'])).min(1),
  optimizationGoal: z.enum(['reach', 'video_views', 'engagement', 'clicks', 'conversions']).default('video_views'),
  autoOptimize: z.boolean().default(true),
});

const updateCampaignSchema = campaignSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
  objective: z.enum(['views', 'engagement', 'followers', 'conversions', 'brand_awareness']).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'startDate', 'budgetSpent']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

async function selectedCampaignWorkspace(c: any, user: { id: string; email: string; role: string }, creatorWrite = false) {
  const workspaceId = c.req.header('x-workspace-id');
  if (!workspaceId) throw new HTTPException(400, { message: 'A valid x-workspace-id header is required for campaign requests.' });
  if (creatorWrite) await requireCreatorWorkspaceAccess(user, workspaceId);
  else await requireWorkspaceAccess(user, workspaceId);
  return workspaceId;
}

export function createCampaignRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/', zValidator('query', querySchema), async (c: any) => {
    const { page, limit, status, objective, sortBy, sortOrder } = c.req.valid('query');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user);
    
    const where: any = { workspaceId };
    
    if (status) {
      where.status = status;
    }
    
    if (objective) {
      where.objective = objective;
    }
    
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    
    const [campaigns, total] = await Promise.all([
      prisma.aBTest.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          variants: {
            include: {
              variant: {
                include: {
                  video: true,
                  socialAccount: true,
                  metrics: { orderBy: { recordedAt: 'desc' }, take: 1 },
                },
              },
            },
          },
        },
      }),
      prisma.aBTest.count({ where }),
    ]);
    
    return c.json({
      data: campaigns,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  app.get('/:id', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user);
    const campaign = await prisma.aBTest.findFirst({
      where: { id, workspaceId },
      include: { variants: { include: { variant: { include: { video: true, socialAccount: true, metrics: { orderBy: { recordedAt: 'desc' } } } } } } },
    });
    if (!campaign) throw new HTTPException(404, { message: 'Campaign not found' });
    return c.json({ data: campaign });
  });

  app.post('/', zValidator('json', campaignSchema), async (c: any) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user, true);
    
    const campaign = await prisma.aBTest.create({
      data: {
        workspaceId,
        name: body.name,
        hypothesis: body.description,
        testType: 'campaign',
        status: 'draft',
        confidenceLevel: 0.95,
        minimumDetectableEffect: 0.1,
        trafficSplit: {},
        metadata: {
          objective: body.objective,
          budget: body.budget,
          budgetType: body.budgetType,
          startDate: body.startDate,
          endDate: body.endDate,
          targetAudience: body.targetAudience,
          platforms: body.platforms,
          optimizationGoal: body.optimizationGoal,
          autoOptimize: body.autoOptimize,
        },
      },
    });
    
    return c.json({ 
      data: { 
        ...campaign, 
        userId: user.id, 
        status: 'draft',
        budgetSpent: 0,
        metrics: { impressions: 0, views: 0, engagement: 0, followers: 0, clicks: 0, conversions: 0 },
        createdAt: campaign.createdAt.toISOString() 
      } 
    }, 201);
  });

  app.patch('/:id', zValidator('json', updateCampaignSchema), async (c: any) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user, true);
    const campaign = await prisma.aBTest.findFirst({ where: { id, workspaceId } });
    if (!campaign) throw new HTTPException(404, { message: 'Campaign not found' });
    const updated = await prisma.aBTest.update({ where: { id }, data: { name: body.name, hypothesis: body.description, metadata: { ...campaign.metadata as any, ...body } } });
    return c.json({ data: updated });
  });

  app.delete('/:id', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user, true);
    const campaign = await prisma.aBTest.findFirst({ where: { id, workspaceId } });
    if (!campaign) throw new HTTPException(404, { message: 'Campaign not found' });
    await prisma.aBTest.delete({ where: { id } });
    return c.json({ success: true });
  });

  app.post('/:id/start', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user, true);
    await assertPublishingAllowed(workspaceId);
    const campaign = await prisma.aBTest.findFirst({ where: { id, workspaceId } });
    if (!campaign) throw new HTTPException(404, { message: 'Campaign not found' });
    const updated = await prisma.aBTest.update({ where: { id }, data: { status: 'running', startedAt: new Date() } });
    return c.json({ success: true, message: 'Campaign started', data: updated });
  });

  app.post('/:id/pause', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user, true);
    const campaign = await prisma.aBTest.findFirst({ where: { id, workspaceId } });
    if (!campaign) throw new HTTPException(404, { message: 'Campaign not found' });
    const updated = await prisma.aBTest.update({ where: { id }, data: { status: 'paused' } });
    return c.json({ success: true, message: 'Campaign paused', data: updated });
  });

  app.post('/:id/resume', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user, true);
    const campaign = await prisma.aBTest.findFirst({ where: { id, workspaceId } });
    if (!campaign) throw new HTTPException(404, { message: 'Campaign not found' });
    const updated = await prisma.aBTest.update({ where: { id }, data: { status: 'running' } });
    return c.json({ success: true, message: 'Campaign resumed', data: updated });
  });

  app.get('/:id/analytics', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user);
    
    const campaign = await prisma.aBTest.findFirst({
      where: { id, workspaceId },
      include: {
        variants: {
          include: {
            variant: {
              include: {
                metrics: { orderBy: { recordedAt: 'desc' } },
                socialAccount: true,
              },
            },
          },
        },
      },
    });
    
    if (!campaign) {
      throw new HTTPException(404, { message: 'Campaign not found' });
    }
    
    // Aggregate analytics across all variants
    const analytics = {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalSaves: 0,
      totalReach: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      byVariant: {} as Record<string, any>,
    };
    
    for (const variant of campaign.variants) {
      const post = variant.variant;
      for (const metric of post.metrics) {
        analytics.totalViews += Number(metric.views);
        analytics.totalLikes += Number(metric.likes);
        analytics.totalComments += Number(metric.comments);
        analytics.totalShares += Number(metric.shares);
        analytics.totalSaves += Number(metric.saves);
        analytics.totalReach += Number(metric.reach);
        analytics.totalImpressions += Number(metric.impressions);
        analytics.totalClicks += Number(metric.clicks);
        
        const variantId = variant.id;
        if (!analytics.byVariant[variantId]) {
          analytics.byVariant[variantId] = {
            views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, impressions: 0, clicks: 0,
          };
        }
        analytics.byVariant[variantId].views += Number(metric.views);
        analytics.byVariant[variantId].likes += Number(metric.likes);
        analytics.byVariant[variantId].comments += Number(metric.comments);
        analytics.byVariant[variantId].shares += Number(metric.shares);
        analytics.byVariant[variantId].saves += Number(metric.saves);
        analytics.byVariant[variantId].reach += Number(metric.reach);
        analytics.byVariant[variantId].impressions += Number(metric.impressions);
        analytics.byVariant[variantId].clicks += Number(metric.clicks);
      }
    }
    
    return c.json({ data: analytics });
  });

  app.get('/:id/videos', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await selectedCampaignWorkspace(c, user);
    
    const campaign = await prisma.aBTest.findFirst({
      where: { id, workspaceId },
      include: {
        variants: {
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
    
    if (!campaign) {
      throw new HTTPException(404, { message: 'Campaign not found' });
    }
    
    const videos = campaign.variants.map((v: any) => v.variant.video).filter(Boolean);
    
    return c.json({ data: videos });
  });

  return app;
}
