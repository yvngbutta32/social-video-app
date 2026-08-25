import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import type { Variables } from '../index.js';
import { assertPublishingAllowed } from '../lib/pilot-access.js';

const videoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  sourceUrl: z.string().url(),
  platforms: z.array(z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin'])).min(1),
  scheduleAt: z.string().datetime().optional(),
  tags: z.array(z.string()).max(20).optional(),
  thumbnailUrl: z.string().url().optional(),
  campaignId: z.string().uuid().optional(),
});

const updateVideoSchema = videoSchema.partial();

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']).optional(),
  status: z.enum(['uploading', 'processing', 'ready', 'failed', 'archived']).optional(),
  campaignId: z.string().uuid().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'scheduleAt', 'views']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export function createVideoRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/', zValidator('query', querySchema), async (c: any) => {
    const { page, limit, platform, status, campaignId, sortBy, sortOrder } = c.req.valid('query');
    const user = c.get('user');
    
    // Get user's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    
    // Build where clause
    const where: any = { workspaceId };
    
    if (platform) {
      where.variants = { some: { platform } };
    }
    
    if (status) {
      where.status = status;
    }
    
    if (campaignId) {
      where.variants = { 
        some: { 
          scheduledPosts: { some: { abTest: { campaignId } } } 
        } 
      };
    }
    
    // Build orderBy
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    
    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          variants: {
            where: platform ? { platform } : undefined,
            include: {
              scheduledPosts: {
                include: {
                  socialAccount: true,
                  metrics: { orderBy: { recordedAt: 'desc' }, take: 1 },
                },
              },
            },
          },
          uploader: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.video.count({ where }),
    ]);
    
    return c.json({
      data: videos,
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
    
    const video = await prisma.video.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
      include: {
        variants: {
          include: {
            scheduledPosts: {
              include: {
                socialAccount: true,
                metrics: { orderBy: { recordedAt: 'desc' }, take: 1 },
              },
            },
          },
        },
        uploader: { select: { id: true, name: true, email: true } },
        hooks: true,
      },
    });
    
    if (!video) {
      throw new HTTPException(404, { message: 'Video not found' });
    }
    
    return c.json({ data: video });
  });

  app.post('/', zValidator('json', videoSchema), async (c: any) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    // Create video record
    const video = await prisma.video.create({
      data: {
        workspaceId: workspaceMember.workspaceId,
        uploadedBy: user.id,
        title: body.title,
        description: body.description,
        originalFilename: body.sourceUrl.split('/').pop() || 'video.mp4',
        minioObjectKey: body.sourceUrl, // In real app, this would be a MinIO path after upload
        minioBucket: 'videos',
        status: 'uploading',
        metadata: {
          sourceUrl: body.sourceUrl,
          platforms: body.platforms,
          scheduleAt: body.scheduleAt,
          tags: body.tags,
          thumbnailUrl: body.thumbnailUrl,
          campaignId: body.campaignId,
        },
      },
    });
    
    // TODO: Queue video processing job via BullMQ
    // await videoQueue.add('process', { videoId: video.id, platforms: body.platforms });
    
    return c.json({ 
      data: { 
        ...video, 
        userId: user.id, 
        status: 'uploading', 
        createdAt: video.createdAt.toISOString() 
      } 
    }, 201);
  });

  app.patch('/:id', zValidator('json', updateVideoSchema), async (c: any) => {
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
    
    const video = await prisma.video.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
    });
    
    if (!video) {
      throw new HTTPException(404, { message: 'Video not found' });
    }
    
    const updated = await prisma.video.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        metadata: {
          ...video.metadata as any,
          ...body,
        },
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
    
    const video = await prisma.video.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
    });
    
    if (!video) {
      throw new HTTPException(404, { message: 'Video not found' });
    }
    
    await prisma.video.delete({ where: { id } });
    
    return c.json({ success: true });
  });

  app.post('/:id/publish', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }

    await assertPublishingAllowed(workspaceMember.workspaceId);
    
    const video = await prisma.video.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
      include: { variants: true },
    });
    
    if (!video) {
      throw new HTTPException(404, { message: 'Video not found' });
    }
    
    // TODO: Queue immediate publish job via BullMQ
    // await publishQueue.add('publish', { videoId: video.id, variantIds: video.variants.map(v => v.id) });
    
    return c.json({ success: true, message: 'Publish queued' });
  });

  app.post('/:id/duplicate', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const video = await prisma.video.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
      include: { variants: true },
    });
    
    if (!video) {
      throw new HTTPException(404, { message: 'Video not found' });
    }
    
    const duplicated = await prisma.video.create({
      data: {
        workspaceId: workspaceMember.workspaceId,
        uploadedBy: user.id,
        title: `${video.title} (Copy)`,
        description: video.description,
        originalFilename: video.originalFilename,
        minioObjectKey: video.minioObjectKey,
        minioBucket: video.minioBucket,
        durationSeconds: video.durationSeconds,
        width: video.width,
        height: video.height,
        fps: video.fps,
        fileSizeBytes: video.fileSizeBytes,
        mimeType: video.mimeType,
        status: 'uploading',
        metadata: video.metadata,
      },
    });
    
    return c.json({ data: { id: duplicated.id } }, 201);
  });

  app.get('/:id/analytics', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const video = await prisma.video.findFirst({
      where: { id, workspaceId: workspaceMember.workspaceId },
      include: {
        variants: {
          include: {
            scheduledPosts: {
              include: {
                metrics: { orderBy: { recordedAt: 'desc' } },
                socialAccount: true,
              },
            },
          },
        },
      },
    });
    
    if (!video) {
      throw new HTTPException(404, { message: 'Video not found' });
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
      byPlatform: {} as Record<string, any>,
    };
    
    for (const variant of video.variants) {
      for (const post of variant.scheduledPosts) {
        const latestMetric = post.metrics[0];
        if (latestMetric) {
          analytics.totalViews += Number(latestMetric.views);
          analytics.totalLikes += Number(latestMetric.likes);
          analytics.totalComments += Number(latestMetric.comments);
          analytics.totalShares += Number(latestMetric.shares);
          analytics.totalSaves += Number(latestMetric.saves);
          analytics.totalReach += Number(latestMetric.reach);
          analytics.totalImpressions += Number(latestMetric.impressions);
          
          const platform = post.socialAccount.platform;
          if (!analytics.byPlatform[platform]) {
            analytics.byPlatform[platform] = {
              views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, impressions: 0,
            };
          }
          analytics.byPlatform[platform].views += Number(latestMetric.views);
          analytics.byPlatform[platform].likes += Number(latestMetric.likes);
          analytics.byPlatform[platform].comments += Number(latestMetric.comments);
          analytics.byPlatform[platform].shares += Number(latestMetric.shares);
          analytics.byPlatform[platform].saves += Number(latestMetric.saves);
          analytics.byPlatform[platform].reach += Number(latestMetric.reach);
          analytics.byPlatform[platform].impressions += Number(latestMetric.impressions);
        }
      }
    }
    
    return c.json({ data: analytics });
  });

  return app;
}
