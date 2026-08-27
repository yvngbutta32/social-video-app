import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editLab = readFileSync(resolve(process.cwd(), "app/edit-lab.tsx"), "utf8");

describe("Edit Lab headline placement contract", () => {
  it("keeps placement explicit, accessible, and limited to the next private render", () => {
    expect(editLab).toContain("const headlinePlacementOptions");
    expect(editLab).toContain('update("headlinePlacement", option.value)');
    expect(editLab).toContain("Applied to the rendered headline overlay, not timed captions.");
    expect(editLab).toContain("This changes the next private render only.");
    expect(editLab).toContain("accessibilityState={{ selected:");
  });
});
