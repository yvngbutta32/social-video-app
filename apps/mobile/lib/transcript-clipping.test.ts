import { describe, expect, it } from "vitest";

import { generateClipCandidates, generateClipSet, normalizeWordTranscript } from "./transcript-clipping";

describe("transcript clipping", () => {
  it("normalizes provenance and word timing without inventing confidence", () => {
    const transcript = normalizeWordTranscript({
      sourceId: " source-1 ",
      durationMs: 8_000,
      provenance: { source: "transcript_service", provider: "Example ASR", modelVersion: "v2", language: "en-US", transcriptId: "tx-1", capturedAt: "2026-09-22T00:00:00Z" },
      words: [
        { id: "two", startMs: 1_000, endMs: 1_050, text: "world", speaker: "host", confidence: 0.8 },
        { id: "one", startMs: 0, endMs: 400, text: "Hello", speaker: "host", confidence: null },
        { id: "empty", startMs: 2_000, endMs: 2_200, text: "   ", speaker: null, confidence: 1 },
      ],
    });

    expect(transcript.sourceId).toBe("source-1");
    expect(transcript.provenance.modelVersion).toBe("v2");
    expect(transcript.words.map((word) => word.id)).toEqual(["one", "two"]);
    expect(transcript.words[0]?.confidence).toBeNull();
  });

  it("creates candidates only at real sentence, speaker, or source boundaries", () => {
    const transcript = normalizeWordTranscript({
      sourceId: "source-1",
      durationMs: 20_000,
      provenance: { source: "transcript_service", provider: null, modelVersion: null, language: "en", transcriptId: null, capturedAt: null },
      words: [
        { id: "1", startMs: 0, endMs: 1_000, text: "This", speaker: "A", confidence: 0.9 },
        { id: "2", startMs: 1_000, endMs: 2_000, text: "is", speaker: "A", confidence: 0.9 },
        { id: "3", startMs: 2_000, endMs: 3_000, text: "the", speaker: "A", confidence: 0.9 },
        { id: "4", startMs: 3_000, endMs: 4_000, text: "proof.", speaker: "A", confidence: 0.9 },
        { id: "5", startMs: 4_400, endMs: 5_400, text: "Now", speaker: "B", confidence: 0.7 },
        { id: "6", startMs: 5_400, endMs: 6_400, text: "we", speaker: "B", confidence: 0.7 },
        { id: "7", startMs: 6_400, endMs: 7_400, text: "show", speaker: "B", confidence: 0.7 },
        { id: "8", startMs: 7_400, endMs: 8_400, text: "it.", speaker: "B", confidence: 0.7 },
      ],
    });

    const candidates = generateClipCandidates(transcript, { minimumDurationMs: 3_000, maximumDurationMs: 10_000, topicTerms: ["proof"] });
    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.range).toEqual({ trimStartSeconds: 0, trimEndSeconds: 4 });
    expect(candidates[0]?.evidence.map((evidence) => evidence.kind)).toEqual(expect.arrayContaining(["complete_thought", "topic_match", "clean_start", "clean_end"]));
    expect(candidates[1]?.range).toEqual({ trimStartSeconds: 4.4, trimEndSeconds: 8.4 });
    expect(candidates[1]?.summary).toBe("Now we show it.");
  });

  it("returns no candidates when the transcript has no usable words", () => {
    expect(generateClipCandidates({ sourceId: "source-1", durationMs: 10_000, words: [], provenance: { source: "transcript_service", provider: null, modelVersion: null, language: "en", transcriptId: null, capturedAt: null } })).toEqual([]);
  });

  it("packages candidates with transcript lineage in a ClipSet", () => {
    const clipSet = generateClipSet({
      sourceId: "source-2",
      durationMs: 10_000,
      provenance: { source: "transcript_service", provider: "ASR", modelVersion: "model-v4", language: "en", transcriptId: "transcript-v4", capturedAt: null },
      words: [
        { id: "1", startMs: 0, endMs: 2_000, text: "A useful idea.", speaker: "host", confidence: 0.95 },
      ],
    }, { minimumDurationMs: 1_000 });

    expect(clipSet.id).toBe("clip-set-source-2");
    expect(clipSet.transcriptVersion).toBe("transcript-v4");
    expect(clipSet.generatedBy).toBe("transcript-model");
    expect(clipSet.candidates[0]?.sourceId).toBe("source-2");
  });
});
