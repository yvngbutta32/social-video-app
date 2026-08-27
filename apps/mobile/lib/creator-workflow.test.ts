import { describe, expect, it } from "vitest";

import { createDefaultRecipe } from "./creator-workflow";

describe("creator edit recipe defaults", () => {
  it("creates a non-destructive, bounded starter recipe for a selected source", () => {
    const recipe = createDefaultRecipe("source-1");
    expect(recipe.sourceId).toBe("source-1");
    expect(recipe.trimStartSeconds).toBe(0);
    expect(recipe.trimEndSeconds).toBe(30);
    expect(recipe.composition).toBe("smart_crop");
    expect(recipe.focalX).toBeGreaterThanOrEqual(0);
    expect(recipe.focalX).toBeLessThanOrEqual(1);
    expect(recipe.focalY).toBeGreaterThanOrEqual(0);
    expect(recipe.focalY).toBeLessThanOrEqual(1);
    expect(recipe.headlinePlacement).toBe("upper_safe");
    expect(recipe.revision).toBe(1);
  });
});
