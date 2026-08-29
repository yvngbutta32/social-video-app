import { describe, expect, it } from "vitest";

import { parseCreatorState, serializeCreatorState } from "./creator-storage";

describe("creator local state persistence", () => {
  it("round-trips source metadata and non-destructive edit recipes", () => {
    const state = {
      sources: [{ id: "source-1", uri: "file:///clip.mp4", name: "clip.mp4", mimeType: "video/mp4", size: 1024, durationMs: 10000, origin: "library" as const, importedAt: "2026-08-26T00:00:00.000Z", status: "ready_to_queue" as const, adaptationBrief: "Keep it practical" }],
      recipes: { "source-1": { sourceId: "source-1", trimStartSeconds: 0, trimEndSeconds: 10, composition: "smart_crop" as const, focalX: 0.5, focalY: 0.42, headline: "", headlinePlacement: "upper_safe" as const, captionsEnabled: false, normalizeAudio: true, revision: 1 } },
      selectedSourceId: "source-1",
      platformTargets: { "source-1": ["tiktok", "youtube"] as Array<"tiktok" | "youtube"> },
    };
    expect(parseCreatorState(serializeCreatorState(state))).toEqual(state);
  });

  it("refuses malformed cached state instead of restoring unsafe values", () => {
    expect(parseCreatorState("not json")).toBeNull();
    expect(parseCreatorState(JSON.stringify({ sources: {}, recipes: [] }))).toBeNull();
    expect(parseCreatorState(JSON.stringify({ sources: [], recipes: {}, selectedSourceId: null, platformTargets: { "source-1": ["unknown-platform"] } }))?.platformTargets).toEqual({ "source-1": [] });
  });

  it("migrates cached state created before platform targets existed", () => {
    const migrated = parseCreatorState(JSON.stringify({ sources: [], recipes: {}, selectedSourceId: null }));
    expect(migrated?.platformTargets).toEqual({});
  });

  it("migrates cached edit recipes created before headline placement existed", () => {
    const migrated = parseCreatorState(JSON.stringify({ sources: [], recipes: { "source-1": { sourceId: "source-1", trimStartSeconds: 0, trimEndSeconds: 10, composition: "smart_crop", focalX: 0.5, focalY: 0.42, headline: "", captionsEnabled: false, normalizeAudio: true, revision: 1 } }, selectedSourceId: null, platformTargets: {} }));
    expect(migrated?.recipes["source-1"]?.headlinePlacement).toBe("upper_safe");
  });

  it("migrates older source metadata with an empty bounded adaptation brief", () => {
    const migrated = parseCreatorState(JSON.stringify({ sources: [{ id: "source-1", uri: null, name: "clip", mimeType: "video/mp4", size: 1, durationMs: 1, origin: "workspace", importedAt: "2026-08-26T00:00:00.000Z", status: "ready" }], recipes: {}, selectedSourceId: "source-1", platformTargets: {} }));
    expect(migrated?.sources[0]?.adaptationBrief).toBe("");
  });
});
