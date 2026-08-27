export type TrimRange = {
  trimStartSeconds: number;
  trimEndSeconds: number;
};

export type TrimEdge = "start" | "end";

const defaultMaximumSeconds = 3_600;
export const minimumTrimDurationSeconds = 0.5;

const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, lower: number, upper: number) => Math.min(Math.max(value, lower), upper);

/** Keeps local timing edits valid before the recipe is persisted or sent to the private API. */
export function normalizeTrimRange(
  range: TrimRange,
  maximumSeconds = defaultMaximumSeconds,
  minimumDurationSeconds = minimumTrimDurationSeconds,
): TrimRange {
  const maximum = Math.max(minimumDurationSeconds, finiteOr(maximumSeconds, defaultMaximumSeconds));
  const start = clamp(finiteOr(range.trimStartSeconds, 0), 0, maximum - minimumDurationSeconds);
  const requestedEnd = clamp(finiteOr(range.trimEndSeconds, start + minimumDurationSeconds), 0, maximum);
  const end = requestedEnd >= start + minimumDurationSeconds
    ? requestedEnd
    : Math.min(maximum, start + minimumDurationSeconds);

  if (end >= start + minimumDurationSeconds) return { trimStartSeconds: start, trimEndSeconds: end };
  return { trimStartSeconds: Math.max(0, maximum - minimumDurationSeconds), trimEndSeconds: maximum };
}

/** Nudges one trim edge without inverting the range or shrinking it below the minimum duration. */
export function nudgeTrimRange(range: TrimRange, edge: TrimEdge, deltaSeconds: number, maximumSeconds = defaultMaximumSeconds): TrimRange {
  const normalized = normalizeTrimRange(range, maximumSeconds);
  const delta = finiteOr(deltaSeconds, 0);
  if (edge === "start") {
    return { ...normalized, trimStartSeconds: clamp(normalized.trimStartSeconds + delta, 0, normalized.trimEndSeconds - minimumTrimDurationSeconds) };
  }
  return { ...normalized, trimEndSeconds: clamp(normalized.trimEndSeconds + delta, normalized.trimStartSeconds + minimumTrimDurationSeconds, maximumSeconds) };
}

export function trimDurationSeconds(range: TrimRange) {
  const normalized = normalizeTrimRange(range);
  return normalized.trimEndSeconds - normalized.trimStartSeconds;
}

export function formatTimelineTime(seconds: number) {
  const value = Math.max(0, finiteOr(seconds, 0));
  const minutes = Math.floor(value / 60);
  const remaining = value - minutes * 60;
  return `${minutes}:${remaining.toFixed(1).padStart(4, "0")}`;
}
