import { describe, expect, it } from "vitest";

import { deriveCreatorFlowNextStep, sourceProgressLabel } from "./creator-flow-next-step";

describe("creator flow next step", () => {
  it("guides a creator from import through selected-platform adaptation without implying a publish action", () => {
    expect(deriveCreatorFlowNextStep(null, 0)).toMatchObject({ stage: "import", action: "import", actionLabel: "Add source" });
    expect(deriveCreatorFlowNextStep({ status: "ready_to_queue", serverVideoId: undefined }, 0)).toMatchObject({ stage: "upload", action: "library" });
    expect(deriveCreatorFlowNextStep({ status: "ready", serverVideoId: "video-1" }, 0)).toMatchObject({ stage: "adapt", action: "review", actionLabel: "Choose platforms" });
    const review = deriveCreatorFlowNextStep({ status: "ready", serverVideoId: "video-1" }, 2);
    expect(review).toMatchObject({ stage: "review", action: "review", actionLabel: "Review adaptations" });
    expect(review.detail).toMatch(/Creator review remains required/i);
    expect(review.detail).not.toMatch(/publish/i);
  });

  it("keeps failed, processing, and archived sources in truthful recovery-oriented states", () => {
    expect(deriveCreatorFlowNextStep({ status: "failed", serverVideoId: "video-1" }, 1)).toMatchObject({ stage: "recover", actionLabel: "Recover source" });
    expect(deriveCreatorFlowNextStep({ status: "processing", serverVideoId: "video-1" }, 1)).toMatchObject({ stage: "processing", action: "processing" });
    expect(deriveCreatorFlowNextStep({ status: "archived", serverVideoId: "video-1" }, 1)).toMatchObject({ stage: "recover", action: "library" });
  });

  it("uses actual source and selected-target state in the Home status labels", () => {
    expect(sourceProgressLabel({ status: "ready" }, 0)).toEqual({ label: "READY TO ADAPT", tone: "ready" });
    expect(sourceProgressLabel({ status: "ready" }, 2)).toEqual({ label: "2 TARGETS SET", tone: "ready" });
    expect(sourceProgressLabel({ status: "ready_to_queue" }, 0)).toEqual({ label: "UPLOAD REQUIRED", tone: "muted" });
  });
});
