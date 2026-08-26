import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';

import type { Variables } from '../index.js';
import { prisma } from '../lib/prisma.js';
import {
  buildGrowthExperimentPlan,
  supportedGrowthPlatforms,
  type GrowthObjective,
  type GrowthPlatform,
} from '../lib/growth-plan.js';
import { requireCreatorWorkspaceAccess, requireWorkspaceAccess } from '../lib/pilot-access.js';
import { evaluateLearningSignal } from '../lib/growth-learning.js';
import { assessCreatorWorkflowReadiness } from '../lib/reliability.js';
import { buildExperimentScorecard } from '../lib/experiment-scorecard.js';
import { buildReachPlan } from '../lib/reach-plan.js';
import { metricFreshness } from '../lib/metric-ingestion.js';
import { enqueueVariantRendering } from '../lib/processing-dispatch.js';
import {
  adaptationRecipeSchema,
  applyManualAdaptationEdit,
  createAutomaticAdaptationRecipe,
  manualAdaptationEditSchema,
  parseAdaptationRecipe,
} from '../lib/adaptation-recipe.js';

const sourceSchema = z.object({
  videoId: z.string().uuid(),
});

const planSchema = sourceSchema.extend({
  platforms: z.array(z.enum(supportedGrowthPlatforms)).min(1).max(supportedGrowthPlatforms.length),
  objective: z.enum(['views', 'engagement', 'followers', 'retention']).default('retention'),
});

const learningQuerySchema = z.object({
  objective: z.enum(['views', 'engagement', 'followers', 'retention']).default('retention'),
});

function videoFingerprint(video: {
  title: string | null;
  description: string | null;
  durationSeconds: number | null;
  transcript: string | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
}) {
  const transcriptWords = video.transcript?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  const vertical = (video.height ?? 0) > (video.width ?? 0);
  const duration = video.durationSeconds ?? 0;

  return {
    source: {
      title: video.title ?? 'Untitled source video',
      description: video.description,
      durationSeconds: video.durationSeconds,
      orientation: vertical ? 'vertical' : 'landscape_or_square',
      transcriptWords,
      receivedAt: video.createdAt,
    },
    durableSignals: [
      {
        label: 'Format fit',
        value: vertical ? 'Vertical source is ready for short-form adaptation' : 'Source can be reframed for vertical short-form adaptation',
        evidence: vertical ? 'The original already uses a vertical frame.' : 'The system should select a vertical-safe crop before creating variants.',
      },
      {
        label: 'Source density',
        value: transcriptWords > 75 ? 'Multiple spoken proof points available' : 'Concise source with room for a sharper opening',
        evidence: transcriptWords > 75 ? `${transcriptWords} transcript words provide several candidate proof beats.` : 'The first adaptation should preserve the clearest original claim.',
      },
      {
        label: 'Run-time strategy',
        value: duration > 60 ? 'Prioritize one focused excerpt per experiment' : 'Preserve the core narrative as a concise test',
        evidence: duration > 60 ? 'Longer sources benefit from selective proof extraction.' : 'The source is already compact enough for short-form testing.',
      },
    ],
    guardrails: [
      'This fingerprint identifies testable creative signals; it does not predict or guarantee virality.',
      'Only the creator workspace may prepare experiments from this source asset.',
      'Each generated plan remains linked to the source video for auditability.',
    ],
  };
}

export function createGrowthRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.post('/source-fingerprint', zValidator('json', sourceSchema), async (c: any) => {
    const actor = c.get('user');
    const input = c.req.valid('json');

    const video = await prisma.video.findUnique({
      where: { id: input.videoId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        description: true,
        durationSeconds: true,
        transcript: true,
        width: true,
        height: true,
        createdAt: true,
      },
    });

    if (!video) {
      throw new HTTPException(404, { message: 'Source video not found' });
    }

    await requireWorkspaceAccess(actor, video.workspaceId);

    return c.json({
      data: {
        videoId: video.id,
        ...videoFingerprint(video),
      },
    });
  });

  app.post('/experiment-plan', zValidator('json', planSchema), async (c: any) => {
    const actor = c.get('user');
    const input = c.req.valid('json');

    const video = await prisma.video.findUnique({
      where: { id: input.videoId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        transcript: true,
        durationSeconds: true,
        status: true,
      },
    });

    if (!video) {
      throw new HTTPException(404, { message: 'Source video not found' });
    }

    await requireWorkspaceAccess(actor, video.workspaceId);

    if (video.status !== 'ready') {
      throw new HTTPException(409, { message: 'Source video must finish processing before experiments can be prepared' });
    }

    const accounts = await prisma.socialAccount.findMany({
      where: {
        workspaceId: video.workspaceId,
        platform: { in: input.platforms },
        isActive: true,
      },
      select: { id: true, platform: true, username: true, displayName: true },
    });

    const connectedPlatforms = new Set(accounts.map((account) => account.platform));
    const requestedPlatforms = input.platforms as GrowthPlatform[];
    const missingPlatforms = requestedPlatforms.filter((platform: GrowthPlatform) => !connectedPlatforms.has(platform));
    const experiments = buildGrowthExperimentPlan({
      sourceTitle: video.title,
      transcript: video.transcript,
      platforms: requestedPlatforms,
      objective: input.objective as GrowthObjective,
    });
    const persistedVariants = await prisma.$transaction(async (tx) => Promise.all(experiments.map(async (experiment) => {
      const planKey = `${video.id}:${experiment.platform}:${input.objective}`;
      const candidates = await tx.videoVariant.findMany({ where: { videoId: video.id, platform: experiment.platform }, orderBy: { createdAt: 'desc' }, select: { id: true, generationParams: true, status: true, minioObjectKey: true } });
      const existingPlanned = candidates.find((candidate) => (candidate.generationParams as { planKey?: string } | null)?.planKey === planKey);
      const existingRendered = candidates.find((candidate) => candidate.status === 'ready' && candidate.minioObjectKey);
      const existing = existingPlanned || existingRendered;
      if (existing) {
        const priorParams = (existing.generationParams as Record<string, unknown> | null) ?? {};
        const adaptationRecipe = parseAdaptationRecipe(priorParams.adaptationRecipe) ?? createAutomaticAdaptationRecipe({
          platform: experiment.platform,
          sourceVideoId: video.id,
          durationSeconds: video.durationSeconds,
          headline: experiment.hook,
        });
        return tx.videoVariant.update({ where: { id: existing.id }, data: { variantType: experiment.variantType, hookText: experiment.hook, caption: experiment.caption, aspectRatio: experiment.aspectRatio, generationParams: { ...priorParams, planKey, objective: input.objective, sourceVideoId: video.id, adaptationRecipe, renderingBoundary: existing.status === 'ready' ? 'processor_variant_ready' : 'processor_variant_render_required' } }, select: { id: true, status: true } });
      }
      const adaptationRecipe = createAutomaticAdaptationRecipe({
        platform: experiment.platform,
        sourceVideoId: video.id,
        durationSeconds: video.durationSeconds,
        headline: experiment.hook,
      });
      return tx.videoVariant.create({ data: { videoId: video.id, variantType: experiment.variantType, aspectRatio: experiment.aspectRatio, hookText: experiment.hook, caption: experiment.caption, platform: experiment.platform, status: 'pending', generationParams: { planKey, objective: input.objective, sourceVideoId: video.id, adaptationRecipe, renderingBoundary: 'processor_variant_render_required' } }, select: { id: true, status: true } });
    })));
    const experimentsWithVariants = experiments.map((experiment, index) => {
      const destination = accounts.find((account) => account.platform === experiment.platform) ?? null;
      const variant = persistedVariants[index];
      return { ...experiment, variantId: variant.id, destination, availability: !connectedPlatforms.has(experiment.platform) ? 'account_connection_required' : variant.status === 'ready' ? 'ready_for_creator_approval' : 'variant_rendering_required' };
    });

    return c.json({
      data: {
        sourceVideoId: video.id,
        objective: input.objective,
        experiments: experimentsWithVariants,
        missingPlatforms,
        nextStep: missingPlatforms.length > 0
          ? 'Connect the missing accounts and wait for variant rendering before approving those experiments.'
          : 'Review the planned experiments. Variants must finish rendering before explicit creator approval can prepare them for publishing.',
        safeguards: [
          'The system prepares creator-specific hypotheses and does not guarantee reach, virality, or platform placement.',
          'No experiment is scheduled or published by this endpoint.',
          'Approved publishing requires a rendered variant, separate creator action, and active connected account.',
          'Planning creates a pending variant record; it does not claim that media rendering has completed.',
        ],
      },
    });
  });

  app.get('/adaptations/:variantId', async (c: any) => {
    const actor = c.get('user');
    const variantId = c.req.param('variantId');
    const variant = await prisma.videoVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        platform: true,
        status: true,
        minioObjectKey: true,
        thumbnailObjectKey: true,
        completedAt: true,
        errorMessage: true,
        generationParams: true,
        video: { select: { id: true, workspaceId: true, durationSeconds: true } },
      },
    });
    if (!variant) throw new HTTPException(404, { message: 'Adaptation variant not found' });
    await requireWorkspaceAccess(actor, variant.video.workspaceId);

    const params = (variant.generationParams as Record<string, unknown> | null) ?? {};
    const recipe = adaptationRecipeSchema.parse(
      parseAdaptationRecipe(params.adaptationRecipe) ?? createAutomaticAdaptationRecipe({
        platform: variant.platform as GrowthPlatform,
        sourceVideoId: variant.video.id,
        durationSeconds: variant.video.durationSeconds,
      })
    );

    return c.json({
      data: {
        variantId: variant.id,
        platform: variant.platform,
        status: variant.status,
        recipe,
        artifact: variant.minioObjectKey
          ? {
            objectKey: variant.minioObjectKey,
            thumbnailObjectKey: variant.thumbnailObjectKey,
            completedAt: variant.completedAt,
            state: variant.status === 'ready' ? 'current_recipe_rendered' : 'previous_recipe_artifact_available',
          }
          : null,
        renderState: params.renderingBoundary ?? 'processor_variant_render_required',
        errorMessage: variant.errorMessage,
        safeguards: [
          'The original source remains unchanged; edits are stored as a non-destructive recipe.',
          'A saved recipe is not a rendered artifact until the processor completes a new render.',
          'The developer oversight role can view creator artifacts but cannot modify this recipe.',
        ],
      },
    });
  });

  app.put('/adaptations/:variantId', zValidator('json', manualAdaptationEditSchema), async (c: any) => {
    const actor = c.get('user');
    const variantId = c.req.param('variantId');
    const edit = c.req.valid('json');
    const variant = await prisma.videoVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        platform: true,
        caption: true,
        minioObjectKey: true,
        generationParams: true,
        video: { select: { id: true, workspaceId: true, durationSeconds: true } },
      },
    });
    if (!variant) throw new HTTPException(404, { message: 'Adaptation variant not found' });
    await requireCreatorWorkspaceAccess(actor, variant.video.workspaceId);

    const priorParams = (variant.generationParams as Record<string, unknown> | null) ?? {};
    const existingRecipe = parseAdaptationRecipe(priorParams.adaptationRecipe) ?? createAutomaticAdaptationRecipe({
      platform: variant.platform as GrowthPlatform,
      sourceVideoId: variant.video.id,
      durationSeconds: variant.video.durationSeconds,
      headline: variant.caption,
    });

    let recipe;
    try {
      recipe = applyManualAdaptationEdit(existingRecipe, edit);
    } catch (error) {
      throw new HTTPException(422, { message: error instanceof Error ? error.message : 'The requested media edit is invalid' });
    }
    if (variant.video.durationSeconds !== null && recipe.sourceRange.endSeconds > variant.video.durationSeconds) {
      throw new HTTPException(422, { message: 'The selected clip range exceeds the source media duration' });
    }

    const updated = await prisma.videoVariant.update({
      where: { id: variant.id },
      data: {
        status: 'pending',
        completedAt: null,
        errorMessage: null,
        caption: recipe.headline ?? variant.caption,
        generationParams: {
          ...priorParams,
          adaptationRecipe: recipe,
          previousArtifactObjectKey: variant.minioObjectKey,
          renderingBoundary: 'creator_recipe_render_required',
          lastEditedBy: actor.id,
          lastEditedAt: new Date().toISOString(),
        },
      },
      select: { id: true, status: true, generationParams: true },
    });

    let renderJob;
    try {
      renderJob = await enqueueVariantRendering(updated.id, recipe.provenance.revision);
    } catch (error) {
      await prisma.videoVariant.update({
        where: { id: updated.id },
        data: {
          status: 'failed',
          errorMessage: 'The edit was saved, but the rendering job could not be queued. Retry after the processing service is available.',
          generationParams: {
            ...((updated.generationParams as Record<string, unknown> | null) ?? {}),
            renderingBoundary: 'creator_recipe_render_dispatch_failed',
            renderDispatchFailedAt: new Date().toISOString(),
          },
        },
      });
      throw new HTTPException(503, { message: 'The edit was saved but rendering is temporarily unavailable. Retry when the processing service is available.' });
    }

    return c.json({
      data: {
        variantId: updated.id,
        status: updated.status,
        recipe,
        renderState: 'creator_recipe_render_queued',
        renderJob,
        nextStep: 'The non-destructive edit is saved and queued for rendering. Review the updated artifact after the processor reports it ready, then decide whether to approve it for publishing.',
      },
    });
  });

  app.post('/reach-plan', zValidator('json', planSchema), async (c: any) => {
    const actor = c.get('user');
    const input = c.req.valid('json');
    const video = await prisma.video.findUnique({
      where: { id: input.videoId },
      select: { id: true, workspaceId: true, title: true, status: true },
    });
    if (!video) throw new HTTPException(404, { message: 'Source video not found' });
    await requireWorkspaceAccess(actor, video.workspaceId);
    if (video.status !== 'ready') throw new HTTPException(409, { message: 'Source video must finish processing before a reach plan can be prepared' });
    const activeDestinations = await prisma.socialAccount.count({ where: { workspaceId: video.workspaceId, platform: { in: input.platforms }, isActive: true } });
    return c.json({ data: buildReachPlan({ sourceTitle: video.title, platforms: input.platforms as ('tiktok' | 'instagram' | 'youtube')[], objective: input.objective as GrowthObjective, activeDestinations }) });
  });

  app.get('/readiness/:videoId', async (c: any) => {
    const actor = c.get('user');
    const videoId = c.req.param('videoId');

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, workspaceId: true, status: true },
    });

    if (!video) {
      throw new HTTPException(404, { message: 'Source video not found' });
    }

    await requireWorkspaceAccess(actor, video.workspaceId);

    const [connectedDestinations, variants] = await Promise.all([
      prisma.socialAccount.count({ where: { workspaceId: video.workspaceId, isActive: true } }),
      prisma.videoVariant.findMany({
        where: { videoId: video.id },
        select: {
          status: true,
          scheduledPosts: { select: { status: true, retryCount: true, errorMessage: true } },
        },
      }),
    ]);

    const readiness = assessCreatorWorkflowReadiness({
      sourceStatus: video.status,
      connectedDestinations,
      preparedVariants: variants.filter((variant) => variant.status === 'ready').length,
      failedVariants: variants.filter((variant) => variant.status === 'failed').length,
      scheduledPosts: variants.flatMap((variant) => variant.scheduledPosts),
    });

    return c.json({ data: { sourceVideoId: video.id, ...readiness } });
  });

  app.get('/learning-signal/:videoId', zValidator('query', learningQuerySchema), async (c: any) => {
    const actor = c.get('user');
    const videoId = c.req.param('videoId');
    const query = c.req.valid('query');

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, workspaceId: true },
    });

    if (!video) {
      throw new HTTPException(404, { message: 'Source video not found' });
    }

    await requireWorkspaceAccess(actor, video.workspaceId);

    const variants = await prisma.videoVariant.findMany({
      where: { videoId: video.id },
      select: {
        id: true,
        metrics: {
          select: {
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
            followerGain: true,
            completionRate: true,
          },
        },
      },
    });

    const variantIds = variants.map((variant) => variant.id);
    const baselineMetrics = await prisma.postMetric.findMany({
      where: {
        workspaceId: video.workspaceId,
        ...(variantIds.length > 0 ? { variantId: { notIn: variantIds } } : {}),
      },
      select: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        followerGain: true,
        completionRate: true,
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });

    const experimentMetrics = variants.flatMap((variant) => variant.metrics);
    const learning = evaluateLearningSignal({
      objective: query.objective as GrowthObjective,
      experiment: experimentMetrics,
      baseline: baselineMetrics,
    });

    return c.json({
      data: {
        sourceVideoId: video.id,
        ...learning,
      },
    });
  });

  app.get('/scorecard/:videoId', zValidator('query', learningQuerySchema), async (c: any) => {
    const actor = c.get('user');
    const videoId = c.req.param('videoId');
    const query = c.req.valid('query');
    const video = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true, workspaceId: true } });
    if (!video) throw new HTTPException(404, { message: 'Source video not found' });
    await requireWorkspaceAccess(actor, video.workspaceId);

    const variants = await prisma.videoVariant.findMany({
      where: { videoId: video.id },
      select: {
        id: true,
        platform: true,
        metrics: { select: { scheduledPostId: true, variantId: true, platform: true, recordedAt: true, importedAt: true, provenance: true, views: true, likes: true, comments: true, shares: true, saves: true, followerGain: true, completionRate: true } },
      },
    });
    const variantIds = variants.map((variant) => variant.id);
    const baseline = await prisma.postMetric.findMany({
      where: { workspaceId: video.workspaceId, ...(variantIds.length ? { variantId: { notIn: variantIds } } : {}) },
      select: { scheduledPostId: true, variantId: true, platform: true, recordedAt: true, views: true, likes: true, comments: true, shares: true, saves: true, followerGain: true, completionRate: true },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    const latestMetricByPost = new Map<string, { scheduledPostId: string; platform: string; recordedAt: Date; importedAt: Date | null; provenance: unknown }>();
    for (const metric of variants.flatMap((variant) => variant.metrics)) {
      const current = latestMetricByPost.get(metric.scheduledPostId);
      if (!current || metric.recordedAt > current.recordedAt) latestMetricByPost.set(metric.scheduledPostId, metric);
    }
    const metricFreshnessSummary = [...latestMetricByPost.values()].map((metric) => ({
      scheduledPostId: metric.scheduledPostId,
      platform: metric.platform,
      observedAt: metric.recordedAt,
      importedAt: metric.importedAt,
      provenance: metric.provenance,
      ...metricFreshness(metric.recordedAt, metric.importedAt ?? metric.recordedAt),
    }));
    const freshnessCounts: Record<'fresh' | 'aging' | 'stale', number> = { fresh: 0, aging: 0, stale: 0 };
    for (const metric of metricFreshnessSummary) freshnessCounts[metric.state as 'fresh' | 'aging' | 'stale'] += 1;
    return c.json({ data: { sourceVideoId: video.id, ...buildExperimentScorecard({ objective: query.objective as 'views' | 'engagement' | 'followers' | 'retention', variants, baseline }), metricFreshness: { observations: metricFreshnessSummary, counts: freshnessCounts } } });
  });

  return app;
}
