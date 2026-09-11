import { describe, expect, it } from "vitest";
import { formatCaptionTimestamp, normalizeTimedCaptionTrack, updateTimedCaptionCue } from "./timed-caption-contract";

describe("timed caption contract", () => {
  it("normalizes cues into ordered, non-overlapping minimum-duration segments", () => {
    const track = normalizeTimedCaptionTrack({
      language: "en-US",
      source: "transcript_service",
      cues: [
        { id: "b", startMs: 900, endMs: 1000, text: "  second   cue ", confidence: "review" },
        { id: "a", startMs: 0, endMs: 800, text: "first cue", confidence: "verified" },
      ],
    }, 3000);

    expect(track.cues).toEqual([
      { id: "b", startMs: 900, endMs: 1100, text: "second cue", confidence: "review" },
      { id: "a", startMs: 1100, endMs: 1300, text: "first cue", confidence: "verified" },
    ]);
  });

  it("rejects empty cues and gives unknown confidence an explicit unavailable state", () => {
    const track = normalizeTimedCaptionTrack({
      language: "",
      cues: [
        { id: "empty", startMs: 0, endMs: 200, text: "   ", confidence: "unavailable" },
        { id: "valid", startMs: 300, endMs: 700, text: "Hello", confidence: "machine-made" as never },
      ],
    });

    expect(track.language).toBe("und");
    expect(track.cues).toEqual([{ id: "valid", startMs: 300, endMs: 700, text: "Hello", confidence: "unavailable" }]);
  });

  it("updates one cue without allowing it to overlap the normalized track", () => {
    const original = normalizeTimedCaptionTrack({
      language: "ja",
      source: "creator",
      cues: [
        { id: "one", startMs: 0, endMs: 500, text: "One", confidence: "verified" },
        { id: "two", startMs: 500, endMs: 1000, text: "Two", confidence: "verified" },
      ],
    }, 2000);

    const updated = updateTimedCaptionCue(original, "two", { startMs: 100, endMs: 120, text: " Updated " }, 2000);
    expect(updated.cues[0].endMs).toBeLessThanOrEqual(updated.cues[1].startMs);
    expect(updated.cues[1].text).toBe("Updated");
    expect(updated.cues[1].endMs - updated.cues[1].startMs).toBeGreaterThanOrEqual(200);
  });

  it("formats timestamps for compact creator-facing review", () => {
    expect(formatCaptionTimestamp(0)).toBe("0:00.0");
    expect(formatCaptionTimestamp(65400)).toBe("1:05.4");
  });
});
