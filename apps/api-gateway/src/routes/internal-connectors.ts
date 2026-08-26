import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { prisma } from '../lib/prisma.js';
import { metricFreshness, normalizeOfficialMetricSnapshot } from '../lib/metric-ingestion.js';

const metricSchema = z.object({
  platform: z.enum(['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'linkedin']),
  socialAccountId: z.string().uuid(),
  externalPostId: z.string().min(1).max(512),
  observedAt: z.string().datetime(),
  connector: z.string().min(3).max(100),
  metrics: z.object({
    views: z.number().nonnegative().optional(),
    likes: z.number().nonnegative().optional(),
    comments: z.number().nonnegative().optional(),
    shares: z.number().nonnegative().optional(),
    saves: z.number().nonnegative().optional(),
    clicks: z.number().nonnegative().optional(),
    reach: z.number().nonnegative().optional(),
    impressions: z.number().nonnegative().optional(),
    watchTimeSeconds: z.number().nonnegative().optional(),
    avgWatchTime: z.number().nonnegative().optional(),
    completionRate: z.number().min(0).max(1).optional(),
    followerGain: z.number().nonnegative().optional(),
    profileVisits: z.number().nonnegative().optional(),
    engagementRate: z.number().min(0).max(1).optional(),
  }),
});

function connectorToken() {
  const direct = process.env.CONNECTOR_INGESTION_TOKEN;
  if (direct) return direct.trim();
  const file = process.env.CONNECTOR_INGESTION_TOKEN_FILE;
  if (!file) return '';
  try {
    return readFileSync(file, 'utf8').trim();
  } catch {
    return '';
  }
}

function authenticated(input: string | undefined, expected: string) {
  if (!input || !expected) return false;
  const actualBytes = Buffer.from(input);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

export function createInternalConnectorRoutes() {
  const app = new Hono();

  app.post('/metrics', zValidator('json', metricSchema), async (c) => {
    const expectedToken = connectorToken();
    if (!expectedToken) throw new HTTPException(503, { message: 'Connector ingestion authentication is not configured.' });
    if (!authenticated(c.req.header('x-connector-token'), expectedToken)) throw new HTTPException(401, { message: 'Invalid connector ingestion credentials.' });

    const snapshot = normalizeOfficialMetricSnapshot(c.req.valid('json'));
    const scheduledPost = await prisma.scheduledPost.findFirst({
      where: {
        socialAccountId: snapshot.socialAccountId,
        platformPostId: snapshot.externalPostId,
        socialAccount: { platform: snapshot.platform as any, isActive: true },
      },
      select: { id: true, workspaceId: true, variantId: true, socialAccountId: true },
    });
    if (!scheduledPost) throw new HTTPException(404, { message: 'No active creator-owned scheduled post matches this official platform observation.' });

    const importedAt = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const metric = await tx.postMetric.upsert({
        where: { scheduledPostId_ingestionKey: { scheduledPostId: scheduledPost.id, ingestionKey: snapshot.ingestionKey } },
        create: {
          scheduledPostId: scheduledPost.id,
          workspaceId: scheduledPost.workspaceId,
          variantId: scheduledPost.variantId,
          platform: snapshot.platform as any,
          recordedAt: snapshot.observedAt,
          importedAt,
          ingestionKey: snapshot.ingestionKey,
          provenance: snapshot.provenance,
          metadata: { importPath: 'internal_official_connector' },
          ...snapshot.metrics,
        },
        update: {
          importedAt,
          provenance: snapshot.provenance,
          metadata: { importPath: 'internal_official_connector' },
          ...snapshot.metrics,
        },
        select: { id: true, recordedAt: true, importedAt: true, ingestionKey: true },
      });

      await tx.usageEvent.create({
        data: {
          workspaceId: scheduledPost.workspaceId,
          eventType: 'official_metric_ingested',
          resource_type: 'scheduled_post',
          resource_id: scheduledPost.id,
          properties: { platform: snapshot.platform, connector: snapshot.connector, ingestionKey: snapshot.ingestionKey },
        },
      });
      return metric;
    });

    return c.json({ data: { ...result, freshness: metricFreshness(result.recordedAt, result.importedAt ?? importedAt) } }, 202);
  });

  return app;
}
