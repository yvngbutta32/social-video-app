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

export type CaptionDiagnosticCode = "no_cues" | "overlap" | "short_duration" | "long_duration" | "dense_text" | "long_text" | "low_confidence";

export type CaptionDiagnostic = {
  cueId: string | null;
  code: CaptionDiagnosticCode;
  message: string;
};

export type TimedCaptionQualityReport = {
  status: "ready" | "review" | "unavailable";
  cueCount: number;
  averageCharactersPerSecond: number;
  diagnostics: CaptionDiagnostic[];
};

const DEFAULT_MAX_CUE_MS = 60 * 60 * 1000;
const MIN_CUE_DURATION_MS = 200;
const MAX_CUE_TEXT_LENGTH = 160;
const MIN_READABLE_CUE_MS = 700;
const MAX_RECOMMENDED_CUE_MS = 6000;
const MAX_CHARACTERS_PER_SECOND = 17;
const MAX_RECOMMENDED_CUE_CHARACTERS = 42;

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

/**
 * Produces transparent editorial checks for creator review. These heuristics
 * help catch likely readability issues but do not certify platform compliance.
 */
export function auditTimedCaptionTrack(track: TimedCaptionTrack | null | undefined): TimedCaptionQualityReport {
  if (!track?.cues.length) {
    return {
      status: "unavailable",
      cueCount: 0,
      averageCharactersPerSecond: 0,
      diagnostics: [{ cueId: null, code: "no_cues", message: "No timed captions are available for review." }],
    };
  }

  const diagnostics: CaptionDiagnostic[] = [];
  let previousEnd = 0;
  let totalCharacters = 0;
  let totalDurationMs = 0;

  track.cues.forEach((cue) => {
    const durationMs = Math.max(0, cue.endMs - cue.startMs);
    const charactersPerSecond = durationMs > 0 ? cue.text.length / (durationMs / 1000) : Number.POSITIVE_INFINITY;
    totalCharacters += cue.text.length;
    totalDurationMs += durationMs;

    if (cue.startMs < previousEnd) {
      diagnostics.push({ cueId: cue.id, code: "overlap", message: "This cue overlaps the previous cue. Adjust the timing before rendering." });
    }
    if (durationMs < MIN_READABLE_CUE_MS) {
      diagnostics.push({ cueId: cue.id, code: "short_duration", message: "This cue is brief. Confirm the text can be read at normal playback speed." });
    }
    if (durationMs > MAX_RECOMMENDED_CUE_MS) {
      diagnostics.push({ cueId: cue.id, code: "long_duration", message: "This cue spans a long interval. Consider splitting it to keep captions synchronized with speech." });
    }
    if (charactersPerSecond > MAX_CHARACTERS_PER_SECOND) {
      diagnostics.push({ cueId: cue.id, code: "dense_text", message: "This cue has high character density. Shorten the phrase or extend its timing during review." });
    }
    if (cue.text.length > MAX_RECOMMENDED_CUE_CHARACTERS) {
      diagnostics.push({ cueId: cue.id, code: "long_text", message: "This cue is long. Consider a shorter phrase for smaller screens and faster scanning." });
    }
    if (cue.confidence === "unavailable") {
      diagnostics.push({ cueId: cue.id, code: "low_confidence", message: "Caption confidence is unavailable. Review the wording before rendering." });
    }
    previousEnd = Math.max(previousEnd, cue.endMs);
  });

  return {
    status: diagnostics.length ? "review" : "ready",
    cueCount: track.cues.length,
    averageCharactersPerSecond: totalDurationMs > 0 ? totalCharacters / (totalDurationMs / 1000) : 0,
    diagnostics,
  };
}

export function formatCaptionTimestamp(ms: number) {
  const safe = Math.max(0, Math.round(finite(ms, 0)));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
