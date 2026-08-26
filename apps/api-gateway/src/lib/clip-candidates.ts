import { z } from 'zod';

const sceneSchema = z.object({
  scene_number: z.number().int().positive().optional(),
  start_time: z.number().finite().min(0),
  end_time: z.number().finite().positive(),
  duration: z.number().finite().positive().optional(),
}).refine((scene) => scene.end_time > scene.start_time);

const captionSchema = z.object({
  start: z.number().finite().min(0),
  end: z.number().finite().positive(),
  text: z.string().min(1).optional(),
}).refine((caption) => caption.end > caption.start);

export type ClipCandidate = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  source: 'scene_detection' | 'opening_fallback';
  sceneNumbers: number[];
  captionCueCount: number;
  rationale: string;
  safeguards: string[];
};

function roundSeconds(value: number) {
  return Math.round(value * 10) / 10;
}

function parseScenes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((scene) => sceneSchema.safeParse(scene))
    .filter((parsed): parsed is { success: true; data: z.infer<typeof sceneSchema> } => parsed.success)
    .map((parsed) => parsed.data)
    .sort((left, right) => left.start_time - right.start_time);
}

function parseCaptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((caption) => captionSchema.safeParse(caption))
    .filter((parsed): parsed is { success: true; data: z.infer<typeof captionSchema> } => parsed.success)
    .map((parsed) => parsed.data);
}

function uniqueAnchors(scenes: z.infer<typeof sceneSchema>[], durationSeconds: number) {
  if (scenes.length === 0) return [];
  const preferredIndexes = [...new Set([0, Math.floor((scenes.length - 1) / 2), scenes.length - 1])];
  return preferredIndexes
    .map((index) => scenes[index])
    .filter((scene) => scene && scene.start_time < durationSeconds)
    .filter((scene, index, all) => all.findIndex((other) => other.start_time === scene.start_time) === index);
}

export function createClipCandidates(input: {
  durationSeconds: number | null | undefined;
  preferredDurationSeconds: number;
  scenes?: unknown;
  captions?: unknown;
  limit?: number;
}): ClipCandidate[] {
  const durationSeconds = Math.max(0, input.durationSeconds ?? 0);
  const preferredDuration = Math.max(5, input.preferredDurationSeconds);
  const scenes = parseScenes(input.scenes);
  const captions = parseCaptions(input.captions);
  const limit = Math.min(Math.max(input.limit ?? 3, 1), 3);

  if (durationSeconds <= 0) {
    return [{
      id: 'opening-fallback-0',
      startSeconds: 0,
      endSeconds: preferredDuration,
      durationSeconds: preferredDuration,
      source: 'opening_fallback',
      sceneNumbers: [],
      captionCueCount: 0,
      rationale: 'Source duration is unavailable, so this is an editable opening-range fallback rather than a scene-selected recommendation.',
      safeguards: ['Review the source duration before rendering.', 'This candidate is not ranked as the best moment.'],
    }];
  }

  const candidates: ClipCandidate[] = [];
  for (const scene of uniqueAnchors(scenes, durationSeconds)) {
    const startSeconds = roundSeconds(scene.start_time);
    const endSeconds = roundSeconds(Math.min(durationSeconds, startSeconds + preferredDuration));
    if (endSeconds - startSeconds < 3) continue;
    const coveredScenes = scenes
      .filter((candidateScene) => candidateScene.start_time < endSeconds && candidateScene.end_time > startSeconds)
      .map((candidateScene) => candidateScene.scene_number ?? 0)
      .filter((sceneNumber) => sceneNumber > 0);
    const captionCueCount = captions.filter((caption) => caption.start < endSeconds && caption.end > startSeconds).length;
    candidates.push({
      id: `scene-${coveredScenes[0] ?? 'boundary'}-${Math.round(startSeconds * 10)}-${Math.round(endSeconds * 10)}`,
      startSeconds,
      endSeconds,
      durationSeconds: roundSeconds(endSeconds - startSeconds),
      source: 'scene_detection',
      sceneNumbers: coveredScenes,
      captionCueCount,
      rationale: `Starts at a processor-detected scene boundary and stays within the current platform target. It is a transparent scene-aware draft, not a claim that this is the best-performing moment.`,
      safeguards: ['Creator review is required before rendering.', 'Scene boundaries do not predict reach, followers, likes, or views.'],
    });
    if (candidates.length >= limit) break;
  }

  if (candidates.length > 0) return candidates;

  const endSeconds = roundSeconds(Math.min(durationSeconds, preferredDuration));
  return [{
    id: `opening-fallback-0-${Math.round(endSeconds * 10)}`,
    startSeconds: 0,
    endSeconds,
    durationSeconds: endSeconds,
    source: 'opening_fallback',
    sceneNumbers: [],
    captionCueCount: 0,
    rationale: durationSeconds <= preferredDuration
      ? 'The full source fits the current platform target, so this draft retains it intact.'
      : 'No usable processor scene data is available, so this editable opening-range fallback is shown instead of a fabricated scene recommendation.',
    safeguards: ['Creator review is required before rendering.', 'This candidate is not ranked as the best-performing moment.'],
  }];
}

export function extractClipAnalysis(variants: Array<{ generationParams: unknown }>) {
  for (const variant of variants) {
    const params = variant.generationParams;
    if (!params || typeof params !== 'object' || Array.isArray(params)) continue;
    const record = params as Record<string, unknown>;
    const scenes = parseScenes(record.scenes);
    const captions = parseCaptions(record.captions);
    if (scenes.length > 0 || captions.length > 0) {
      return { scenes, captions };
    }
  }
  return { scenes: [], captions: [] };
}
