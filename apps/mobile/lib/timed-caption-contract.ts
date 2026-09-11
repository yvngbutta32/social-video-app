export type CaptionConfidence = "verified" | "review" | "unavailable";

export type TimedCaptionCue = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence: CaptionConfidence;
};

export type TimedCaptionTrack = {
  language: string;
  source: "creator" | "transcript_service" | "provider";
  cues: TimedCaptionCue[];
};

const DEFAULT_MAX_CUE_MS = 60 * 60 * 1000;
const MIN_CUE_DURATION_MS = 200;
const MAX_CUE_TEXT_LENGTH = 160;

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_CUE_TEXT_LENGTH);
}

function normalizeConfidence(value: unknown): CaptionConfidence {
  return value === "verified" || value === "review" ? value : "unavailable";
}

/** Normalizes transcript cues before local editing or persistence. */
export function normalizeTimedCaptionTrack(
  track: Partial<TimedCaptionTrack> | null | undefined,
  maximumMs = DEFAULT_MAX_CUE_MS,
): TimedCaptionTrack {
  const max = Math.max(MIN_CUE_DURATION_MS, finite(maximumMs, DEFAULT_MAX_CUE_MS));
  const language = typeof track?.language === "string" && track.language.trim() ? track.language.trim().slice(0, 16) : "und";
  const source = track?.source === "creator" || track?.source === "provider" ? track.source : "transcript_service";
  const rawCues = Array.isArray(track?.cues) ? track.cues : [];
  let previousEnd = 0;
  const cues = rawCues.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const cue = raw as Partial<TimedCaptionCue>;
    const start = Math.max(previousEnd, Math.min(max - MIN_CUE_DURATION_MS, Math.round(finite(cue.startMs ?? 0, 0))));
    const requestedEnd = Math.round(finite(cue.endMs ?? start + MIN_CUE_DURATION_MS, start + MIN_CUE_DURATION_MS));
    const end = Math.min(max, Math.max(start + MIN_CUE_DURATION_MS, requestedEnd));
    const text = cleanText(typeof cue.text === "string" ? cue.text : "");
    if (!text || end <= start) return [];
    previousEnd = end;
    return [{
      id: typeof cue.id === "string" && cue.id.trim() ? cue.id : `cue-${index + 1}`,
      startMs: start,
      endMs: end,
      text,
      confidence: normalizeConfidence(cue.confidence),
    }];
  });
  return { language, source, cues };
}

export function updateTimedCaptionCue(
  track: TimedCaptionTrack,
  cueId: string,
  update: Partial<Pick<TimedCaptionCue, "startMs" | "endMs" | "text" | "confidence">>,
  maximumMs?: number,
): TimedCaptionTrack {
  const normalized = normalizeTimedCaptionTrack(track, maximumMs);
  return normalizeTimedCaptionTrack({
    ...normalized,
    cues: normalized.cues.map((cue) => cue.id === cueId ? { ...cue, ...update } : cue),
  }, maximumMs);
}

export function formatCaptionTimestamp(ms: number) {
  const safe = Math.max(0, Math.round(finite(ms, 0)));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
