export const ADAPTATION_BRIEF_MAX_LENGTH = 280;

/**
 * Normalize creator direction before local persistence or a private plan request.
 * This is an editorial cue for private drafts, not a distribution instruction.
 */
export function normalizeAdaptationBrief(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, ADAPTATION_BRIEF_MAX_LENGTH).trimEnd();
}
