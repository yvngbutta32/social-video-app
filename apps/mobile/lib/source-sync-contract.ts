import type { MobileSource, SourceStatus } from "@/lib/creator-workflow";

export type WorkspaceSourceSummary = {
  id: string;
  name: string;
  originalFilename: string | null;
  mimeType: string | null;
  size: number | null;
  status: SourceStatus;
  createdAt: string;
};

const allowedStatus: SourceStatus[] = ["uploading", "processing", "ready", "failed", "archived"];

function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function string(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function safeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function parseWorkspaceSources(payload: unknown): WorkspaceSourceSummary[] {
  const data = object(payload)?.data;
  if (!Array.isArray(data)) throw new Error("The workspace source list was incomplete. Refresh after the private workspace is available.");
  return data.map((entry) => {
    const item = object(entry);
    const id = string(item?.id);
    const title = string(item?.title);
    const originalFilename = string(item?.originalFilename);
    const status = string(item?.status) as SourceStatus | null;
    const createdAt = string(item?.createdAt);
    if (!id || !title || !status || !allowedStatus.includes(status) || !createdAt) throw new Error("A workspace source was incomplete. Refresh after the private workspace is available.");
    return { id, name: title, originalFilename, mimeType: string(item?.mimeType), size: safeNumber(item?.fileSizeBytes), status, createdAt };
  });
}

export function reconcileWorkspaceSources(existing: MobileSource[], remote: WorkspaceSourceSummary[]): MobileSource[] {
  const byServerId = new Map(existing.filter((source) => source.serverVideoId).map((source) => [source.serverVideoId!, source]));
  const remoteSources = remote.map((record): MobileSource => {
    const current = byServerId.get(record.id);
    if (current) {
      return { ...current, name: record.name, mimeType: record.mimeType, size: record.size, status: record.status, importedAt: record.createdAt, uploadError: record.status === "failed" ? current.uploadError : undefined };
    }
    return { id: `server-${record.id}`, serverVideoId: record.id, uri: null, name: record.name, mimeType: record.mimeType, size: record.size, durationMs: null, origin: "workspace", importedAt: record.createdAt, status: record.status };
  });
  const remoteIds = new Set(remote.map((source) => source.id));
  const deviceOnly = existing.filter((source) => !source.serverVideoId || !remoteIds.has(source.serverVideoId));
  return [...remoteSources, ...deviceOnly];
}
