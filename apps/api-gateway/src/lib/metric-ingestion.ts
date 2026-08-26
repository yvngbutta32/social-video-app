import crypto from 'crypto';

export type OfficialMetricSnapshot = {
  platform: string;
  socialAccountId: string;
  externalPostId: string;
  observedAt: string | Date;
  connector: string;
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    clicks?: number;
    reach?: number;
    impressions?: number;
    watchTimeSeconds?: number;
    avgWatchTime?: number;
    completionRate?: number;
    followerGain?: number;
    profileVisits?: number;
    engagementRate?: number;
  };
};

const COUNT_FIELDS = ['views', 'likes', 'comments', 'shares', 'saves', 'clicks', 'reach', 'impressions', 'watchTimeSeconds', 'followerGain', 'profileVisits'] as const;
const DECIMAL_FIELDS = ['avgWatchTime', 'completionRate', 'engagementRate'] as const;

type CountField = (typeof COUNT_FIELDS)[number];
type DecimalField = (typeof DECIMAL_FIELDS)[number];

function finite(value: number | undefined, field: string) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite non-negative number.`);
  return value;
}

export function buildMetricIngestionKey(input: Pick<OfficialMetricSnapshot, 'platform' | 'socialAccountId' | 'externalPostId' | 'observedAt' | 'connector'>) {
  const observedAt = new Date(input.observedAt).toISOString();
  return crypto.createHash('sha256').update([input.platform, input.socialAccountId, input.externalPostId, observedAt, input.connector].join(':')).digest('hex');
}

export function normalizeOfficialMetricSnapshot(input: OfficialMetricSnapshot) {
  const observedAt = new Date(input.observedAt);
  if (!input.platform || !input.socialAccountId || !input.externalPostId || !input.connector) throw new Error('Platform, creator account, external post ID, and connector are required.');
  if (Number.isNaN(observedAt.getTime())) throw new Error('observedAt must be a valid timestamp.');

  const normalized: Record<string, number | undefined> = {};
  for (const field of COUNT_FIELDS) normalized[field] = Math.round(finite(input.metrics[field], field) ?? 0);
  for (const field of DECIMAL_FIELDS) normalized[field] = finite(input.metrics[field], field);
  for (const field of ['completionRate', 'engagementRate'] as const) {
    const value = normalized[field];
    if (value !== undefined && value > 1) throw new Error(`${field} must be normalized between 0 and 1.`);
  }

  return {
    platform: input.platform.toLowerCase(),
    socialAccountId: input.socialAccountId,
    externalPostId: input.externalPostId,
    connector: input.connector,
    observedAt,
    ingestionKey: buildMetricIngestionKey(input),
    metrics: normalized as Record<CountField | DecimalField, number | undefined>,
    provenance: {
      source: 'official_connector',
      connector: input.connector,
      externalPostId: input.externalPostId,
      observedAt: observedAt.toISOString(),
      schemaVersion: 'metric-ingestion-v1',
    },
  };
}

export function metricFreshness(observedAt: Date | string, importedAt: Date | string, now = new Date()) {
  const observed = new Date(observedAt).getTime();
  const imported = new Date(importedAt).getTime();
  const ageMs = Math.max(0, now.getTime() - observed);
  const importLagMs = Math.max(0, imported - observed);
  const state = ageMs <= 6 * 60 * 60 * 1000 ? 'fresh' : ageMs <= 24 * 60 * 60 * 1000 ? 'aging' : 'stale';
  return { state, ageMs, importLagMs };
}
