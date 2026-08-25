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
import { requireWorkspaceAccess } from '../lib/pilot-access.js';

const sourceSchema = z.object({
  videoId: z.string().uuid(),
});

const planSchema = sourceSchema.extend({
  platforms: z.array(z.enum(supportedGrowthPlatforms)).min(1).max(supportedGrowthPlatforms.length),
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
      select: { platform: true, username: true, displayName: true },
    });

    const connectedPlatforms = new Set(accounts.map((account) => account.platform));
    const requestedPlatforms = input.platforms as GrowthPlatform[];
    const missingPlatforms = requestedPlatforms.filter((platform: GrowthPlatform) => !connectedPlatforms.has(platform));
    const experiments = buildGrowthExperimentPlan({
      sourceTitle: video.title,
      transcript: video.transcript,
      platforms: requestedPlatforms,
      objective: input.objective as GrowthObjective,
    }).map((experiment) => ({
      ...experiment,
      destination: accounts.find((account) => account.platform === experiment.platform) ?? null,
      availability: connectedPlatforms.has(experiment.platform) ? 'ready_for_creator_approval' : 'account_connection_required',
    }));

    return c.json({
      data: {
        sourceVideoId: video.id,
        objective: input.objective,
        experiments,
        missingPlatforms,
        nextStep: missingPlatforms.length > 0
          ? 'Connect the missing accounts before approving those experiments.'
          : 'Review the planned experiments, then explicitly approve the versions you want prepared for publishing.',
        safeguards: [
          'The system prepares creator-specific hypotheses and does not guarantee reach, virality, or platform placement.',
          'No experiment is scheduled or published by this endpoint.',
          'Approved publishing requires a separate creator action and active connected account.',
        ],
      },
    });
  });

  return app;
}
