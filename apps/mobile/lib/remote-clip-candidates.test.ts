import { describe, expect, it } from "vitest";

import { parseRemoteClipCandidates } from "./remote-clip-candidates";

describe("remote clip candidate parser", () => {
  it("maps scene evidence into ranked reviewable candidates", () => {
    const clipSet = parseRemoteClipCandidates({
      data: {
        videoId: "video-1",
        platform: "tiktok",
        candidates: [{
          id: "scene-1-0-120",
          startSeconds: 0,
          endSeconds: 12,
          source: "scene_detection",
          sceneNumbers: [1],
          captionCueCount: 4,
          rationale: "Starts at a processor scene boundary.",
          safeguards: ["Creator review is required."],
        }],
        evidence: { sceneCount: 3, captionCueCount: 4, analysisState: "scene_detection_available" },
        safeguards: ["No reach guarantee."],
      },
    });

    expect(clipSet.sourceId).toBe("video-1");
    expect(clipSet.transcriptVersion).toBe("processor-analysis-3-4");
    expect(clipSet.candidates[0]?.score).toBeGreaterThan(0);
    expect(clipSet.candidates[0]?.evidence.map((item) => item.kind)).toContain("scene_boundary");
    expect(clipSet.candidates[0]?.warnings).toContain("No reach guarantee.");
  });

  it("preserves an opening fallback as a review warning rather than a recommendation claim", () => {
    const clipSet = parseRemoteClipCandidates({
      data: {
        videoId: "video-2",
        platform: "youtube",
        candidates: [{ id: "opening-fallback-0", startSeconds: 0, endSeconds: 30, source: "opening_fallback", sceneNumbers: [], captionCueCount: 0 }],
        evidence: { sceneCount: 0, captionCueCount: 0, analysisState: "opening_fallback_only" },
        safeguards: [],
      },
    });

    expect(clipSet.transcriptVersion).toBeNull();
    expect(clipSet.candidates[0]?.warnings.join(" ")).toMatch(/opening fallback/i);
    expect(clipSet.candidates[0]?.evidence.map((item) => item.kind)).not.toContain("scene_boundary");
  });

  it("preserves verified word-level transcript provenance", () => {
    const clipSet = parseRemoteClipCandidates({
      data: {
        videoId: "video-3",
        platform: "instagram",
        transcript: { state: "word_level", transcriptId: "tx-3", provider: "whisper", modelVersion: "v2", language: "en", wordCount: 42 },
        candidates: [{ id: "transcript-1", startSeconds: 2, endSeconds: 14, source: "scene_detection", sceneNumbers: [2], captionCueCount: 3 }],
        evidence: { sceneCount: 1, captionCueCount: 3, analysisState: "word_level_transcript_available" },
        safeguards: [],
      },
    });

    expect(clipSet.transcriptState).toBe("word_level");
    expect(clipSet.transcriptVersion).toBe("tx-3");
    expect(clipSet.transcriptProvenance).toEqual({ transcriptId: "tx-3", provider: "whisper", modelVersion: "v2", language: "en" });
  });

  it("maps transcript-boundary drafts as complete-thought candidates", () => {
    const clipSet = parseRemoteClipCandidates({
      data: {
        videoId: "video-4",
        platform: "youtube",
        transcript: { state: "word_level", transcriptId: "tx-4", provider: "whisper", modelVersion: "v2", language: "en", wordCount: 16 },
        candidates: [{ id: "transcript-1", startSeconds: 1, endSeconds: 9, source: "transcript_boundary", sceneNumbers: [], captionCueCount: 0, rationale: "Uses verified word-level transcript boundaries." }],
        evidence: { sceneCount: 0, captionCueCount: 0, analysisState: "word_level_transcript_available" },
        safeguards: [],
      },
    });

    expect(clipSet.candidates[0]?.title).toContain("transcript boundary");
    expect(clipSet.candidates[0]?.evidence.map((item) => item.kind)).toContain("complete_thought");
    expect(clipSet.candidates[0]?.warnings.join(" ")).toMatch(/transcript boundaries do not predict/i);
  });
});
