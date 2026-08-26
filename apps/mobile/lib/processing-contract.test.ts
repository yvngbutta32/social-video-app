import { describe, expect, it } from "vitest";

import { parseProcessingDiagnostic, processingStateTitle } from "./processing-contract";

describe("safe processing diagnostics", () => {
  const diagnostic = { state: "failed" as const, phase: null, percent: null, platform: null, completedPlatforms: null, totalPlatforms: null, retry: { allowed: true, manualRetryCount: 1, remainingManualRetries: 2, recommendedAction: "Retry safely." }, issue: { code: "rendering_failed", message: "A private render did not complete." }, safeguards: ["Original source unchanged."] };

  it("accepts a complete safe diagnostic and exposes named states", () => {
    expect(parseProcessingDiagnostic({ data: { videoId: "video-1", updatedAt: "2026-08-26T00:00:00.000Z", diagnostic } }).diagnostic.state).toBe("failed");
    expect(processingStateTitle("ready")).toMatch(/ready/i);
  });

  it("rejects incomplete diagnostic payloads", () => {
    expect(() => parseProcessingDiagnostic({ data: { videoId: "video-1" } })).toThrow(/incomplete/i);
  });
});
