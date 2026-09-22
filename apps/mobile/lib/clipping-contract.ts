import { normalizeTrimRange, type TrimRange } from "./precision-timeline";

export const clipCandidateStatuses = ["proposed", "accepted", "rejected", "edited"] as const;
export type ClipCandidateStatus = (typeof clipCandidateStatuses)[number];

export const clipEvidenceKinds = [
  "complete_thought",
  "scene_boundary",
  "speaker_turn",
  "visual_change",
  "audio_energy",
  "topic_match",
  "clean_start",
  "clean_end",
] as const;
export type ClipEvidenceKind = (typeof clipEvidenceKinds)[number];

export type ClipSourceRange = TrimRange;

export type ClipEvidence = {
  kind: ClipEvidenceKind;
  label: string;
  weight: number;
};

export type ClipCandidate = {
  id: string;
  sourceId: string;
  range: ClipSourceRange;
  title: string;
  summary: string;
  score: number;
  confidence: number;
  evidence: ClipEvidence[];
  warnings: string[];
  status: ClipCandidateStatus;
};

export type ClipSet = {
  id: string;
  sourceId: string;
  candidates: ClipCandidate[];
  revision: number;
  transcriptVersion: string | null;
  generatedBy: "deterministic-boundaries" | "transcript-model" | "creator";
};

export type ClipSignalInput = {
  completeThought?: number;
  sceneBoundary?: number;
  speakerTurn?: number;
  visualChange?: number;
  audioEnergy?: number;
  topicMatch?: number;
  cleanStart?: number;
  cleanEnd?: number;
};

export type ClipCandidateDraft = Omit<ClipCandidate, "score" | "confidence" | "range" | "evidence" | "warnings" | "status"> & {
  range: ClipSourceRange;
  signals?: ClipSignalInput;
  score?: number;
  evidence?: ClipEvidence[];
  warnings?: string[];
  status?: ClipCandidateStatus;
  confidence?: number;
};

const scoreWeights: Record<keyof ClipSignalInput, number> = {
  completeThought: 24,
  sceneBoundary: 12,
  speakerTurn: 10,
  visualChange: 10,
  audioEnergy: 12,
  topicMatch: 18,
  cleanStart: 7,
  cleanEnd: 7,
};

const evidenceLabels: Record<ClipEvidenceKind, string> = {
  complete_thought: "Complete thought",
  scene_boundary: "Scene boundary",
  speaker_turn: "Speaker turn",
  visual_change: "Visual change",
  audio_energy: "Audio energy",
  topic_match: "Topic match",
  clean_start: "Clean start",
  clean_end: "Clean ending",
};

const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value as number : fallback;
const clamp01 = (value: number | undefined) => Math.min(1, Math.max(0, finite(value)));
const clampScore = (value: number) => Math.min(100, Math.max(0, Math.round(finite(value))));
const cleanText = (value: string, fallback: string) => value.trim() || fallback;

export function scoreClipSignals(signals: ClipSignalInput = {}) {
  const entries = (Object.keys(scoreWeights) as Array<keyof ClipSignalInput>);
  const raw = entries.reduce((total, key) => total + clamp01(signals[key]) * scoreWeights[key], 0);
  return clampScore(raw);
}

export function evidenceFromSignals(signals: ClipSignalInput = {}): ClipEvidence[] {
  return (Object.keys(scoreWeights) as Array<keyof ClipSignalInput>)
    .filter((key) => clamp01(signals[key]) > 0)
    .map((key) => {
      const kind = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) as ClipEvidenceKind;
      return { kind, label: evidenceLabels[kind], weight: clamp01(signals[key]) };
    });
}

export function normalizeClipRange(range: ClipSourceRange, maximumSeconds: number) {
  return normalizeTrimRange(range, Math.max(0.5, finite(maximumSeconds, 3_600)));
}

export function normalizeClipCandidate(draft: ClipCandidateDraft, maximumSeconds: number): ClipCandidate {
  const range = normalizeClipRange(draft.range, maximumSeconds);
  const signals = draft.signals ?? {};
  const evidence = (draft.evidence?.length ? draft.evidence : evidenceFromSignals(signals)).map((item) => ({
    kind: item.kind,
    label: cleanText(item.label, evidenceLabels[item.kind]),
    weight: clamp01(item.weight),
  }));
  const score = draft.signals ? scoreClipSignals(signals) : clampScore(draft.score ?? 0);
  const confidence = clamp01(draft.confidence ?? (evidence.length ? Math.min(1, score / 100 + 0.1) : 0));
  const warnings = [...new Set((draft.warnings ?? []).map((warning) => warning.trim()).filter(Boolean))];

  if (range.trimEndSeconds - range.trimStartSeconds < 3) warnings.push("This candidate is shorter than the recommended three-second review window.");
  if (!evidence.length) warnings.push("No selection evidence is available; review this candidate manually.");

  return {
    id: cleanText(draft.id, `clip-${draft.sourceId}`),
    sourceId: cleanText(draft.sourceId, "unselected"),
    range,
    title: cleanText(draft.title, "Untitled clip candidate"),
    summary: cleanText(draft.summary, "Review this source range before accepting it."),
    score,
    confidence,
    evidence,
    warnings: [...new Set(warnings)],
    status: draft.status && clipCandidateStatuses.includes(draft.status) ? draft.status : "proposed",
  };
}

export function rankClipCandidates(candidates: ClipCandidate[]) {
  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.confidence !== left.confidence) return right.confidence - left.confidence;
    const leftDuration = left.range.trimEndSeconds - left.range.trimStartSeconds;
    const rightDuration = right.range.trimEndSeconds - right.range.trimStartSeconds;
    if (rightDuration !== leftDuration) return rightDuration - leftDuration;
    return left.id.localeCompare(right.id);
  });
}

export function normalizeClipSet(set: ClipSet, maximumSeconds: number): ClipSet {
  const candidates = rankClipCandidates(set.candidates.map((candidate) => normalizeClipCandidate(candidate, maximumSeconds)));
  return {
    id: cleanText(set.id, `clip-set-${set.sourceId}`),
    sourceId: cleanText(set.sourceId, "unselected"),
    candidates,
    revision: Math.max(1, Math.floor(finite(set.revision, 1))),
    transcriptVersion: set.transcriptVersion?.trim() || null,
    generatedBy: set.generatedBy === "transcript-model" || set.generatedBy === "creator" ? set.generatedBy : "deterministic-boundaries",
  };
}

export function candidateEvidenceSummary(candidate: ClipCandidate) {
  if (!candidate.evidence.length) return "Manual review required; no evidence was recorded.";
  return candidate.evidence.map((evidence) => evidence.label).join(" · ");
}
