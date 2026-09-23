import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editLab = readFileSync(resolve(process.cwd(), "app/edit-lab.tsx"), "utf8");
const captionQualityCard = readFileSync(resolve(process.cwd(), "components/caption-quality-card.tsx"), "utf8");
const clipCandidateReviewCard = readFileSync(resolve(process.cwd(), "components/clip-candidate-review-card.tsx"), "utf8");

describe("Edit Lab precision timeline contract", () => {
  it("keeps creator-visible precision nudges and safeguards the saved trim recipe", () => {
    expect(editLab).toContain("Precision timeline");
    expect(editLab).toContain("nudgeTrimRange(currentTrim, \"start\", -0.5)");
    expect(editLab).toContain("nudgeTrimRange(currentTrim, \"end\", 0.5)");
    expect(editLab).toContain('accessibilityLabel="Move trim start earlier by half a second"');
    expect(editLab).toContain('accessibilityLabel="Move trim end later by half a second"');
    expect(editLab).toContain("const recipeToSave = { ...recipe, ...normalizeTrimRange(recipe) };");
  });

  it("surfaces deterministic caption readability guidance without claiming compliance", () => {
    expect(editLab).toContain("auditTimedCaptionTrack");
    expect(editLab).toContain("CaptionQualityCard");
    expect(captionQualityCard).toContain("Editorial guidance only");
  });

  it("surfaces clip review only from real ClipSets and explains the transcript boundary", () => {
    expect(editLab).toContain("<ClipCandidateReviewCard clipSet={clipSet}");
    expect(editLab).toContain("getClipCandidates");
    expect(clipCandidateReviewCard).toContain("Clip discovery is not ready");
    expect(clipCandidateReviewCard).toContain("will not invent highlights");
    expect(clipCandidateReviewCard).toContain("candidateEvidenceSummary");
    expect(clipCandidateReviewCard).toContain("Accept");
    expect(clipCandidateReviewCard).toContain("Reject");
  });
});
