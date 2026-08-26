import { describe, expect, it } from "vitest";

import { artifactStateLabel, parseAdaptationDetail, parseAdaptationPlan, parsePrivateArtifactPreview } from "./adaptation-contract";

describe("native adaptation contracts", () => {
  it("accepts a complete server-authorized adaptation plan", () => {
    const plan = parseAdaptationPlan({ data: { sourceVideoId: "source-1", objective: "retention", experiments: [{ variantId: "variant-1", platform: "tiktok", hook: "A concise hook", caption: "A careful caption", aspectRatio: "9:16", availability: "variant_rendering_required", destination: null }], missingPlatforms: [], nextStep: "Review it.", safeguards: ["Creator approval required."] } });
    expect(plan.experiments[0].variantId).toBe("variant-1");
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
});
