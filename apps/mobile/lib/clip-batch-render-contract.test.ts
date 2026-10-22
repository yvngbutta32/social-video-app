import { describe, expect, it } from "vitest";

import { applyClipBatchRenderResponse, parseClipBatchRenderResponse } from "./clip-batch-render-contract";
import type { ClipBatchPlan } from "./clip-batch";

describe("clip batch render contract", () => {
  const plan: ClipBatchPlan = {
    id: "plan-1",
    sourceId: "source-1",
    revision: 2,
    items: [
      { id: "item-1", candidateId: "candidate-1", sourceId: "source-1", platform: "tiktok", range: { trimStartSeconds: 0, trimEndSeconds: 8 }, title: "Opening", revision: 2, renderState: "not_queued", artifactId: null, renderJobId: null, errorMessage: null, acceptedAt: "2026-10-22T00:00:00.000Z" },
      { id: "item-2", candidateId: "candidate-2", sourceId: "source-1", platform: "youtube", range: { trimStartSeconds: 10, trimEndSeconds: 20 }, title: "Second beat", revision: 1, renderState: "not_queued", artifactId: null, renderJobId: null, errorMessage: null, acceptedAt: "2026-10-22T00:00:00.000Z" },
    ],
  };

  it("parses and normalizes mixed server results", () => {
    const response = parseClipBatchRenderResponse({ data: { videoId: "video-1", planId: "plan-1", items: [
      { batchItemId: "item-1", variantId: "variant-1", revision: 2, status: "queued", jobId: "job-1" },
      { batchItemId: "item-2", variantId: null, revision: 1, status: "failed", errorMessage: "Redis unavailable" },
    ], summary: { total: 2, queued: 1, ready: 0, failed: 1 }, nextStep: "Retry failed items." } });
    expect(response.items[0]?.status).toBe("queued");
    expect(response.items[1]?.errorMessage).toBe("Redis unavailable");
  });

  it("reconciles only returned revisions and preserves independent item state", () => {
    const response = parseClipBatchRenderResponse({ data: { videoId: "video-1", planId: "plan-1", items: [
      { batchItemId: "item-1", variantId: "variant-1", revision: 2, status: "queued", jobId: "job-1" },
      { batchItemId: "item-2", variantId: null, revision: 1, status: "failed", errorMessage: "Processor unavailable" },
    ] } });
    const next = applyClipBatchRenderResponse(plan, response, 60);
    expect(next.items[0]).toMatchObject({ renderState: "queued", artifactId: "variant-1", renderJobId: "job-1" });
    expect(next.items[1]).toMatchObject({ renderState: "failed", errorMessage: "Processor unavailable" });
  });

  it("does not apply stale server results to a newer local revision", () => {
    const response = parseClipBatchRenderResponse({ data: { videoId: "video-1", planId: "plan-1", items: [{ batchItemId: "item-1", variantId: "variant-old", revision: 1, status: "ready" }] } });
    const next = applyClipBatchRenderResponse(plan, response, 60);
    expect(next.items[0]?.renderState).toBe("not_queued");
    expect(next.items[0]?.artifactId).toBeNull();
  });
});
