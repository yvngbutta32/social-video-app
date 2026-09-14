import type { Prisma } from '@prisma/client';

type MetricScheduledPost = {
  variant?: { video?: { id: string; title: string | null }; thumbnailObjectKey?: string | null; variantType?: string | null; videoId?: string | null } | null;
  variantId?: string;
  abTest?: { id: string; name: string; status: string; hypothesis: string | null; startedAt: Date; completedAt: Date | null } | null;
  socialAccount?: { id: string; platform: string; username: string | null; displayName: string | null; followerCount: number; isActive: boolean } | null;
};
export type AnalyticsFilters = {
  platform?: 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'x' | 'linkedin';
  campaignId?: string;
  videoId?: string;
  accountId?: string;
};

export type MetricSnapshot = {
  id: string;
  scheduledPostId: string;
  platform: string;
  scheduledPost?: MetricScheduledPost;
  metadata?: unknown;
  recordedAt: Date;
  importedAt?: Date | null;
  views?: bigint | number | null;
  likes?: bigint | number | null;
  comments?: bigint | number | null;
  shares?: bigint | number | null;
  saves?: bigint | number | null;
  clicks?: bigint | number | null;
  reach?: bigint | number | null;
  impressions?: bigint | number | null;
  followerGain?: bigint | number | null;
  engagementRate?: { toNumber(): number } | number | null;
  completionRate?: { toNumber(): number } | number | null;
};

export function buildAnalyticsMetricWhere(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
  filters: AnalyticsFilters,
): Prisma.PostMetricWhereInput {
  const scheduledPostFilters: Prisma.ScheduledPostWhereInput[] = [];
  if (filters.campaignId) scheduledPostFilters.push({ abTestId: filters.campaignId });
  if (filters.videoId) scheduledPostFilters.push({ variant: { videoId: filters.videoId } });
  if (filters.accountId) scheduledPostFilters.push({ socialAccountId: filters.accountId });

  return {
    workspaceId,
    recordedAt: { gte: startDate, lte: endDate },
    ...(filters.platform ? { platform: filters.platform } : {}),
    ...(scheduledPostFilters.length > 0 ? { scheduledPost: { AND: scheduledPostFilters } } : {}),
  };
}

function compareSnapshots(left: MetricSnapshot, right: MetricSnapshot) {
  const recordedDifference = right.recordedAt.getTime() - left.recordedAt.getTime();
  if (recordedDifference !== 0) return recordedDifference;
  const importedDifference = (right.importedAt?.getTime() ?? 0) - (left.importedAt?.getTime() ?? 0);
  if (importedDifference !== 0) return importedDifference;
  return right.id.localeCompare(left.id);
}

/**
 * Platform metric rows are snapshots, not incremental events. Analytics must retain
 * only the newest snapshot for each scheduled post to avoid inflating creator outcomes.
 */
export function latestMetricSnapshots<T extends MetricSnapshot>(metrics: T[]): T[] {
  const latestByPost = new Map<string, T>();
  for (const metric of metrics) {
    const current = latestByPost.get(metric.scheduledPostId);
    if (!current || compareSnapshots(metric, current) < 0) latestByPost.set(metric.scheduledPostId, metric);
  }
  return [...latestByPost.values()];
}

export function numberValue(value: bigint | number | { toNumber(): number } | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === 'object' ? value.toNumber() : Number(value);
}

export function summarizeMetricSnapshots(metrics: MetricSnapshot[]) {
  const totals = metrics.reduce((summary, metric) => ({
    views: summary.views + numberValue(metric.views),
    likes: summary.likes + numberValue(metric.likes),
    comments: summary.comments + numberValue(metric.comments),
    shares: summary.shares + numberValue(metric.shares),
    saves: summary.saves + numberValue(metric.saves),
    clicks: summary.clicks + numberValue(metric.clicks),
    reach: summary.reach + numberValue(metric.reach),
    impressions: summary.impressions + numberValue(metric.impressions),
    followerGain: summary.followerGain + numberValue(metric.followerGain),
    engagementRate: summary.engagementRate + numberValue(metric.engagementRate),
    completionRate: summary.completionRate + numberValue(metric.completionRate),
  }), {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    reach: 0,
    impressions: 0,
    followerGain: 0,
    engagementRate: 0,
    completionRate: 0,
  });

  return {
    ...totals,
    averageEngagementRate: metrics.length ? totals.engagementRate / metrics.length : 0,
    averageCompletionRate: metrics.length ? totals.completionRate / metrics.length : 0,
    count: metrics.length,
  };
}

export function periodKey(date: Date, granularity: 'hour' | 'day' | 'week' | 'month') {
  const value = new Date(date);
  value.setUTCMinutes(granularity === 'hour' ? 0 : value.getUTCMinutes());
  value.setUTCSeconds(0, 0);
  if (granularity === 'day' || granularity === 'week' || granularity === 'month') value.setUTCHours(0, 0, 0, 0);
  if (granularity === 'week') value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  if (granularity === 'month') value.setUTCDate(1);
  return value.toISOString();
}
