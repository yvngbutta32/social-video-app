import { describe, expect, it } from "vitest";

import { candidateEvidenceSummary, normalizeClipCandidate, normalizeClipSet, rankClipCandidates, scoreClipSignals } from "./clipping-contract";

describe("clipping contract", () => {
  it("scores explainable signals without describing the result as a virality prediction", () => {
    expect(scoreClipSignals({ completeThought: 1, topicMatch: 0.5, cleanEnd: 1 })).toBe(40);
  });

  it("normalizes a candidate range and preserves review warnings", () => {
    const candidate = normalizeClipCandidate({
      id: "candidate-1",
      sourceId: "source-1",
      range: { trimStartSeconds: 14, trimEndSeconds: 15 },
      title: "A short answer",
      summary: "A complete answer from the source.",
      signals: { completeThought: 1 },
    }, 90);

    expect(candidate.range).toEqual({ trimStartSeconds: 14, trimEndSeconds: 15 });
    expect(candidate.score).toBe(24);
    expect(candidate.evidence[0]?.label).toBe("Complete thought");
    expect(candidate.warnings).toContain("This candidate is shorter than the recommended three-second review window.");
    expect(candidateEvidenceSummary(candidate)).toBe("Complete thought");
  });

  it("ranks candidates by score, confidence, duration, then stable id", () => {
    const candidates = [
      normalizeClipCandidate({ id: "b", sourceId: "source", range: { trimStartSeconds: 0, trimEndSeconds: 8 }, title: "B", summary: "B", signals: { topicMatch: 1 } }, 60),
      normalizeClipCandidate({ id: "a", sourceId: "source", range: { trimStartSeconds: 10, trimEndSeconds: 18 }, title: "A", summary: "A", signals: { completeThought: 1 } }, 60),
      normalizeClipCandidate({ id: "c", sourceId: "source", range: { trimStartSeconds: 20, trimEndSeconds: 28 }, title: "C", summary: "C", signals: { completeThought: 1 }, confidence: 0.9 }, 60),
    ];

    expect(rankClipCandidates(candidates).map((candidate) => candidate.id)).toEqual(["c", "a", "b"]);
  });

  it("normalizes a clip set without mutating the original candidate order", () => {
    const source = {
      id: "set-1",
      sourceId: "source-1",
      revision: 0,
      transcriptVersion: "  transcript-v1 ",
      generatedBy: "unknown" as "deterministic-boundaries",
      candidates: [
        normalizeClipCandidate({ id: "low", sourceId: "source-1", range: { trimStartSeconds: 2, trimEndSeconds: 8 }, title: "Low", summary: "Low", signals: { cleanStart: 1 } }, 60),
        normalizeClipCandidate({ id: "high", sourceId: "source-1", range: { trimStartSeconds: 12, trimEndSeconds: 20 }, title: "High", summary: "High", signals: { topicMatch: 1, completeThought: 1 } }, 60),
      ],
    };

    const normalized = normalizeClipSet(source, 60);
    expect(normalized.revision).toBe(1);
    expect(normalized.generatedBy).toBe("deterministic-boundaries");
    expect(normalized.transcriptVersion).toBe("transcript-v1");
    expect(normalized.candidates.map((candidate) => candidate.id)).toEqual(["high", "low"]);
    expect(source.candidates.map((candidate) => candidate.id)).toEqual(["low", "high"]);
  });
});
