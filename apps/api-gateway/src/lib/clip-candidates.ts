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

const transcriptWordSchema = z.object({
  id: z.string().min(1).optional(),
  startMs: z.number().finite().min(0),
  endMs: z.number().finite().positive(),
  text: z.string().min(1),
  speaker: z.string().min(1).nullable().optional(),
  confidence: z.number().finite().min(0).max(1).nullable().optional(),
}).refine((word) => word.endMs > word.startMs);

const transcriptWordsSchema = z.array(transcriptWordSchema).superRefine((words, context) => {
  for (let index = 1; index < words.length; index += 1) {
    const previous = words[index - 1];
    const current = words[index];
    if (!previous || !current) continue;
    if (current.startMs < previous.startMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'startMs'], message: 'Transcript words must be ordered by start time' });
    }
    if (current.startMs < previous.endMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'startMs'], message: 'Transcript words must not overlap' });
    }
  }
});

const transcriptSchema = z.object({
  state: z.enum(['unavailable', 'text_only', 'word_level']).optional(),
  transcriptId: z.string().min(1).nullable().optional(),
  provider: z.string().min(1).nullable().optional(),
  modelVersion: z.string().min(1).nullable().optional(),
  language: z.string().min(1).nullable().optional(),
  text: z.string().min(1).optional(),
  wordCount: z.number().int().nonnegative().optional(),
  words: transcriptWordsSchema.optional(),
}).superRefine((transcript, context) => {
  const actualWordCount = transcript.words?.length ?? 0;
  if (transcript.wordCount !== undefined && transcript.wordCount !== actualWordCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['wordCount'], message: 'Transcript wordCount must match words.length' });
  }
});

export type ClipTranscriptProvenance = {
  state: 'unavailable' | 'text_only' | 'word_level';
  transcriptId: string | null;
  provider: string | null;
  modelVersion: string | null;
  language: string | null;
  wordCount: number;
  words: Array<{
    id: string;
    startMs: number;
    endMs: number;
    text: string;
    speaker: string | null;
    confidence: number | null;
  }>;
};

export type ClipCandidate = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  source: 'scene_detection' | 'transcript_boundary' | 'opening_fallback';
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

function parseTranscript(value: unknown): ClipTranscriptProvenance | null {
  const parsed = transcriptSchema.safeParse(value);
  if (!parsed.success) return null;
  const transcript = parsed.data;
  const wordCount = transcript.words?.length ?? 0;
  const state = wordCount > 0 ? 'word_level' : transcript.text?.trim() ? 'text_only' : 'unavailable';
  if (state === 'unavailable') return null;
  return {
    state,
    transcriptId: transcript.transcriptId ?? null,
    provider: transcript.provider ?? null,
    modelVersion: transcript.modelVersion ?? null,
    language: transcript.language ?? null,
    wordCount,
    words: (transcript.words ?? []).map((word, index) => ({
      id: word.id ?? `word-${index + 1}`,
      startMs: word.startMs,
      endMs: word.endMs,
      text: word.text.trim(),
      speaker: word.speaker ?? null,
      confidence: word.confidence ?? null,
    })),
  };
}

function uniqueAnchors(scenes: z.infer<typeof sceneSchema>[], durationSeconds: number) {
  if (scenes.length === 0) return [];
  const preferredIndexes = [...new Set([0, Math.floor((scenes.length - 1) / 2), scenes.length - 1])];
  return preferredIndexes
    .map((index) => scenes[index])
    .filter((scene) => scene && scene.start_time < durationSeconds)
    .filter((scene, index, all) => all.findIndex((other) => other.start_time === scene.start_time) === index);
}

function roundMilliseconds(value: number) {
  return Math.round(value / 10) * 10;
}

export function createTranscriptClipCandidates(input: {
  durationSeconds: number;
  preferredDurationSeconds: number;
  transcript: ClipTranscriptProvenance;
  limit?: number;
}): ClipCandidate[] {
  if (input.transcript.state !== 'word_level' || input.transcript.words.length === 0) return [];
  const words = input.transcript.words;
  const minDurationMs = 6_000;
  const maxDurationMs = Math.max(minDurationMs, Math.min(60_000, Math.round(input.preferredDurationSeconds * 1000)));
  const limit = Math.min(Math.max(input.limit ?? 3, 1), 5);
  const candidates: ClipCandidate[] = [];
  let startIndex = 0;

  while (startIndex < words.length && candidates.length < limit) {
    const first = words[startIndex];
    let endIndex = startIndex;
    let selectedEndIndex = -1;
    while (endIndex < words.length) {
      const last = words[endIndex];
      const durationMs = last.endMs - first.startMs;
      if (durationMs > maxDurationMs) break;
      const completeThought = /[.!?؟。！？]$/.test(last.text);
      const speakerTurn = endIndex < words.length - 1
        && words[endIndex + 1]?.speaker !== last.speaker
        && Boolean(words[endIndex + 1]?.speaker || last.speaker);
      if ((completeThought || speakerTurn || endIndex === words.length - 1) && durationMs >= minDurationMs) {
        selectedEndIndex = endIndex;
        break;
      }
      endIndex += 1;
    }
    if (selectedEndIndex < 0) {
      startIndex += 1;
      continue;
    }
    const last = words[selectedEndIndex];
    const startSeconds = roundMilliseconds(first.startMs) / 1000;
    const endSeconds = Math.min(input.durationSeconds, roundMilliseconds(last.endMs) / 1000);
    const summary = words.slice(startIndex, selectedEndIndex + 1).map((word) => word.text).join(' ').replace(/\s+([,.!?])/g, '$1').trim();
    candidates.push({
      id: `transcript-${candidates.length + 1}-${Math.round(startSeconds * 10)}-${Math.round(endSeconds * 10)}`,
      startSeconds,
      endSeconds,
      durationSeconds: roundMilliseconds(last.endMs - first.startMs) / 1000,
      source: 'transcript_boundary',
      sceneNumbers: [],
      captionCueCount: 0,
      rationale: `Uses verified word-level transcript boundaries${summary ? `: “${summary.slice(0, 96)}${summary.length > 96 ? '…' : ''}”` : '.'} This is an explainable editing draft, not a performance prediction.`,
      safeguards: ['Creator review is required before rendering.', 'Transcript boundaries do not predict reach, followers, likes, or views.'],
    });
    startIndex = selectedEndIndex + 1;
  }
  return candidates;
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
    const transcript = parseTranscript(record.transcript);
    if (scenes.length > 0 || captions.length > 0 || transcript) {
      return { scenes, captions, transcript };
    }
  }
  return { scenes: [], captions: [], transcript: null };
}
