import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import type { Variables } from '../index.js';

const querySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']).optional(),
  campaignId: z.string().uuid().optional(),
  videoId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  metrics: z.array(z.enum(['impressions', 'views', 'likes', 'comments', 'shares', 'saves', 'clicks', 'followers', 'reach', 'engagement_rate', 'completion_rate', 'ctr'])).optional(),
});

const exportSchema = z.object({
  format: z.enum(['json', 'csv', 'xlsx']).default('json'),
  ...querySchema.shape,
});

export function createAnalyticsRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/overview', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    // Build where clause for post_metrics
    const where: any = {
      workspaceId,
      recordedAt: { gte: startDate, lte: endDate },
    };
    
    if (query.platform) {
      where.platform = query.platform;
    }
    
    if (query.campaignId) {
      where.scheduledPost = { abTestId: query.campaignId };
    }
    
    if (query.videoId) {
      where.scheduledPost = { variant: { videoId: query.videoId } };
    }
    
    if (query.accountId) {
      where.scheduledPost = { socialAccountId: query.accountId };
    }
    
    // Get aggregated metrics
    const metrics = await prisma.postMetric.aggregate({
      where,
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        clicks: true,
        reach: true,
        impressions: true,
        followerGain: true,
      },
      _avg: {
        engagementRate: true,
        completionRate: true,
      },
    });
    
    // Get top videos
    const topVideos = await prisma.video.findMany({
      where: {
        workspaceId,
        variants: {
          some: {
            scheduledPosts: {
              some: {
                metrics: {
                  some: {
                    recordedAt: { gte: startDate, lte: endDate },
                  },
                },
              },
            },
          },
        },
      },
      include: {
        variants: {
          include: {
            scheduledPosts: {
              include: {
                metrics: {
                  where: { recordedAt: { gte: startDate, lte: endDate } },
                  orderBy: { recordedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      take: 10,
    });
    
    // Get platform breakdown
    const platformBreakdown = await prisma.postMetric.groupBy({
      by: ['platform'],
      where,
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        impressions: true,
        reach: true,
      },
    });
    
    // Get trends (daily aggregates)
    const trends = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', recorded_at) as date,
        platform,
        SUM(views) as views,
        SUM(likes) as likes,
        SUM(comments) as comments,
        SUM(shares) as shares,
        SUM(impressions) as impressions,
        SUM(reach) as reach
      FROM post_metrics
      WHERE workspace_id = ${workspaceId}
        AND recorded_at >= ${startDate}
        AND recorded_at <= ${endDate}
      GROUP BY DATE_TRUNC('day', recorded_at), platform
      ORDER BY date ASC
    `;
    
    const totals = metrics._sum ?? {};
    const averages = metrics._avg ?? {};

    return c.json({
      data: {
        summary: {
          totalImpressions: Number(totals.impressions ?? 0),
          totalViews: Number(totals.views ?? 0),
          totalEngagement: Number(totals.likes ?? 0) + Number(totals.comments ?? 0) + Number(totals.shares ?? 0),
          totalFollowers: Number(totals.followerGain ?? 0),
          avgEngagementRate: Number(averages.engagementRate ?? 0),
          avgCompletionRate: Number(averages.completionRate ?? 0),
        },
        trends: trends as any[],
        topVideos: topVideos.map((v: any) => ({
          id: v.id,
          title: v.title,
          thumbnailUrl: v.variants[0]?.thumbnailObjectKey,
          totalViews: v.variants.reduce((sum: number, variant: any) => 
            sum + variant.scheduledPosts.reduce((s: number, post: any) => 
              s + Number(post.metrics[0]?.views || 0), 0), 0),
          totalEngagement: v.variants.reduce((sum: number, variant: any) => 
            sum + variant.scheduledPosts.reduce((s: number, post: any) => 
              s + Number(post.metrics[0]?.likes || 0) + Number(post.metrics[0]?.comments || 0) + Number(post.metrics[0]?.shares || 0), 0), 0),
        })),
        topCampaigns: [], // TODO: implement
        platformBreakdown: platformBreakdown.reduce((acc, p) => {
          acc[p.platform] = {
            views: Number(p._sum.views || 0),
            likes: Number(p._sum.likes || 0),
            comments: Number(p._sum.comments || 0),
            shares: Number(p._sum.shares || 0),
            impressions: Number(p._sum.impressions || 0),
            reach: Number(p._sum.reach || 0),
          };
          return acc;
        }, {} as Record<string, any>),
      },
    });
  });

  app.get('/timeseries', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where: any = {
      workspaceId,
      recordedAt: { gte: startDate, lte: endDate },
    };
    
    if (query.platform) {
      where.platform = query.platform;
    }
    
    // Determine date truncation based on granularity
    const truncMap = {
      hour: 'hour',
      day: 'day',
      week: 'week',
      month: 'month',
    };
    
    const trunc = truncMap[query.granularity as keyof typeof truncMap];
    
    const data = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${trunc}, recorded_at) as period,
        platform,
        SUM(views) as views,
        SUM(likes) as likes,
        SUM(comments) as comments,
        SUM(shares) as shares,
        SUM(saves) as saves,
        SUM(clicks) as clicks,
        SUM(reach) as reach,
        SUM(impressions) as impressions,
        SUM(follower_gain) as followers,
        AVG(engagement_rate) as engagement_rate,
        AVG(completion_rate) as completion_rate
      FROM post_metrics
      WHERE workspace_id = ${workspaceId}
        AND recorded_at >= ${startDate}
        AND recorded_at <= ${endDate}
      GROUP BY DATE_TRUNC(${trunc}, recorded_at), platform
      ORDER BY period ASC
    `;
    
    return c.json({ data: data as any[] });
  });

  app.get('/platforms', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where: any = {
      workspaceId,
      recordedAt: { gte: startDate, lte: endDate },
    };
    
    const platformData = await prisma.postMetric.groupBy({
      by: ['platform'],
      where,
      _sum: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        clicks: true,
        reach: true,
        impressions: true,
        followerGain: true,
      },
      _avg: {
        engagementRate: true,
        completionRate: true,
      },
    });
    
    return c.json({
      data: platformData.map(p => ({
        platform: p.platform,
        views: Number(p._sum.views || 0),
        likes: Number(p._sum.likes || 0),
        comments: Number(p._sum.comments || 0),
        shares: Number(p._sum.shares || 0),
        saves: Number(p._sum.saves || 0),
        clicks: Number(p._sum.clicks || 0),
        reach: Number(p._sum.reach || 0),
        impressions: Number(p._sum.impressions || 0),
        followers: Number(p._sum.followerGain || 0),
        engagementRate: Number(p._avg.engagementRate || 0),
        completionRate: Number(p._avg.completionRate || 0),
      })),
    });
  });

  app.get('/videos/top', zValidator('query', querySchema.extend({ limit: z.coerce.number().int().positive().max(100).default(10) })), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const videos = await prisma.video.findMany({
      where: {
        workspaceId,
        variants: {
          some: {
            scheduledPosts: {
              some: {
                metrics: {
                  some: {
                    recordedAt: { gte: startDate, lte: endDate },
                  },
                },
              },
            },
          },
        },
      },
      include: {
        variants: {
          include: {
            scheduledPosts: {
              include: {
                metrics: {
                  where: { recordedAt: { gte: startDate, lte: endDate } },
                  orderBy: { recordedAt: 'desc' },
                  take: 1,
                },
                socialAccount: true,
              },
            },
          },
        },
      },
      take: query.limit,
    });
    
    const videoMetrics = videos.map((v: any) => {
      const totalViews = v.variants.reduce((sum: number, variant: any) => 
        sum + variant.scheduledPosts.reduce((s: number, post: any) => 
          s + Number(post.metrics[0]?.views || 0), 0), 0);
      const totalEngagement = v.variants.reduce((sum: number, variant: any) => 
        sum + variant.scheduledPosts.reduce((s: number, post: any) => 
          s + Number(post.metrics[0]?.likes || 0) + Number(post.metrics[0]?.comments || 0) + Number(post.metrics[0]?.shares || 0), 0), 0);
      const totalImpressions = v.variants.reduce((sum: number, variant: any) => 
        sum + variant.scheduledPosts.reduce((s: number, post: any) => 
          s + Number(post.metrics[0]?.impressions || 0), 0), 0);
      
      return {
        id: v.id,
        title: v.title,
        thumbnailUrl: v.variants[0]?.thumbnailObjectKey,
        totalViews,
        totalEngagement,
        totalImpressions,
        engagementRate: totalImpressions > 0 ? totalEngagement / totalImpressions : 0,
        platforms: [...new Set(v.variants.map((vv: any) => vv.platform))],
      };
    }).sort((a: any, b: any) => b.totalViews - a.totalViews);
    
    return c.json({ data: videoMetrics });
  });

  app.get('/campaigns/performance', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const campaigns = await prisma.aBTest.findMany({
      where: {
        workspaceId,
        startedAt: { gte: startDate, lte: endDate },
      },
      include: {
        variants: {
          include: {
            variant: {
              include: {
                metrics: {
                  where: { recordedAt: { gte: startDate, lte: endDate } },
                  orderBy: { recordedAt: 'desc' },
                },
                socialAccount: true,
                video: true,
              },
            },
          },
        },
      },
    });
    
    const campaignMetrics = campaigns.map((c: any) => {
      const totalViews = c.variants.reduce((sum: number, v: any) => 
        sum + v.variant.metrics.reduce((s: number, m: any) => s + Number(m.views || 0), 0), 0);
      const totalEngagement = c.variants.reduce((sum: number, v: any) => 
        sum + v.variant.metrics.reduce((s: number, m: any) => 
          s + Number(m.likes || 0) + Number(m.comments || 0) + Number(m.shares || 0), 0), 0);
      const totalImpressions = c.variants.reduce((sum: number, v: any) => 
        sum + v.variant.metrics.reduce((s: number, m: any) => s + Number(m.impressions || 0), 0), 0);
      
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        hypothesis: c.hypothesis,
        totalViews,
        totalEngagement,
        totalImpressions,
        engagementRate: totalImpressions > 0 ? totalEngagement / totalImpressions : 0,
        variantCount: c.variants.length,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
      };
    });
    
    return c.json({ data: campaignMetrics });
  });

  app.get('/accounts/growth', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const accounts = await prisma.socialAccount.findMany({
      where: { workspaceId, isActive: true },
      include: {
        scheduledPosts: {
          where: { postedAt: { gte: startDate, lte: endDate } },
          include: {
            metrics: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    
    const growthData = accounts.map(acc => {
      const totalFollowerGain = acc.scheduledPosts.reduce((sum, post) => 
        sum + Number(post.metrics[0]?.followerGain || 0), 0);
      const postsCount = acc.scheduledPosts.length;
      
      return {
        id: acc.id,
        platform: acc.platform,
        username: acc.username,
        displayName: acc.displayName,
        followerCount: acc.followerCount,
        followerGain: totalFollowerGain,
        postsCount,
        growthRate: acc.followerCount > 0 ? totalFollowerGain / acc.followerCount : 0,
      };
    }).sort((a, b) => b.followerGain - a.followerGain);
    
    return c.json({ data: growthData });
  });

  app.get('/audience/demographics', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    // Get metrics with audience data from metadata
    const metrics = await prisma.postMetric.findMany({
      where: {
        workspaceId,
        recordedAt: { gte: startDate, lte: endDate },
      },
      select: {
        metadata: true,
        platform: true,
      },
    });
    
    // Aggregate demographics from metadata
    const ageGroups: Record<string, number> = {};
    const genders: Record<string, number> = {};
    const locations: Record<string, number> = {};
    const languages: Record<string, number> = {};
    const activeHours: Record<number, number> = {};
    
    for (const m of metrics) {
      const meta = m.metadata as any;
      if (meta?.audience) {
        if (meta.audience.age) {
          meta.audience.age.forEach((a: any) => {
            ageGroups[a.range] = (ageGroups[a.range] || 0) + a.count;
          });
        }
        if (meta.audience.gender) {
          meta.audience.gender.forEach((g: any) => {
            genders[g.type] = (genders[g.type] || 0) + g.count;
          });
        }
        if (meta.audience.locations) {
          meta.audience.locations.forEach((l: any) => {
            locations[l.country] = (locations[l.country] || 0) + l.count;
          });
        }
        if (meta.audience.languages) {
          meta.audience.languages.forEach((l: any) => {
            languages[l.code] = (languages[l.code] || 0) + l.count;
          });
        }
        if (meta.audience.activeHours) {
          meta.audience.activeHours.forEach((h: any) => {
            activeHours[h.hour] = (activeHours[h.hour] || 0) + h.count;
          });
        }
      }
    }
    
    return c.json({
      data: {
        age: Object.entries(ageGroups).map(([range, count]) => ({ range, count })),
        gender: Object.entries(genders).map(([type, count]) => ({ type, count })),
        locations: Object.entries(locations).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count).slice(0, 20),
        languages: Object.entries(languages).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 10),
        activeHours: Object.entries(activeHours).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => a.hour - b.hour),
      },
    });
  });

  app.get('/content/performance', zValidator('query', querySchema.extend({ 
    contentType: z.enum(['video', 'image', 'carousel', 'story', 'reel', 'short']).optional(),
  })), async (c: any) => {
    const query = c.req.valid('query');
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where: any = {
      workspaceId,
      recordedAt: { gte: startDate, lte: endDate },
    };
    
    if (query.platform) {
      where.platform = query.platform;
    }
    
    const metrics = await prisma.postMetric.findMany({
      where,
      include: {
        scheduledPost: {
          include: {
            variant: {
              include: {
                video: true,
              },
            },
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
    });
    
    // Group by content type (variant type)
    const contentMap: Record<string, any> = {};
    
    for (const m of metrics) {
      const variantType = m.scheduledPost?.variant?.variantType || 'unknown';
      if (!contentMap[variantType]) {
        contentMap[variantType] = {
          contentType: variantType,
          totalViews: 0,
          totalEngagement: 0,
          totalImpressions: 0,
          postCount: 0,
        };
      }
      contentMap[variantType].totalViews += Number(m.views);
      contentMap[variantType].totalEngagement += Number(m.likes) + Number(m.comments) + Number(m.shares);
      contentMap[variantType].totalImpressions += Number(m.impressions);
      contentMap[variantType].postCount += 1;
    }
    
    const contentPerformance = Object.values(contentMap).map(c => ({
      ...c,
      engagementRate: c.totalImpressions > 0 ? c.totalEngagement / c.totalImpressions : 0,
    })).sort((a, b) => b.totalViews - a.totalViews);
    
    return c.json({ data: contentPerformance });
  });

  app.post('/export', zValidator('json', exportSchema), async () => {
    throw new HTTPException(503, { message: 'Analytics export is not available until a durable export queue, private artifact store, and authorized download flow are implemented.' });
  });

  app.get('/export/:id/status', async () => {
    throw new HTTPException(503, { message: 'Analytics export status is not available because no export job has been created.' });
  });

  app.get('/export/:id/download', async () => {
    throw new HTTPException(503, { message: 'Analytics export download is not available because no export artifact exists.' });
  });

  app.get('/realtime', async (c: any) => {
    const user = c.get('user');
    
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    
    if (!workspaceMember) {
      throw new HTTPException(403, { message: 'No workspace access' });
    }
    
    const workspaceId = workspaceMember.workspaceId;
    
    // Get metrics from last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const recentMetrics = await prisma.postMetric.findMany({
      where: {
        workspaceId,
        recordedAt: { gte: oneHourAgo },
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
      include: {
        scheduledPost: {
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
    
    const activeViewers = recentMetrics.reduce((sum, m) => sum + Number(m.views || 0), 0);
    const currentViews = recentMetrics.length;
    const currentEngagement = recentMetrics.reduce((sum, m) => 
      sum + Number(m.likes || 0) + Number(m.comments || 0) + Number(m.shares || 0), 0);
    
    // Get top videos in last hour
    const videoViews: Record<string, number> = {};
    for (const m of recentMetrics) {
      const videoId = m.scheduledPost?.variant?.videoId;
      if (videoId) {
        videoViews[videoId] = (videoViews[videoId] || 0) + Number(m.views || 0);
      }
    }
    
    const topVideoIds = Object.entries(videoViews)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    
    const topVideosNow = await prisma.video.findMany({
      where: { id: { in: topVideoIds } },
      select: { id: true, title: true, variants: { select: { thumbnailObjectKey: true }, take: 1 } },
    });
    
    return c.json({
      data: {
        activeViewers,
        currentViews,
        currentEngagement,
        topVideosNow: topVideosNow.map(v => ({
          id: v.id,
          title: v.title,
          thumbnailUrl: v.variants[0]?.thumbnailObjectKey,
          currentViews: videoViews[v.id] || 0,
        })),
      },
    });
  });

  return app;
}