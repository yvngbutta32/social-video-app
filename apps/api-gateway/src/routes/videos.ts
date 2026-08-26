import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import type { Variables } from '../index.js';
import { requireCreatorWorkspaceAccess, requireWorkspaceAccess } from '../lib/pilot-access.js';
import { MAX_MULTIPART_SOURCE_PARTS, MULTIPART_SOURCE_PART_BYTES, abortMultipartSourceUpload, completeMultipartSourceUpload, createMultipartPartUrl, createMultipartSourceUpload, listMultipartSourceParts, multipartPartCount, uploadSource } from '../lib/source-storage.js';
import { enqueueVideoProcessing } from '../lib/processing-dispatch';
import { buildProcessingDiagnostic } from '../lib/processing-diagnostics.js';
import { jsonSafe } from '../lib/json-safe.js';

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

const multipartInitiateSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
});

function sourceUploadValidation(name: string, contentType: string, sizeBytes: number) {
  const extensionAllowed = /\.(mp4|mov|webm|m4v)$/i.test(name);
  const mimeAllowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'].includes(contentType);
  if (!extensionAllowed || (contentType !== 'application/octet-stream' && !mimeAllowed)) {
    throw new HTTPException(415, { message: 'Only MP4, MOV, WebM, and M4V creator source videos are accepted.' });
  }
  const maxBytes = Number(process.env.MAX_SOURCE_UPLOAD_BYTES || 524_288_000);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
    throw new HTTPException(413, { message: `Source video exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit or is empty.` });
  }
  const partCount = multipartPartCount(sizeBytes);
  if (partCount > MAX_MULTIPART_SOURCE_PARTS) throw new HTTPException(413, { message: 'Source video requires too many secure upload parts.' });
  return { maxBytes, partCount };
}

function multipartSession(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const candidate = (metadata as Record<string, unknown>).multipartUpload;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const value = candidate as Record<string, unknown>;
  if (typeof value.uploadId !== 'string' || typeof value.objectKey !== 'string' || typeof value.bucket !== 'string' || !Number.isInteger(value.partCount) || !Number.isInteger(value.partSizeBytes)) return null;
  return { uploadId: value.uploadId, objectKey: value.objectKey, bucket: value.bucket, partCount: value.partCount as number, partSizeBytes: value.partSizeBytes as number };
}

async function creatorWorkspaceForRequest(c: any, user: { id: string; email: string; role: string }) {
  const workspaceId = c.req.header('x-workspace-id');
  if (!workspaceId) throw new HTTPException(400, { message: 'A valid x-workspace-id header is required for creator upload requests.' });
  await requireCreatorWorkspaceAccess(user, workspaceId);
  return workspaceId;
}

async function workspaceForReadRequest(c: any, user: { id: string; email: string; role: string }) {
  const workspaceId = c.req.header('x-workspace-id');
  if (!workspaceId) throw new HTTPException(400, { message: 'A valid x-workspace-id header is required for workspace source requests.' });
  await requireWorkspaceAccess(user, workspaceId);
  return workspaceId;
}

function requireSelectedSourceWorkspace(sourceWorkspaceId: string, selectedWorkspaceId: string) {
  if (sourceWorkspaceId !== selectedWorkspaceId) throw new HTTPException(404, { message: 'Video not found' });
}

export function createVideoRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/', zValidator('query', querySchema), async (c: any) => {
    const { page, limit, platform, status, campaignId, sortBy, sortOrder } = c.req.valid('query');
    const user = c.get('user');
    const workspaceId = await workspaceForReadRequest(c, user);
    
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
    
    return c.json(jsonSafe({
      data: videos,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }));
  });

  app.post('/uploads/multipart/initiate', zValidator('json', multipartInitiateSchema), async (c: any) => {
    const user = c.get('user');
    const workspaceId = await creatorWorkspaceForRequest(c, user);
    const input = c.req.valid('json');
    const { partCount } = sourceUploadValidation(input.fileName, input.contentType, input.sizeBytes);
    let stored;
    try {
      stored = await createMultipartSourceUpload({ workspaceId, originalFilename: input.fileName, contentType: input.contentType });
    } catch {
      throw new HTTPException(503, { message: 'Private resumable upload is unavailable until secure device-reachable storage is configured.' });
    }
    const title = input.title || input.fileName.replace(/\.[^.]+$/, '');
    const video = await prisma.video.create({
      data: {
        workspaceId,
        uploadedBy: user.id,
        title,
        originalFilename: input.fileName,
        minioObjectKey: stored.key,
        minioBucket: stored.bucket,
        fileSizeBytes: BigInt(input.sizeBytes),
        mimeType: input.contentType,
        status: 'uploading',
        metadata: {
          sourceType: 'creator-multipart-upload',
          processingState: 'awaiting_upload',
          multipartUpload: { uploadId: stored.uploadId, objectKey: stored.key, bucket: stored.bucket, partCount, partSizeBytes: MULTIPART_SOURCE_PART_BYTES },
        },
      },
      select: { id: true, status: true, createdAt: true },
    });
    return c.json({ data: { videoId: video.id, status: video.status, partSizeBytes: MULTIPART_SOURCE_PART_BYTES, partCount, createdAt: video.createdAt }, nextStep: 'request_part_url' }, 201);
  });

  app.get('/uploads/multipart/:id', async (c: any) => {
    const user = c.get('user');
    const workspaceId = await creatorWorkspaceForRequest(c, user);
    const video = await prisma.video.findUnique({ where: { id: c.req.param('id') }, select: { id: true, workspaceId: true, status: true, metadata: true } });
    if (!video) throw new HTTPException(404, { message: 'Creator upload session not found.' });
    requireSelectedSourceWorkspace(video.workspaceId, workspaceId);
    const session = multipartSession(video.metadata);
    if (!session) throw new HTTPException(409, { message: 'This source does not have an active resumable upload session.' });
    let completedParts;
    try { completedParts = await listMultipartSourceParts({ bucket: session.bucket, key: session.objectKey, uploadId: session.uploadId }); }
    catch { throw new HTTPException(409, { message: 'This resumable upload session is no longer available. Start a new private upload.' }); }
    return c.json({ data: { videoId: video.id, status: video.status, partSizeBytes: session.partSizeBytes, partCount: session.partCount, completedParts: completedParts.map((part) => part.partNumber), remainingParts: Math.max(0, session.partCount - completedParts.length) } });
  });

  app.post('/uploads/multipart/:id/part-url', zValidator('json', z.object({ partNumber: z.number().int().positive() })), async (c: any) => {
    const user = c.get('user');
    const workspaceId = await creatorWorkspaceForRequest(c, user);
    const video = await prisma.video.findUnique({ where: { id: c.req.param('id') }, select: { id: true, workspaceId: true, metadata: true, status: true } });
    if (!video) throw new HTTPException(404, { message: 'Creator upload session not found.' });
    requireSelectedSourceWorkspace(video.workspaceId, workspaceId);
    const session = multipartSession(video.metadata);
    const { partNumber } = c.req.valid('json');
    if (!session || video.status !== 'uploading' || partNumber > session.partCount) throw new HTTPException(409, { message: 'This private upload part is not available.' });
    try {
      const signed = await createMultipartPartUrl({ bucket: session.bucket, key: session.objectKey, uploadId: session.uploadId, partNumber });
      return c.json({ data: { partNumber, uploadUrl: signed.url, expiresAt: signed.expiresAt } });
    } catch {
      throw new HTTPException(503, { message: 'A secure upload URL could not be prepared. Retry this part from the creator workspace.' });
    }
  });

  app.post('/uploads/multipart/:id/complete', async (c: any) => {
    const user = c.get('user');
    const workspaceId = await creatorWorkspaceForRequest(c, user);
    const video = await prisma.video.findUnique({ where: { id: c.req.param('id') }, select: { id: true, workspaceId: true, metadata: true, status: true } });
    if (!video) throw new HTTPException(404, { message: 'Creator upload session not found.' });
    requireSelectedSourceWorkspace(video.workspaceId, workspaceId);
    const session = multipartSession(video.metadata);
    if (!session || video.status !== 'uploading') throw new HTTPException(409, { message: 'This private upload is not ready to complete.' });
    let parts;
    try { parts = await listMultipartSourceParts({ bucket: session.bucket, key: session.objectKey, uploadId: session.uploadId }); }
    catch { throw new HTTPException(409, { message: 'This resumable upload session is no longer available. Start a new private upload.' }); }
    if (parts.length !== session.partCount || parts.some((part, index) => part.partNumber !== index + 1)) {
      throw new HTTPException(409, { message: 'Private upload is incomplete. Resume the remaining source parts before completion.' });
    }
    try { await completeMultipartSourceUpload({ bucket: session.bucket, key: session.objectKey, uploadId: session.uploadId, parts }); }
    catch { throw new HTTPException(503, { message: 'Private upload completion could not be confirmed. Refresh upload status before retrying.' }); }
    try {
      const processing = await enqueueVideoProcessing(video.id);
      await prisma.video.update({ where: { id: video.id }, data: { metadata: { sourceType: 'creator-multipart-upload', processingState: 'queued', processingJobId: processing.jobId, processingQueuedAt: new Date().toISOString() } } });
      return c.json({ data: { videoId: video.id, status: 'uploading' }, processing, nextStep: 'processing_queued' });
    } catch {
      await prisma.video.update({ where: { id: video.id }, data: { metadata: { sourceType: 'creator-multipart-upload', processingState: 'dispatch_failed' } } }).catch(() => undefined);
      throw new HTTPException(503, { message: 'Source stored privately, but local processing could not be queued. Retry processing from the creator workspace.' });
    }
  });

  app.delete('/uploads/multipart/:id', async (c: any) => {
    const user = c.get('user');
    const workspaceId = await creatorWorkspaceForRequest(c, user);
    const video = await prisma.video.findUnique({ where: { id: c.req.param('id') }, select: { id: true, workspaceId: true, metadata: true, status: true } });
    if (!video) throw new HTTPException(404, { message: 'Creator upload session not found.' });
    requireSelectedSourceWorkspace(video.workspaceId, workspaceId);
    const session = multipartSession(video.metadata);
    if (!session || video.status !== 'uploading') throw new HTTPException(409, { message: 'This private upload can no longer be cancelled.' });
    try { await abortMultipartSourceUpload({ bucket: session.bucket, key: session.objectKey, uploadId: session.uploadId }); }
    catch { throw new HTTPException(503, { message: 'Private upload cancellation could not be confirmed. Refresh the source status before retrying.' }); }
    await prisma.video.delete({ where: { id: video.id } });
    return c.body(null, 204);
  });

  app.post('/upload', async (c: any) => {
    const user = c.get('user');
    const workspaceId = await creatorWorkspaceForRequest(c, user);
    const body = await c.req.parseBody();
    const candidate = body.file as { name?: string; type?: string; size?: number; arrayBuffer?: () => Promise<ArrayBuffer> } | undefined;
    if (!candidate || typeof candidate.arrayBuffer !== 'function') {
      throw new HTTPException(400, { message: 'A video file is required.' });
    }

    const name = candidate.name || 'source.mp4';
    const contentType = candidate.type || 'application/octet-stream';
    const extensionAllowed = /\.(mp4|mov|webm|m4v)$/i.test(name);
    const mimeAllowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'].includes(contentType);
    if (!extensionAllowed || (contentType !== 'application/octet-stream' && !mimeAllowed)) {
      throw new HTTPException(415, { message: 'Only MP4, MOV, WebM, and M4V creator source videos are accepted.' });
    }

    const maxBytes = Number(process.env.MAX_SOURCE_UPLOAD_BYTES || 524_288_000);
    if (typeof candidate.size === 'number' && candidate.size > maxBytes) {
      throw new HTTPException(413, { message: `Source video exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.` });
    }

    const buffer = Buffer.from(await candidate.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
      throw new HTTPException(413, { message: `Source video exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit or is empty.` });
    }

    const stored = await uploadSource({ workspaceId, originalFilename: name, contentType, body: buffer });
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : name.replace(/\.[^.]+$/, '');
    const video = await prisma.video.create({
      data: {
        workspaceId,
        uploadedBy: user.id,
        title,
        originalFilename: name,
        minioObjectKey: stored.key,
        minioBucket: stored.bucket,
        fileSizeBytes: BigInt(stored.sizeBytes),
        mimeType: contentType,
        status: 'uploading',
        metadata: { sourceType: 'creator-upload', processingState: 'queued', processingRequired: true },
      },
      select: { id: true, title: true, originalFilename: true, status: true, fileSizeBytes: true, createdAt: true },
    });

    try {
      const processing = await enqueueVideoProcessing(video.id);
      await prisma.video.update({ where: { id: video.id }, data: { metadata: { sourceType: 'creator-upload', processingState: 'queued', processingJobId: processing.jobId, processingQueuedAt: new Date().toISOString() } } });
      return c.json({
        data: { ...video, status: 'uploading', fileSizeBytes: video.fileSizeBytes?.toString() ?? null },
        processing,
        nextStep: 'processing_queued',
        message: 'Source stored privately in the creator workspace and queued for local processing. Live fingerprinting unlocks after processing reports ready.',
      }, 201);
    } catch (error) {
      await prisma.video.update({ where: { id: video.id }, data: { metadata: { sourceType: 'creator-upload', processingState: 'dispatch_failed', processingError: error instanceof Error ? error.message : 'Processing dispatch failed' } } }).catch(() => undefined);
      throw new HTTPException(503, { message: 'Source was stored privately, but local processing could not be queued. Retry from the creator workspace.' });
    }
  });

  app.get('/:id/processing-diagnostics', async (c: any) => {
    const user = c.get('user');
    const workspaceId = await workspaceForReadRequest(c, user);
    const id = c.req.param('id');
    const video = await prisma.video.findUnique({
      where: { id },
      select: { id: true, workspaceId: true, status: true, metadata: true, updatedAt: true },
    });
    if (!video) throw new HTTPException(404, { message: 'Video not found' });
    requireSelectedSourceWorkspace(video.workspaceId, workspaceId);
    return c.json({ data: { videoId: video.id, updatedAt: video.updatedAt.toISOString(), diagnostic: buildProcessingDiagnostic(video) } });
  });

  app.post('/:id/retry-processing', async (c: any) => {
    const user = c.get('user');
    const workspaceId = await creatorWorkspaceForRequest(c, user);
    const id = c.req.param('id');
    const video = await prisma.video.findUnique({
      where: { id },
      select: { id: true, workspaceId: true, status: true, metadata: true },
    });
    if (!video) throw new HTTPException(404, { message: 'Video not found' });
    requireSelectedSourceWorkspace(video.workspaceId, workspaceId);

    const diagnostic = buildProcessingDiagnostic(video);
    if (!diagnostic.retry.allowed) {
      throw new HTTPException(409, { message: diagnostic.retry.recommendedAction });
    }

    const metadata = video.metadata && typeof video.metadata === 'object' && !Array.isArray(video.metadata)
      ? video.metadata as Record<string, unknown>
      : {};
    try {
      const processing = await enqueueVideoProcessing(video.id);
      const retryCount = diagnostic.retry.manualRetryCount + 1;
      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: 'processing',
          metadata: {
            ...metadata,
            processingState: 'queued',
            processingJobId: processing.jobId,
            processingQueuedAt: new Date().toISOString(),
            manualRetryCount: retryCount,
            lastManualRetryAt: new Date().toISOString(),
            processingError: null,
          },
        },
      });
      return c.json({
        data: {
          videoId: video.id,
          processing,
          manualRetryCount: retryCount,
          nextStep: 'processing_requeued',
          safeguards: ['The original source remains unchanged. Review the new progress state before attempting another retry.'],
        },
      });
    } catch {
      throw new HTTPException(503, { message: 'Processing could not be requeued. Your source remains private and unchanged; retry after the processing service is available.' });
    }
  });

  app.get('/:id', async (c: any) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const workspaceId = await workspaceForReadRequest(c, user);
    const video = await prisma.video.findFirst({
      where: { id, workspaceId },
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
    
    return c.json(jsonSafe({ data: video }));
  });

  app.post('/', zValidator('json', videoSchema), async () => {
    throw new HTTPException(410, { message: 'Direct JSON video creation is retired. Upload creator-owned media through POST /api/v1/videos/upload so storage and processing are truthfully tracked.' });
    /*
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

    */
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

  app.post('/:id/publish', async () => {
    throw new HTTPException(410, { message: 'Legacy direct publishing is retired. Create a creator-approved publish intent through /api/v1/publishing before official connector delivery.' });
    /*
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

    */
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
        metadata: video.metadata as any,
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
