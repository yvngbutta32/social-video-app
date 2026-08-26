import { describe, expect, it } from "vitest";

import { adaptationRenderLifecycle } from "./render-lifecycle";

const base = { variantId: "variant-1", platform: "tiktok", renderState: "creator_recipe_render_queued", errorMessage: null, recipe: null, safeguards: [] };

describe("adaptation render lifecycle", () => {
  it("distinguishes a queued render from a current artifact", () => {
    expect(adaptationRenderLifecycle({ ...base, status: "pending", artifact: null }).label).toMatch(/queued/i);
    expect(adaptationRenderLifecycle({ ...base, status: "ready", renderState: "processor_variant_ready", artifact: { state: "current_recipe_rendered", completedAt: null } }).canPreview).toBe(true);
  });

  it("reports failed rendering without pretending an artifact exists", () => {
    const lifecycle = adaptationRenderLifecycle({ ...base, status: "failed", artifact: null, errorMessage: "A safe server error." });
    expect(lifecycle).toMatchObject({ tone: "attention", canPreview: false });
  });
});
