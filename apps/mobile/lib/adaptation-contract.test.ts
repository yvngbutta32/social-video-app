import { describe, expect, it } from "vitest";

import { artifactStateLabel, parseAdaptationDetail, parseAdaptationPlan, parseAdaptationSave, parsePrivateArtifactPreview } from "./adaptation-contract";

describe("native adaptation contracts", () => {
  it("accepts a complete server-authorized adaptation plan", () => {
    const plan = parseAdaptationPlan({ data: { sourceVideoId: "source-1", objective: "retention", creatorBrief: "Keep it practical", experiments: [{ variantId: "variant-1", platform: "tiktok", hook: "A concise hook", caption: "A careful caption", aspectRatio: "9:16", availability: "variant_rendering_required", destination: null }], missingPlatforms: [], nextStep: "Review it.", safeguards: ["Creator approval required."] } });
    expect(plan.experiments[0].variantId).toBe("variant-1");
    expect(plan.creatorBrief).toBe("Keep it practical");
  });

  it("distinguishes a current rendered artifact from a missing artifact", () => {
    const detail = parseAdaptationDetail({ data: { variantId: "variant-1", platform: "tiktok", status: "ready", artifact: { state: "current_recipe_rendered", completedAt: "2026-08-26T00:00:00.000Z" }, renderState: "processor_variant_ready", errorMessage: null, safeguards: [] } });
    expect(artifactStateLabel(detail.artifact)).toMatch(/ready/i);
    expect(artifactStateLabel(null)).toMatch(/no private artifact/i);
  });

  it("accepts only complete short-lived private preview data", () => {
    expect(parsePrivateArtifactPreview({ data: { kind: "video", url: "https://private.example/video", expiresAt: "2026-08-26T00:05:00.000Z", safeguards: [] } }).kind).toBe("video");
    expect(() => parsePrivateArtifactPreview({ data: { kind: "video" } })).toThrow(/incomplete/i);
  });

  it("accepts a server-saved non-destructive recipe only when its revision is complete", () => {
    const recipe = { sourceRange: { startSeconds: 0, endSeconds: 12 }, composition: { mode: "smart_crop", focalPoint: { x: 0.5, y: 0.5 } }, captions: { enabled: true, style: "clean" }, headline: "Careful hook", headlinePlacement: "center_safe", audio: { normalize: true }, provenance: { revision: 2 } };
    expect(parseAdaptationSave({ data: { variantId: "variant-1", status: "pending", recipe, renderState: "creator_recipe_render_queued", nextStep: "Review later." } }).recipe.provenance.revision).toBe(2);
  });
});
