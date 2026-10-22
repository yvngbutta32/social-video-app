import { normalizeClipBatchPlan, type ClipBatchPlan, type ClipBatchRenderState } from "./clip-batch";

export type ClipBatchRenderResult = {
  batchItemId: string;
  variantId: string | null;
  revision: number;
  status: "queued" | "ready" | "failed";
  jobId: string | null;
  errorMessage: string | null;
};

export type ClipBatchRenderResponse = {
  videoId: string;
  planId: string;
  items: ClipBatchRenderResult[];
  summary: { total: number; queued: number; ready: number; failed: number };
  nextStep: string;
};

const clean = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

export function parseClipBatchRenderResponse(value: unknown): ClipBatchRenderResponse {
  const root = value && typeof value === "object" ? value as { data?: unknown } : {};
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : {};
  const items = Array.isArray(data.items) ? data.items.flatMap((raw): ClipBatchRenderResult[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const batchItemId = clean(item.batchItemId);
    const status = item.status === "ready" || item.status === "failed" ? item.status : "queued";
    const revision = typeof item.revision === "number" && Number.isInteger(item.revision) ? Math.max(1, item.revision) : 1;
    return batchItemId ? [{ batchItemId, variantId: clean(item.variantId), revision, status, jobId: clean(item.jobId), errorMessage: clean(item.errorMessage) }] : [];
  }) : [];
  const summary = data.summary && typeof data.summary === "object" ? data.summary as Record<string, unknown> : {};
  return {
    videoId: clean(data.videoId) ?? "unknown-video",
    planId: clean(data.planId) ?? "unknown-plan",
    items,
    summary: {
      total: typeof summary.total === "number" ? summary.total : items.length,
      queued: typeof summary.queued === "number" ? summary.queued : items.filter((item) => item.status === "queued").length,
      ready: typeof summary.ready === "number" ? summary.ready : items.filter((item) => item.status === "ready").length,
      failed: typeof summary.failed === "number" ? summary.failed : items.filter((item) => item.status === "failed").length,
    },
    nextStep: clean(data.nextStep) ?? "Refresh the source to reconcile per-item render states.",
  };
}

function renderStateFor(status: ClipBatchRenderResult["status"]): ClipBatchRenderState {
  return status === "queued" ? "queued" : status;
}

export function applyClipBatchRenderResponse(plan: ClipBatchPlan, response: ClipBatchRenderResponse, maximumSeconds: number): ClipBatchPlan {
  const normalized = normalizeClipBatchPlan(plan, maximumSeconds) ?? plan;
  const byId = new Map(response.items.map((item) => [item.batchItemId, item]));
  return {
    ...normalized,
    items: normalized.items.map((item) => {
      const result = byId.get(item.id);
      if (!result || result.revision < item.revision) return item;
      return {
        ...item,
        revision: result.revision,
        renderState: renderStateFor(result.status),
        artifactId: result.variantId ?? item.artifactId,
        renderJobId: result.jobId ?? item.renderJobId,
        errorMessage: result.errorMessage,
      };
    }),
  };
}
