import { normalizeClipCandidate, normalizeClipSet, type ClipCandidate, type ClipSet, type ClipSignalInput } from "./clipping-contract";

export type TranscriptWord = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker: string | null;
  confidence: number | null;
};

export type TranscriptProvenance = {
  transcriptId: string | null;
  source: "creator" | "transcript_service" | "provider";
  provider: string | null;
  modelVersion: string | null;
  language: string;
  capturedAt: string | null;
};

export type WordTranscript = {
  sourceId: string;
  durationMs: number;
  words: TranscriptWord[];
  provenance: TranscriptProvenance;
};

export type ClipGenerationOptions = {
  minimumDurationMs?: number;
  maximumDurationMs?: number;
  maximumCandidates?: number;
  topicTerms?: string[];
};

const MIN_WORD_DURATION_MS = 80;
const DEFAULT_MINIMUM_CLIP_MS = 6_000;
const DEFAULT_MAXIMUM_CLIP_MS = 60_000;
const DEFAULT_MAXIMUM_CANDIDATES = 10;
const SENTENCE_END = /[.!?؟。！？]$/;

const finite = (value: number | null | undefined, fallback: number) => Number.isFinite(value) ? value as number : fallback;
const clean = (value: string | null | undefined) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const boundedConfidence = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? null : Math.min(1, Math.max(0, value));
const boundedLanguage = (value: string | null | undefined) => clean(value).slice(0, 16) || "und";
const nullable = (value: string | null | undefined) => clean(value) || null;

export function normalizeWordTranscript(input: Partial<WordTranscript> | null | undefined): WordTranscript {
  const rawWords = Array.isArray(input?.words) ? input.words : [];
  const durationMs = Math.max(MIN_WORD_DURATION_MS, Math.round(finite(input?.durationMs, 0)));
  const words = rawWords.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const word = raw as Partial<TranscriptWord>;
    const text = clean(word.text);
    if (!text) return [];
    const startMs = Math.max(0, Math.min(durationMs - MIN_WORD_DURATION_MS, Math.round(finite(word.startMs, 0))));
    const requestedEnd = Math.round(finite(word.endMs, startMs + MIN_WORD_DURATION_MS));
    const endMs = Math.min(durationMs, Math.max(startMs + MIN_WORD_DURATION_MS, requestedEnd));
    return [{
      id: clean(word.id) || `word-${index + 1}`,
      startMs,
      endMs,
      text: text.slice(0, 120),
      speaker: nullable(word.speaker),
      confidence: boundedConfidence(word.confidence),
    }];
  }).sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.id.localeCompare(right.id));

  return {
    sourceId: clean(input?.sourceId) || "unselected",
    durationMs,
    words,
    provenance: {
      transcriptId: nullable(input?.provenance?.transcriptId),
      source: input?.provenance?.source === "creator" || input?.provenance?.source === "provider" ? input.provenance.source : "transcript_service",
      provider: nullable(input?.provenance?.provider),
      modelVersion: nullable(input?.provenance?.modelVersion),
      language: boundedLanguage(input?.provenance?.language),
      capturedAt: nullable(input?.provenance?.capturedAt),
    },
  };
}

function textFor(words: TranscriptWord[]) {
  return words.map((word) => word.text).join(" ").replace(/\s+([,.!?])/g, "$1").trim();
}

function hasTopicMatch(words: TranscriptWord[], terms: string[]) {
  if (!terms.length) return 0;
  const text = textFor(words).toLocaleLowerCase();
  return terms.some((term) => text.includes(term.toLocaleLowerCase())) ? 1 : 0;
}

function confidenceFor(words: TranscriptWord[]) {
  const available = words.map((word) => word.confidence).filter((value): value is number => value !== null);
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : 0;
}

function boundaryBefore(words: TranscriptWord[], index: number) {
  if (index === 0) return 1;
  return words[index].startMs - words[index - 1].endMs >= 300 ? 1 : 0;
}

function boundaryAfter(words: TranscriptWord[], index: number) {
  if (index === words.length - 1) return 1;
  return words[index + 1].startMs - words[index].endMs >= 300 ? 1 : 0;
}

/**
 * Generates reviewable candidates from real word timestamps. This is an explainable
 * boundary heuristic, not a claim that a candidate will perform or go viral.
 */
export function generateClipCandidates(
  transcriptInput: WordTranscript,
  options: ClipGenerationOptions = {},
): ClipCandidate[] {
  const transcript = normalizeWordTranscript(transcriptInput);
  if (!transcript.words.length) return [];

  const minimumDurationMs = Math.max(MIN_WORD_DURATION_MS, Math.round(finite(options.minimumDurationMs, DEFAULT_MINIMUM_CLIP_MS)));
  const maximumDurationMs = Math.max(minimumDurationMs, Math.round(finite(options.maximumDurationMs, DEFAULT_MAXIMUM_CLIP_MS)));
  const maximumCandidates = Math.max(1, Math.min(50, Math.floor(finite(options.maximumCandidates, DEFAULT_MAXIMUM_CANDIDATES))));
  const topicTerms = (options.topicTerms ?? []).map((term) => clean(term)).filter(Boolean).slice(0, 20);
  const candidates: ClipCandidate[] = [];
  let startIndex = 0;

  while (startIndex < transcript.words.length && candidates.length < maximumCandidates) {
    let endIndex = startIndex;
    let bestEndIndex = -1;
    while (endIndex < transcript.words.length) {
      const words = transcript.words.slice(startIndex, endIndex + 1);
      const durationMs = words[words.length - 1].endMs - words[0].startMs;
      const endsThought = SENTENCE_END.test(words[words.length - 1].text);
      const nextStartsNewSpeaker = endIndex < transcript.words.length - 1 && transcript.words[endIndex + 1].speaker !== transcript.words[endIndex].speaker && Boolean(transcript.words[endIndex + 1].speaker || transcript.words[endIndex].speaker);
      if (durationMs > maximumDurationMs) break;
      if ((endsThought || nextStartsNewSpeaker || endIndex === transcript.words.length - 1) && durationMs >= minimumDurationMs) {
        bestEndIndex = endIndex;
        break;
      }
      endIndex += 1;
    }

    if (bestEndIndex === -1) {
      startIndex += 1;
      continue;
    }

    const words = transcript.words.slice(startIndex, bestEndIndex + 1);
    const first = words[0];
    const last = words[words.length - 1];
    const completeThought = SENTENCE_END.test(last.text) ? 1 : 0;
    const speakerTurn = bestEndIndex < transcript.words.length - 1 && transcript.words[bestEndIndex + 1].speaker !== last.speaker ? 1 : 0;
    const signals: ClipSignalInput = {
      completeThought,
      speakerTurn,
      topicMatch: hasTopicMatch(words, topicTerms),
      cleanStart: boundaryBefore(transcript.words, startIndex),
      cleanEnd: boundaryAfter(transcript.words, bestEndIndex),
    };
    const text = textFor(words);
    candidates.push(normalizeClipCandidate({
      id: `candidate-${candidates.length + 1}`,
      sourceId: transcript.sourceId,
      range: { trimStartSeconds: first.startMs / 1000, trimEndSeconds: last.endMs / 1000 },
      title: text.length > 64 ? `${text.slice(0, 61).trim()}…` : text,
      summary: text,
      signals,
      confidence: confidenceFor(words),
    }, transcript.durationMs / 1000));

    startIndex = bestEndIndex + 1;
  }

  return candidates;
}

export function generateClipSet(
  transcriptInput: WordTranscript,
  options: ClipGenerationOptions = {},
): ClipSet {
  const transcript = normalizeWordTranscript(transcriptInput);
  const candidates = generateClipCandidates(transcript, options);
  const generatedBy = transcript.provenance.modelVersion ? "transcript-model" : "deterministic-boundaries";
  return normalizeClipSet({
    id: `clip-set-${transcript.sourceId}`,
    sourceId: transcript.sourceId,
    candidates,
    revision: 1,
    transcriptVersion: transcript.provenance.transcriptId ?? transcript.provenance.modelVersion,
    generatedBy,
  }, transcript.durationMs / 1000);
}
