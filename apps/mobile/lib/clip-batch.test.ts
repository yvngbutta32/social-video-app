import { describe, expect, it } from "vitest";

import { clipBatchSummary, normalizeClipBatchPlan, removeClipBatchItem, upsertClipBatchItem } from "./clip-batch";
import { normalizeClipCandidate } from "./clipping-contract";

describe("clip batch plan", () => {
  const candidate = normalizeClipCandidate({
    id: "candidate-1",
    sourceId: "source-1",
    range: { trimStartSeconds: 4, trimEndSeconds: 14 },
    title: "A useful moment",
    summary: "A complete thought with a clean ending.",
    signals: { completeThought: 1, cleanEnd: 1 },
  }, 60);

  it("creates independent platform-specific recipe items from one candidate", () => {
    const tiktok = upsertClipBatchItem(null, "source-1", candidate, "tiktok", 60);
    const instagram = upsertClipBatchItem(tiktok, "source-1", candidate, "instagram", 60);
    expect(instagram.items).toHaveLength(2);
    expect(instagram.items.map((item) => item.platform)).toEqual(["tiktok", "instagram"]);
    expect(instagram.items.every((item) => item.candidateId === "candidate-1")).toBe(true);
    expect(instagram.items.every((item) => item.renderState === "not_queued")).toBe(true);
  });

  it("updates one existing item without mutating other platform recipes", () => {
    const initial = upsertClipBatchItem(upsertClipBatchItem(null, "source-1", candidate, "tiktok", 60), "source-1", candidate, "instagram", 60);
    const revisedCandidate = normalizeClipCandidate({ ...candidate, title: "Revised moment", range: { trimStartSeconds: 5, trimEndSeconds: 16 } }, 60);
    const revised = upsertClipBatchItem(initial, "source-1", revisedCandidate, "tiktok", 60);
    expect(revised.items.find((item) => item.platform === "tiktok")?.title).toBe("Revised moment");
    expect(revised.items.find((item) => item.platform === "instagram")?.title).toBe("A useful moment");
    expect(revised.items.find((item) => item.platform === "tiktok")?.revision).toBe(2);
  });

  it("removes an item and reports truthful batch counts", () => {
    const plan = upsertClipBatchItem(null, "source-1", candidate, "tiktok", 60);
    const normalized = normalizeClipBatchPlan({ ...plan, items: [{ ...plan.items[0], renderState: "queued" }] }, 60);
    expect(clipBatchSummary(normalized)).toEqual({ total: 1, readyToRender: 0, rendering: 1, completed: 0, failed: 0 });
    expect(removeClipBatchItem(normalized, normalized?.items[0].id ?? "", 60)).toBeNull();
  });
});
