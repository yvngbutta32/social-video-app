import { describe, expect, it } from "vitest";

import { localRecipeToManualEdit, serverRecipeToLocalRecipe } from "./edit-sync-contract";

const local = { sourceId: "source-1", trimStartSeconds: 1, trimEndSeconds: 14, composition: "blur_background" as const, focalX: 0.4, focalY: 0.6, headline: "  A careful hook  ", captionsEnabled: true, normalizeAudio: true, revision: 2 };

describe("native edit synchronization", () => {
  it("maps local controls to the narrow server-supported edit payload", () => {
    expect(localRecipeToManualEdit(local)).toEqual({ sourceRange: { startSeconds: 1, endSeconds: 14 }, composition: { mode: "blur_bg", focalPoint: { x: 0.4, y: 0.6 }, showSafeZones: true }, captions: { enabled: true, style: "clean" }, headline: "A careful hook", audio: { normalize: true } });
  });

  it("keeps local representation while applying the server-authoritative revision", () => {
    const recipe = serverRecipeToLocalRecipe("source-1", { sourceRange: { startSeconds: 2, endSeconds: 12 }, composition: { mode: "smart_fill", focalPoint: null }, captions: { enabled: false, style: "off" }, headline: null, audio: { normalize: false }, provenance: { revision: 3 } }, local);
    expect(recipe).toMatchObject({ composition: "smart_crop", headline: "", revision: 3, focalX: 0.4, focalY: 0.6 });
  });
});
