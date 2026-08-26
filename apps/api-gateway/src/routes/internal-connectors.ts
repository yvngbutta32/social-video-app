import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { prisma } from '../lib/prisma.js';
import { metricFreshness, normalizeOfficialMetricSnapshot } from '../lib/metric-ingestion.js';
import { abortMultipartSourceUpload } from '../lib/source-storage.js';
import { parseMultipartUploadSession } from '../lib/multipart-cleanup.js';

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

const multipartCleanupSchema = z.object({
  maxAgeHours: z.number().int().min(1).max(168).default(24),
  limit: z.number().int().min(1).max(250).default(100),
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

function requireConnectorAuthentication(c: any) {
  const expectedToken = connectorToken();
  if (!expectedToken) throw new HTTPException(503, { message: 'Connector ingestion authentication is not configured.' });
  if (!authenticated(c.req.header('x-connector-token'), expectedToken)) throw new HTTPException(401, { message: 'Invalid connector ingestion credentials.' });
}

async function cleanupExpiredMultipartUploads(maxAgeHours: number, limit: number) {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const candidates = await prisma.video.findMany({
    where: { status: 'uploading', createdAt: { lte: cutoff } },
    select: { id: true, metadata: true },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });
  const result = { considered: candidates.length, archived: 0, aborted: 0, skipped: 0, abortFailures: 0 };
  for (const candidate of candidates) {
    const session = parseMultipartUploadSession(candidate.metadata);
    if (!session) {
      result.skipped += 1;
      continue;
    }
    const metadata = candidate.metadata && typeof candidate.metadata === 'object' && !Array.isArray(candidate.metadata)
      ? candidate.metadata as Record<string, unknown>
      : {};
    const archived = await prisma.video.updateMany({
      where: { id: candidate.id, status: 'uploading' },
      data: {
        status: 'archived',
        metadata: { ...metadata, multipartUpload: null, processingState: 'upload_expired', uploadCleanupAt: new Date().toISOString(), uploadCleanupReason: 'expired_incomplete_multipart_session' },
      },
    });
    if (!archived.count) {
      result.skipped += 1;
      continue;
    }
    result.archived += 1;
    try {
      await abortMultipartSourceUpload({ bucket: session.bucket, key: session.objectKey, uploadId: session.uploadId });
      result.aborted += 1;
    } catch {
      result.abortFailures += 1;
      await prisma.video.update({
        where: { id: candidate.id },
        data: { metadata: { ...metadata, multipartUpload: null, processingState: 'upload_expired', uploadCleanupAt: new Date().toISOString(), uploadCleanupReason: 'expired_incomplete_multipart_session', uploadCleanupState: 'abort_pending_retry' } },
      }).catch(() => undefined);
    }
  }
  return { ...result, cutoff: cutoff.toISOString() };
}

export function createInternalConnectorRoutes() {
  const app = new Hono();

  app.post('/metrics', zValidator('json', metricSchema), async (c) => {
    requireConnectorAuthentication(c);

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

  app.post('/maintenance/multipart-uploads/cleanup', zValidator('json', multipartCleanupSchema), async (c) => {
    requireConnectorAuthentication(c);
    const input = c.req.valid('json');
    const result = await cleanupExpiredMultipartUploads(input.maxAgeHours, input.limit);
    return c.json({ data: result, safeguards: ['Only expired uploading records with a valid multipart session are archived.', 'Completed or processing creator sources are never selected.', 'Storage abort failures remain archived and are reported for a later protected retry.'] });
  });

  return app;
}
