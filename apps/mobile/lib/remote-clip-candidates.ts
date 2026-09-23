import { normalizeClipCandidate, normalizeClipSet, type ClipSet } from "./clipping-contract";
import type { CreatorTargetPlatform } from "./creator-workflow";

type RemoteCandidate = {
  id?: unknown;
  startSeconds?: unknown;
  endSeconds?: unknown;
  source?: unknown;
  sceneNumbers?: unknown;
  captionCueCount?: unknown;
  rationale?: unknown;
  safeguards?: unknown;
};

const finite = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value: unknown, fallback: string) => typeof value === "string" && Boolean(value.trim()) ? value.trim() : fallback;

const arrayOfText = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];

const arrayOfNumbers = (value: unknown) => Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];

function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function parseRemoteClipCandidates(payload: unknown): ClipSet {
  const data = object(payload)?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The clip candidate response was incomplete. Refresh the private workspace before reviewing clips.");
  const record = data as Record<string, unknown>;
  const sourceId = text(record.videoId, "unselected");
  const platform = text(record.platform, "selected platform");
  const evidence = object(record.evidence);
  const sceneCount = Math.max(0, Math.floor(finite(evidence?.sceneCount)));
  const captionCueCount = Math.max(0, Math.floor(finite(evidence?.captionCueCount)));
  const analysisState = text(evidence?.analysisState, "analysis_unavailable");
  const safeguards = arrayOfText(record.safeguards);
  const rawCandidates = Array.isArray(record.candidates) ? record.candidates : [];
  const maximumSeconds = rawCandidates.reduce((maximum, candidate) => {
    const item = candidate && typeof candidate === "object" ? candidate as RemoteCandidate : {};
    return Math.max(maximum, finite(item.endSeconds));
  }, 0);

  const candidates = rawCandidates.map((candidate, index) => {
    const item = candidate && typeof candidate === "object" ? candidate as RemoteCandidate : {};
    const startSeconds = Math.max(0, finite(item.startSeconds));
    const endSeconds = Math.max(startSeconds + 0.5, finite(item.endSeconds, startSeconds + 3));
    const sceneNumbers = arrayOfNumbers(item.sceneNumbers);
    const candidateCaptionCount = Math.max(0, Math.floor(finite(item.captionCueCount)));
    const source = item.source === "scene_detection" ? "scene_detection" : "opening_fallback";
    const candidateSafeguards = [...safeguards, ...arrayOfText(item.safeguards)];
    return normalizeClipCandidate({
      id: text(item.id, `remote-candidate-${index + 1}`),
      sourceId,
      range: { trimStartSeconds: startSeconds, trimEndSeconds: endSeconds },
      title: `${platform} ${source === "scene_detection" ? "scene boundary" : "opening range"}`,
      summary: text(item.rationale, "Review this server-generated range before accepting it."),
      signals: {
        sceneBoundary: source === "scene_detection" ? 1 : 0,
        cleanStart: source === "scene_detection" ? 1 : 0.5,
        cleanEnd: source === "scene_detection" ? 1 : 0.5,
        visualChange: source === "scene_detection" ? 0.5 : 0,
        topicMatch: candidateCaptionCount > 0 ? 0.25 : 0,
      },
      confidence: source === "scene_detection" ? 0.6 : 0.25,
      warnings: [
        ...candidateSafeguards,
        ...(candidateCaptionCount > 0 ? [`${candidateCaptionCount} timed caption cue${candidateCaptionCount === 1 ? "" : "s"} overlap this range.`] : ["No timed caption cues were attached to this candidate."]),
        ...(analysisState === "opening_fallback_only" ? ["Processor scene analysis is unavailable; this is an editable opening fallback."] : []),
      ],
    }, Math.max(3, maximumSeconds));
  });

  return normalizeClipSet({
    id: `remote-clip-set-${sourceId}-${platform}`,
    sourceId,
    candidates,
    revision: 1,
    transcriptVersion: sceneCount > 0 || captionCueCount > 0 ? `processor-analysis-${sceneCount}-${captionCueCount}` : null,
    generatedBy: "deterministic-boundaries",
  }, Math.max(3, maximumSeconds));
}

export type RemoteClipCandidatePlatform = CreatorTargetPlatform;
