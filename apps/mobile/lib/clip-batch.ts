import type { CreatorTargetPlatform } from "./creator-workflow-types";
import { normalizeClipRange, type ClipCandidate, type ClipSourceRange } from "./clipping-contract";

export const clipBatchRenderStates = ["not_queued", "queued", "rendering", "ready", "failed"] as const;
export type ClipBatchRenderState = (typeof clipBatchRenderStates)[number];

export type ClipBatchItem = {
  id: string;
  candidateId: string;
  sourceId: string;
  platform: CreatorTargetPlatform;
  range: ClipSourceRange;
  title: string;
  revision: number;
  renderState: ClipBatchRenderState;
  artifactId: string | null;
  acceptedAt: string | null;
};

export type ClipBatchPlan = {
  id: string;
  sourceId: string;
  revision: number;
  items: ClipBatchItem[];
};

const clean = (value: string | null | undefined, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;
const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value as number : fallback;

export function normalizeClipBatchPlan(plan: ClipBatchPlan | null | undefined, maximumSeconds: number): ClipBatchPlan | null {
  if (!plan) return null;
  const sourceId = clean(plan.sourceId, "unselected");
  const items = Array.isArray(plan.items) ? plan.items.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<ClipBatchItem>;
    const candidateId = clean(item.candidateId, `candidate-${index + 1}`);
    const platform = item.platform === "instagram" || item.platform === "youtube" || item.platform === "linkedin" ? item.platform : "tiktok";
    const renderState = clipBatchRenderStates.includes(item.renderState as ClipBatchRenderState) ? item.renderState as ClipBatchRenderState : "not_queued";
    return [{
      id: clean(item.id, `batch-item-${candidateId}-${platform}`),
      candidateId,
      sourceId: clean(item.sourceId, sourceId),
      platform,
      range: normalizeClipRange(item.range ?? { trimStartSeconds: 0, trimEndSeconds: 3 }, maximumSeconds),
      title: clean(item.title, "Untitled clip"),
      revision: Math.max(1, Math.floor(finite(item.revision, 1))),
      renderState,
      artifactId: clean(item.artifactId, "") || null,
      acceptedAt: clean(item.acceptedAt, "") || null,
    } satisfies ClipBatchItem];
  }) : [];
  return {
    id: clean(plan.id, `clip-batch-${sourceId}`),
    sourceId,
    revision: Math.max(1, Math.floor(finite(plan.revision, 1))),
    items,
  };
}

export function upsertClipBatchItem(
  plan: ClipBatchPlan | null | undefined,
  sourceId: string,
  candidate: ClipCandidate,
  platform: CreatorTargetPlatform,
  maximumSeconds: number,
  acceptedAt: string | null = null,
): ClipBatchPlan {
  const current = normalizeClipBatchPlan(plan, maximumSeconds) ?? { id: `clip-batch-${sourceId}`, sourceId, revision: 1, items: [] };
  const itemId = `batch-item-${candidate.id}-${platform}`;
  const existing = current.items.find((item) => item.id === itemId);
  const item: ClipBatchItem = {
    id: itemId,
    candidateId: candidate.id,
    sourceId,
    platform,
    range: normalizeClipRange(candidate.range, maximumSeconds),
    title: candidate.title,
    revision: existing ? existing.revision + 1 : 1,
    renderState: existing?.renderState === "ready" ? "ready" : "not_queued",
    artifactId: existing?.artifactId ?? null,
    acceptedAt: existing?.acceptedAt ?? acceptedAt,
  };
  return {
    ...current,
    sourceId,
    revision: current.revision + (existing ? 1 : 0),
    items: [...current.items.filter((entry) => entry.id !== itemId), item],
  };
}

export function removeClipBatchItem(plan: ClipBatchPlan | null | undefined, itemId: string, maximumSeconds: number) {
  const current = normalizeClipBatchPlan(plan, maximumSeconds);
  if (!current) return null;
  const items = current.items.filter((item) => item.id !== itemId);
  return items.length ? { ...current, revision: current.revision + 1, items } : null;
}

export function clipBatchSummary(plan: ClipBatchPlan | null | undefined) {
  const items = plan?.items ?? [];
  return {
    total: items.length,
    readyToRender: items.filter((item) => item.renderState === "not_queued").length,
    rendering: items.filter((item) => item.renderState === "queued" || item.renderState === "rendering").length,
    completed: items.filter((item) => item.renderState === "ready").length,
    failed: items.filter((item) => item.renderState === "failed").length,
  };
}
