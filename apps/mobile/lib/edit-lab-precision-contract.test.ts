import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editLab = readFileSync(resolve(process.cwd(), "app/edit-lab.tsx"), "utf8");

describe("Edit Lab precision timeline contract", () => {
  it("keeps creator-visible precision nudges and safeguards the saved trim recipe", () => {
    expect(editLab).toContain("Precision timeline");
    expect(editLab).toContain("nudgeTrimRange(currentTrim, \"start\", -0.5)");
    expect(editLab).toContain("nudgeTrimRange(currentTrim, \"end\", 0.5)");
    expect(editLab).toContain('accessibilityLabel="Move trim start earlier by half a second"');
    expect(editLab).toContain('accessibilityLabel="Move trim end later by half a second"');
    expect(editLab).toContain("const recipeToSave = { ...recipe, ...normalizeTrimRange(recipe) };");
  });
});
