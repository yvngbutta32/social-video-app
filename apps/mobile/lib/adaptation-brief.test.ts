import { describe, expect, it } from "vitest";

import { ADAPTATION_BRIEF_MAX_LENGTH, normalizeAdaptationBrief } from "./adaptation-brief";

describe("creator adaptation brief", () => {
  it("normalizes editable creator direction without inventing a brief", () => {
    expect(normalizeAdaptationBrief("  keep the tone direct\n and practical  ")).toBe("keep the tone direct and practical");
    expect(normalizeAdaptationBrief(undefined)).toBe("");
  });

  it("bounds persisted creator direction", () => {
    expect(normalizeAdaptationBrief("x".repeat(ADAPTATION_BRIEF_MAX_LENGTH + 20))).toHaveLength(ADAPTATION_BRIEF_MAX_LENGTH);
  });
});
