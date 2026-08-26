import { Hono } from 'hono';
import type { Prisma } from '@prisma/client';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import { requireWorkspaceAccess } from '../lib/pilot-access.js';
import { buildAnalyticsMetricWhere, latestMetricSnapshots, numberValue, periodKey, summarizeMetricSnapshots } from '../lib/analytics-integrity.js';
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

const workspaceHeaderSchema = z.string().uuid();

async function resolveAnalyticsWorkspace(c: any) {
  const requestedWorkspaceId = c.req.header('x-workspace-id');
  const parsedWorkspaceId = workspaceHeaderSchema.safeParse(requestedWorkspaceId);
  if (!parsedWorkspaceId.success) {
    throw new HTTPException(400, { message: 'A valid x-workspace-id header is required for analytics requests' });
  }

  const access = await requireWorkspaceAccess(c.get('user'), parsedWorkspaceId.data);
  return access.workspaceId;
}

export function createAnalyticsRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/overview', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const workspaceId = await resolveAnalyticsWorkspace(c);
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where = buildAnalyticsMetricWhere(workspaceId, startDate, endDate, query);
    const observedMetrics = await prisma.postMetric.findMany({
      where,
      include: { scheduledPost: { include: { variant: { include: { video: true } } } } },
      orderBy: [{ scheduledPostId: 'asc' }, { recordedAt: 'desc' }, { importedAt: 'desc' }],
    });
    const metrics = latestMetricSnapshots(observedMetrics);
    const totals = summarizeMetricSnapshots(metrics);

    const topVideosById = new Map<string, { id: string; title: string; thumbnailUrl: string | null; totalViews: number; totalEngagement: number }>();
    const platformBreakdown = new Map<string, ReturnType<typeof summarizeMetricSnapshots>>();
    const trendBreakdown = new Map<string, { date: string; platform: string; metrics: typeof metrics }>();
    for (const metric of metrics) {
      const video = metric.scheduledPost.variant.video;
      const existingVideo = topVideosById.get(video.id) || { id: video.id, title: video.title || 'Untitled source', thumbnailUrl: metric.scheduledPost.variant.thumbnailObjectKey, totalViews: 0, totalEngagement: 0 };
      existingVideo.totalViews += numberValue(metric.views);
      existingVideo.totalEngagement += numberValue(metric.likes) + numberValue(metric.comments) + numberValue(metric.shares);
      topVideosById.set(video.id, existingVideo);

      const platformMetrics = metrics.filter((item) => item.platform === metric.platform);
      platformBreakdown.set(metric.platform, summarizeMetricSnapshots(platformMetrics));
      const date = periodKey(metric.recordedAt, 'day');
      const trendKey = `${date}:${metric.platform}`;
      const existingTrend = trendBreakdown.get(trendKey) || { date, platform: metric.platform, metrics: [] as typeof metrics };
      existingTrend.metrics.push(metric);
      trendBreakdown.set(trendKey, existingTrend);
    }
    const topVideos = [...topVideosById.values()].sort((left, right) => right.totalViews - left.totalViews).slice(0, 10);
    const trends = [...trendBreakdown.values()].map((trend) => ({ date: trend.date, platform: trend.platform, ...summarizeMetricSnapshots(trend.metrics) }));

    return c.json({
      data: {
        summary: {
          totalImpressions: totals.impressions,
          totalViews: totals.views,
          totalEngagement: totals.likes + totals.comments + totals.shares,
          totalFollowers: totals.followerGain,
          avgEngagementRate: totals.averageEngagementRate,
          avgCompletionRate: totals.averageCompletionRate,
        },
        trends: trends as any[],
        topVideos,
        topCampaigns: [], // TODO: implement
        platformBreakdown: Object.fromEntries([...platformBreakdown.entries()].map(([platform, summary]) => [platform, {
          views: summary.views,
          likes: summary.likes,
          comments: summary.comments,
          shares: summary.shares,
          impressions: summary.impressions,
          reach: summary.reach,
        }])),
      },
    });
  });

  app.get('/timeseries', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const workspaceId = await resolveAnalyticsWorkspace(c);
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where = buildAnalyticsMetricWhere(workspaceId, startDate, endDate, query);
    const observedMetrics = await prisma.postMetric.findMany({
      where,
      orderBy: [{ scheduledPostId: 'asc' }, { recordedAt: 'desc' }, { importedAt: 'desc' }],
    });
    const metrics = latestMetricSnapshots(observedMetrics);
    const periods = new Map<string, { period: string; platform: string; metrics: typeof metrics }>();
    for (const metric of metrics) {
      const period = periodKey(metric.recordedAt, query.granularity);
      const key = `${period}:${metric.platform}`;
      const group = periods.get(key) || { period, platform: metric.platform, metrics: [] as typeof metrics };
      group.metrics.push(metric);
      periods.set(key, group);
    }
    const data = [...periods.values()].map((group) => {
      const summary = summarizeMetricSnapshots(group.metrics);
      return {
        period: group.period,
        platform: group.platform,
        views: summary.views,
        likes: summary.likes,
        comments: summary.comments,
        shares: summary.shares,
        saves: summary.saves,
        clicks: summary.clicks,
        reach: summary.reach,
        impressions: summary.impressions,
        followers: summary.followerGain,
        engagement_rate: summary.averageEngagementRate,
        completion_rate: summary.averageCompletionRate,
      };
    }).sort((left, right) => left.period.localeCompare(right.period) || left.platform.localeCompare(right.platform));
    
    return c.json({ data });
  });

  app.get('/platforms', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const workspaceId = await resolveAnalyticsWorkspace(c);
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where = buildAnalyticsMetricWhere(workspaceId, startDate, endDate, query);
    const observedMetrics = await prisma.postMetric.findMany({
      where,
      orderBy: [{ scheduledPostId: 'asc' }, { recordedAt: 'desc' }, { importedAt: 'desc' }],
    });
    const metrics = latestMetricSnapshots(observedMetrics);
    const byPlatform = new Map<string, typeof metrics>();
    for (const metric of metrics) byPlatform.set(metric.platform, [...(byPlatform.get(metric.platform) || []), metric]);
    
    return c.json({
      data: [...byPlatform.entries()].map(([platform, platformMetrics]) => {
        const summary = summarizeMetricSnapshots(platformMetrics);
        return {
          platform,
          views: summary.views,
          likes: summary.likes,
          comments: summary.comments,
          shares: summary.shares,
          saves: summary.saves,
          clicks: summary.clicks,
          reach: summary.reach,
          impressions: summary.impressions,
          followers: summary.followerGain,
          engagementRate: summary.averageEngagementRate,
          completionRate: summary.averageCompletionRate,
        };
      }),
    });
  });

  app.get('/videos/top', zValidator('query', querySchema.extend({ limit: z.coerce.number().int().positive().max(100).default(10) })), async (c: any) => {
    const query = c.req.valid('query');
    const workspaceId = await resolveAnalyticsWorkspace(c);
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where = buildAnalyticsMetricWhere(workspaceId, startDate, endDate, query);
    const observedMetrics = await prisma.postMetric.findMany({
      where,
      include: { scheduledPost: { include: { variant: { include: { video: true } } } } },
      orderBy: [{ scheduledPostId: 'asc' }, { recordedAt: 'desc' }, { importedAt: 'desc' }],
    });
    const metrics = latestMetricSnapshots(observedMetrics);
    const videos = new Map<string, { id: string; title: string; thumbnailUrl: string | null; totalViews: number; totalEngagement: number; totalImpressions: number; platforms: Set<string> }>();
    for (const metric of metrics) {
      const variant = metric.scheduledPost.variant;
      const video = variant.video;
      const current = videos.get(video.id) || { id: video.id, title: video.title || 'Untitled source', thumbnailUrl: variant.thumbnailObjectKey, totalViews: 0, totalEngagement: 0, totalImpressions: 0, platforms: new Set<string>() };
      current.totalViews += numberValue(metric.views);
      current.totalEngagement += numberValue(metric.likes) + numberValue(metric.comments) + numberValue(metric.shares);
      current.totalImpressions += numberValue(metric.impressions);
      current.platforms.add(metric.platform);
      videos.set(video.id, current);
    }
    const videoMetrics = [...videos.values()].map((video) => ({
      ...video,
      platforms: [...video.platforms],
      engagementRate: video.totalImpressions > 0 ? video.totalEngagement / video.totalImpressions : 0,
    })).sort((left, right) => right.totalViews - left.totalViews).slice(0, query.limit);
    
    return c.json({ data: videoMetrics });
  });

  app.get('/campaigns/performance', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const workspaceId = await resolveAnalyticsWorkspace(c);
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where = buildAnalyticsMetricWhere(workspaceId, startDate, endDate, query);
    const observedMetrics = await prisma.postMetric.findMany({
      where,
      include: { scheduledPost: { include: { abTest: true } } },
      orderBy: [{ scheduledPostId: 'asc' }, { recordedAt: 'desc' }, { importedAt: 'desc' }],
    });
    const metrics = latestMetricSnapshots(observedMetrics);
    const campaigns = new Map<string, { id: string; name: string; status: string; hypothesis: string | null; startedAt: Date; completedAt: Date | null; metrics: typeof metrics; variantIds: Set<string> }>();
    for (const metric of metrics) {
      const campaign = metric.scheduledPost.abTest;
      if (!campaign) continue;
      const current = campaigns.get(campaign.id) || { id: campaign.id, name: campaign.name, status: campaign.status, hypothesis: campaign.hypothesis, startedAt: campaign.startedAt, completedAt: campaign.completedAt, metrics: [] as typeof metrics, variantIds: new Set<string>() };
      current.metrics.push(metric);
      current.variantIds.add(metric.scheduledPost.variantId);
      campaigns.set(campaign.id, current);
    }
    const campaignMetrics = [...campaigns.values()].map((campaign) => {
      const summary = summarizeMetricSnapshots(campaign.metrics);
      const totalEngagement = summary.likes + summary.comments + summary.shares;
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        hypothesis: campaign.hypothesis,
        totalViews: summary.views,
        totalEngagement,
        totalImpressions: summary.impressions,
        engagementRate: summary.impressions > 0 ? totalEngagement / summary.impressions : 0,
        variantCount: campaign.variantIds.size,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
      };
    });
    
    return c.json({ data: campaignMetrics });
  });

  app.get('/accounts/growth', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const workspaceId = await resolveAnalyticsWorkspace(c);
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where = buildAnalyticsMetricWhere(workspaceId, startDate, endDate, query);
    const observedMetrics = await prisma.postMetric.findMany({
      where,
      include: { scheduledPost: { include: { socialAccount: true } } },
      orderBy: [{ scheduledPostId: 'asc' }, { recordedAt: 'desc' }, { importedAt: 'desc' }],
    });
    const metrics = latestMetricSnapshots(observedMetrics);
    const accounts = new Map<string, { id: string; platform: string; username: string; displayName: string | null; followerCount: number; metrics: typeof metrics; postIds: Set<string> }>();
    for (const metric of metrics) {
      const account = metric.scheduledPost.socialAccount;
      if (!account.isActive) continue;
      const current = accounts.get(account.id) || { id: account.id, platform: account.platform, username: account.username || 'unknown', displayName: account.displayName, followerCount: account.followerCount, metrics: [] as typeof metrics, postIds: new Set<string>() };
      current.metrics.push(metric);
      current.postIds.add(metric.scheduledPostId);
      accounts.set(account.id, current);
    }
    const growthData = [...accounts.values()].map((account) => {
      const summary = summarizeMetricSnapshots(account.metrics);
      return {
        id: account.id,
        platform: account.platform,
        username: account.username,
        displayName: account.displayName,
        followerCount: account.followerCount,
        followerGain: summary.followerGain,
        postsCount: account.postIds.size,
        growthRate: account.followerCount > 0 ? summary.followerGain / account.followerCount : 0,
      };
    }).sort((left, right) => right.followerGain - left.followerGain);
    
    return c.json({ data: growthData });
  });

  app.get('/audience/demographics', zValidator('query', querySchema), async (c: any) => {
    const query = c.req.valid('query');
    const workspaceId = await resolveAnalyticsWorkspace(c);
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where = buildAnalyticsMetricWhere(workspaceId, startDate, endDate, query);
    const observedMetrics = await prisma.postMetric.findMany({
      where,
      select: {
        id: true,
        scheduledPostId: true,
        platform: true,
        recordedAt: true,
        importedAt: true,
        metadata: true,
      },
      orderBy: [{ scheduledPostId: 'asc' }, { recordedAt: 'desc' }, { importedAt: 'desc' }],
    });
    const metrics = latestMetricSnapshots(observedMetrics);
    
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
    const workspaceId = await resolveAnalyticsWorkspace(c);
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const where = buildAnalyticsMetricWhere(workspaceId, startDate, endDate, query);
    if (query.contentType) {
      const existingScheduledPostFilter = where.scheduledPost as Prisma.ScheduledPostWhereInput | undefined;
      where.scheduledPost = {
        AND: [
          ...(existingScheduledPostFilter ? [existingScheduledPostFilter] : []),
          { variant: { variantType: query.contentType } },
        ],
      };
    }
    const observedMetrics = await prisma.postMetric.findMany({
      where,
      include: { scheduledPost: { include: { variant: { include: { video: true } } } } },
      orderBy: [{ scheduledPostId: 'asc' }, { recordedAt: 'desc' }, { importedAt: 'desc' }],
    });
    const metrics = latestMetricSnapshots(observedMetrics);
    const contentMap = new Map<string, { totalViews: number; totalEngagement: number; totalImpressions: number; postCount: number }>();
    for (const metric of metrics) {
      const variantType = metric.scheduledPost.variant.variantType || 'unknown';
      const content = contentMap.get(variantType) || { totalViews: 0, totalEngagement: 0, totalImpressions: 0, postCount: 0 };
      content.totalViews += numberValue(metric.views);
      content.totalEngagement += numberValue(metric.likes) + numberValue(metric.comments) + numberValue(metric.shares);
      content.totalImpressions += numberValue(metric.impressions);
      content.postCount += 1;
      contentMap.set(variantType, content);
    }
    
    const contentPerformance = [...contentMap.entries()].map(([contentType, content]) => ({
      contentType,
      ...content,
      engagementRate: content.totalImpressions > 0 ? content.totalEngagement / content.totalImpressions : 0,
    })).sort((left, right) => right.totalViews - left.totalViews);
    
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
    const workspaceId = await resolveAnalyticsWorkspace(c);
    
    // Get metrics from last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const observedMetrics = await prisma.postMetric.findMany({
      where: { workspaceId, recordedAt: { gte: oneHourAgo } },
      orderBy: [{ scheduledPostId: 'asc' }, { recordedAt: 'desc' }, { importedAt: 'desc' }],
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
    
    const recentMetrics = latestMetricSnapshots(observedMetrics);
    const activeViewers = recentMetrics.reduce((sum, m) => sum + numberValue(m.views), 0);
    const currentViews = recentMetrics.length;
    const currentEngagement = recentMetrics.reduce((sum, m) => 
      sum + numberValue(m.likes) + numberValue(m.comments) + numberValue(m.shares), 0);
    
    // Get top videos in last hour
    const videoViews: Record<string, number> = {};
    for (const m of recentMetrics) {
      const videoId = m.scheduledPost?.variant?.videoId;
      if (videoId) {
        videoViews[videoId] = (videoViews[videoId] || 0) + numberValue(m.views);
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