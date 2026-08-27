import { z } from 'zod';

import { supportedGrowthPlatforms, type GrowthPlatform } from './growth-plan.js';

export const recipePlatforms = supportedGrowthPlatforms;

const compositionModes = ['fit', 'crop', 'blur_bg', 'smart_crop', 'smart_fill'] as const;
const captionStyles = ['off', 'clean', 'high_contrast'] as const;
const headlinePlacements = ['upper_safe', 'center_safe', 'lower_safe'] as const;
const selectionMethods = ['full_source', 'source_start_fallback', 'scene_candidate', 'transcript_candidate', 'creator_custom'] as const;

const platformOutputDefaults: Record<GrowthPlatform, { aspectRatio: string; width: number; height: number; fps: number; maxDurationSeconds: number; preferredClipSeconds: number }> = {
  tiktok: { aspectRatio: '9:16', width: 1080, height: 1920, fps: 30, maxDurationSeconds: 180, preferredClipSeconds: 45 },
  instagram: { aspectRatio: '9:16', width: 1080, height: 1920, fps: 30, maxDurationSeconds: 90, preferredClipSeconds: 45 },
  youtube: { aspectRatio: '9:16', width: 1080, height: 1920, fps: 30, maxDurationSeconds: 60, preferredClipSeconds: 45 },
  facebook: { aspectRatio: '9:16', width: 1080, height: 1920, fps: 30, maxDurationSeconds: 90, preferredClipSeconds: 45 },
  x: { aspectRatio: '16:9', width: 1280, height: 720, fps: 30, maxDurationSeconds: 140, preferredClipSeconds: 45 },
  linkedin: { aspectRatio: '1:1', width: 1080, height: 1080, fps: 30, maxDurationSeconds: 600, preferredClipSeconds: 60 },
};

export const adaptationRecipeSchema = z.object({
  version: z.literal(1),
  platform: z.enum(recipePlatforms),
  mode: z.enum(['automatic', 'manual']),
  sourceRange: z.object({
    startSeconds: z.number().finite().min(0),
    endSeconds: z.number().finite().positive(),
    selectionMethod: z.enum(selectionMethods),
    rationale: z.string().min(1).max(280),
  }).refine((range) => range.endSeconds > range.startSeconds, {
    message: 'The end of a clip must be after its start.',
    path: ['endSeconds'],
  }),
  composition: z.object({
    mode: z.enum(compositionModes),
    focalPoint: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    }).optional(),
    showSafeZones: z.boolean(),
  }),
  captions: z.object({
    enabled: z.boolean(),
    style: z.enum(captionStyles),
  }),
  headline: z.string().max(140).nullable(),
  headlinePlacement: z.enum(headlinePlacements).default('upper_safe'),
  audio: z.object({
    normalize: z.boolean(),
  }),
  output: z.object({
    aspectRatio: z.string().regex(/^\d+:\d+$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().min(23).max(60),
    maxDurationSeconds: z.number().positive(),
  }),
  provenance: z.object({
    sourceVideoId: z.string().uuid(),
    generatedAt: z.string().datetime(),
    revision: z.number().int().positive(),
  }),
}).strict();

export type AdaptationRecipe = z.infer<typeof adaptationRecipeSchema>;

export const manualAdaptationEditSchema = z.object({
  sourceRange: z.object({
    startSeconds: z.number().finite().min(0),
    endSeconds: z.number().finite().positive(),
  }).refine((range) => range.endSeconds > range.startSeconds, {
    message: 'The end of a clip must be after its start.',
    path: ['endSeconds'],
  }).optional(),
  clipCandidateId: z.string().min(1).max(180).optional(),
  composition: z.object({
    mode: z.enum(compositionModes),
    focalPoint: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    }).optional(),
    showSafeZones: z.boolean(),
  }).optional(),
  captions: z.object({
    enabled: z.boolean(),
    style: z.enum(captionStyles),
  }).optional(),
  headline: z.string().max(140).nullable().optional(),
  headlinePlacement: z.enum(headlinePlacements).optional(),
  audio: z.object({
    normalize: z.boolean(),
  }).optional(),
}).strict().refine((edit) => Object.keys(edit).length > 0, {
  message: 'Provide at least one editable adaptation setting.',
});

export type ManualAdaptationEdit = z.infer<typeof manualAdaptationEditSchema>;

export function outputDefaultsForPlatform(platform: GrowthPlatform) {
  return platformOutputDefaults[platform];
}

export function createAutomaticAdaptationRecipe(input: {
  platform: GrowthPlatform;
  sourceVideoId: string;
  durationSeconds: number | null;
  headline?: string | null;
  revision?: number;
}): AdaptationRecipe {
  const output = outputDefaultsForPlatform(input.platform);
  const sourceDuration = Math.max(0, input.durationSeconds ?? 0);
  const selectedDuration = sourceDuration > 0
    ? Math.min(sourceDuration, output.preferredClipSeconds, output.maxDurationSeconds)
    : Math.min(output.preferredClipSeconds, output.maxDurationSeconds);
  const usesFullSource = sourceDuration > 0 && sourceDuration <= output.preferredClipSeconds;

  return adaptationRecipeSchema.parse({
    version: 1,
    platform: input.platform,
    mode: 'automatic',
    sourceRange: {
      startSeconds: 0,
      endSeconds: selectedDuration,
      selectionMethod: usesFullSource ? 'full_source' : 'source_start_fallback',
      rationale: usesFullSource
        ? 'The source fits the initial platform-native clip target, so the automatic draft preserves the full source.'
        : 'This transparent fallback starts at the original opening while timed scene or transcript candidates are unavailable. Review or refine the clip before rendering.',
    },
    composition: {
      mode: 'smart_crop',
      showSafeZones: true,
    },
    captions: {
      enabled: true,
      style: 'clean',
    },
    headline: input.headline ?? null,
    headlinePlacement: 'upper_safe',
    audio: {
      normalize: true,
    },
    output,
    provenance: {
      sourceVideoId: input.sourceVideoId,
      generatedAt: new Date().toISOString(),
      revision: input.revision ?? 1,
    },
  });
}

export function applyManualAdaptationEdit(existing: AdaptationRecipe, edit: ManualAdaptationEdit): AdaptationRecipe {
  const next = adaptationRecipeSchema.parse({
    ...existing,
    mode: 'manual',
    sourceRange: edit.sourceRange
      ? {
        ...existing.sourceRange,
        ...edit.sourceRange,
        selectionMethod: edit.clipCandidateId ? 'scene_candidate' : 'creator_custom',
        rationale: edit.clipCandidateId
          ? 'Creator selected a processor-backed scene-aware clip candidate.'
          : 'Creator-selected clip range.',
      }
      : existing.sourceRange,
    composition: edit.composition ? { ...existing.composition, ...edit.composition } : existing.composition,
    captions: edit.captions ? { ...existing.captions, ...edit.captions } : existing.captions,
    headline: edit.headline === undefined ? existing.headline : edit.headline,
    headlinePlacement: edit.headlinePlacement ?? existing.headlinePlacement,
    audio: edit.audio ? { ...existing.audio, ...edit.audio } : existing.audio,
    provenance: {
      ...existing.provenance,
      generatedAt: new Date().toISOString(),
      revision: existing.provenance.revision + 1,
    },
  });

  if (next.sourceRange.endSeconds > next.output.maxDurationSeconds + next.sourceRange.startSeconds) {
    throw new Error(`The selected clip exceeds the ${next.output.maxDurationSeconds}-second platform recipe limit.`);
  }

  return next;
}

export function parseAdaptationRecipe(value: unknown): AdaptationRecipe | null {
  const parsed = adaptationRecipeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
