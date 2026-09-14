import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import type { Variables } from '../index.js';
import { assertPublishingAllowed, requireWorkspaceAccess } from '../lib/pilot-access.js';
import { createAttemptIdempotencyKey, validateCreatorApproval } from '../lib/publishing-lifecycle.js';

const createIntentSchema = z.object({
  videoId: z.string().uuid(),
  variantId: z.string().uuid(),
  socialAccountId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  idempotencyKey: z.string().min(16).max(180),
});

const intentListQuerySchema = z.object({
  status: z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function requireCreatorWorkflowControl(access: { oversight: boolean; role: string }) {
  if (access.oversight) {
    throw new HTTPException(403, { message: 'Platform oversight is read-only. Creator content approval and scheduling remain creator-controlled.' });
  }

  if (!['owner', 'admin', 'editor', 'creator'].includes(access.role)) {
    throw new HTTPException(403, { message: 'Creator workflow control requires a workspace owner, admin, editor, or creator role.' });
  }
}

export function createPublishingRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/intents', zValidator('query', intentListQuerySchema), async (c: any) => {
    const actor = c.get('user');
    const query = c.req.valid('query');
    const access = await requireWorkspaceAccess(actor, actor.workspaceId);
    const intents = await prisma.scheduledPost.findMany({
      where: { workspaceId: access.workspaceId, ...(query.status ? { status: query.status } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: query.limit,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        postedAt: true,
        creatorApprovedAt: true,
        retryCount: true,
        nextAttemptAt: true,
        deadLetteredAt: true,
        errorMessage: true,
        variant: { select: { id: true, platform: true, videoId: true } },
        socialAccount: { select: { id: true, platform: true, username: true, displayName: true, isActive: true } },
        publishingAttempts: { orderBy: { requestedAt: 'desc' }, take: 3, select: { attemptNumber: true, status: true, requestedAt: true, completedAt: true, errorMessage: true } },
      },
    });
    return c.json({ data: intents, safeguards: ['Delivery history is workspace-scoped and read-only for this endpoint.', 'Platform results and organic reach remain external and are not guaranteed.'] });
  });

  app.post('/intents', zValidator('json', createIntentSchema), async (c: any) => {
    const actor = c.get('user');
    const body = c.req.valid('json');
    const scheduledAt = new Date(body.scheduledAt);

    if (scheduledAt <= new Date()) {
      throw new HTTPException(400, { message: 'The planned publish window must be in the future.' });
    }

    const [video, variant, socialAccount] = await Promise.all([
      prisma.video.findUnique({ where: { id: body.videoId }, select: { id: true, workspaceId: true, status: true } }),
      prisma.videoVariant.findUnique({ where: { id: body.variantId }, select: { id: true, videoId: true, status: true, platform: true } }),
      prisma.socialAccount.findUnique({ where: { id: body.socialAccountId }, select: { id: true, workspaceId: true, platform: true, isActive: true } }),
    ]);

    if (!video || !variant || !socialAccount || variant.videoId !== video.id || socialAccount.workspaceId !== video.workspaceId || socialAccount.platform !== variant.platform) {
      throw new HTTPException(409, { message: 'The source, version, and creator-owned destination must belong to the same compatible workspace.' });
    }

    const access = await requireWorkspaceAccess(actor, video.workspaceId);
    requireCreatorWorkflowControl(access);

    const existing = await prisma.scheduledPost.findFirst({
      where: { workspaceId: video.workspaceId, idempotencyKey: body.idempotencyKey },
      select: { id: true, status: true, scheduledAt: true, creatorApprovedAt: true },
    });
    if (existing) {
      return c.json({ data: existing, idempotent: true, message: 'The creator intent already exists for this idempotency key.' }, 200);
    }

    const post = await prisma.$transaction(async (tx: any) => {
      const created = await tx.scheduledPost.create({
        data: {
          workspaceId: video.workspaceId,
          variantId: variant.id,
          socialAccountId: socialAccount.id,
          scheduledAt,
          idempotencyKey: body.idempotencyKey,
          status: 'draft',
          metadata: { sourceVideoId: video.id, creatorInitiated: true, executionBoundary: 'official_creator_authorized_connection_required' },
        },
        select: { id: true, status: true, scheduledAt: true, creatorApprovedAt: true, idempotencyKey: true },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: video.workspaceId,
          userId: actor.id,
          action: 'creator_publish_intent_created',
          resourceType: 'scheduled_post',
          resourceId: created.id,
          oldValues: {},
          newValues: { status: created.status, scheduledAt: created.scheduledAt.toISOString(), idempotencyKey: created.idempotencyKey },
        },
      });
      return created;
    });

    return c.json({ data: post, idempotent: false, message: 'Draft creator publish intent created. Explicit creator approval is still required.' }, 201);
  });

  app.post('/intents/:postId/approve', async (c: any) => {
    const actor = c.get('user');
    const postId = c.req.param('postId');
    const post = await prisma.scheduledPost.findUnique({
      where: { id: postId },
      include: {
        workspace: { select: { id: true } },
        variant: { include: { video: { select: { status: true } } } },
        socialAccount: { select: { isActive: true } },
      },
    });

    if (!post) {
      throw new HTTPException(404, { message: 'Creator publish intent not found.' });
    }

    const access = await requireWorkspaceAccess(actor, post.workspaceId);
    requireCreatorWorkflowControl(access);
    await assertPublishingAllowed(post.workspaceId);

    const approval = validateCreatorApproval({
      postStatus: post.status,
      sourceReady: post.variant.video.status === 'ready',
      variantReady: post.variant.status === 'ready',
      destinationActive: post.socialAccount.isActive,
    });
    if (!approval.approved) {
      return c.json({ success: false, message: 'The draft cannot be approved yet.', reasons: approval.reasons, safeguards: approval.safeguards }, 409);
    }

    const approvedAt = new Date();
    const result = await prisma.$transaction(async (tx: any) => {
      const approved = await tx.scheduledPost.update({
        where: { id: post.id },
        data: { status: 'scheduled', creatorApprovedAt: approvedAt, creatorApprovedBy: actor.id, nextAttemptAt: post.scheduledAt },
        select: { id: true, status: true, scheduledAt: true, creatorApprovedAt: true, idempotencyKey: true, nextAttemptAt: true },
      });
      await tx.publishingAttempt.create({
        data: {
          scheduledPostId: post.id,
          workspaceId: post.workspaceId,
          idempotencyKey: createAttemptIdempotencyKey(post.idempotencyKey ?? post.id, 0),
          attemptNumber: 0,
          status: 'queued',
          nextAttemptAt: post.scheduledAt,
          metadata: { trigger: 'creator_approval', approvedBy: actor.id },
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: post.workspaceId,
          userId: actor.id,
          action: 'creator_publish_intent_approved',
          resourceType: 'scheduled_post',
          resourceId: post.id,
          oldValues: { status: post.status },
          newValues: { status: 'scheduled', approvedAt: approvedAt.toISOString(), scheduledAt: post.scheduledAt.toISOString() },
        },
      });
      return approved;
    });

    return c.json({ data: result, safeguards: approval.safeguards, message: 'Creator approval recorded and an idempotent queue record created. No unauthorised platform publishing is performed by this API.' });
  });

  app.get('/intents/:postId', async (c: any) => {
    const actor = c.get('user');
    const post = await prisma.scheduledPost.findUnique({
      where: { id: c.req.param('postId') },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        scheduledAt: true,
        postedAt: true,
        creatorApprovedAt: true,
        creatorApprovedBy: true,
        retryCount: true,
        lastAttemptAt: true,
        nextAttemptAt: true,
        deadLetteredAt: true,
        errorMessage: true,
        publishingAttempts: { orderBy: { requestedAt: 'desc' }, select: { attemptNumber: true, status: true, requestedAt: true, startedAt: true, completedAt: true, nextAttemptAt: true, responseStatus: true, errorCode: true, errorMessage: true } },
      },
    });
    if (!post) {
      throw new HTTPException(404, { message: 'Creator publish intent not found.' });
    }
    await requireWorkspaceAccess(actor, post.workspaceId);
    return c.json({ data: post, safeguards: ['Operational history is evidence for recovery, not a guarantee of publishing or organic distribution.'] });
  });

  return app;
}
