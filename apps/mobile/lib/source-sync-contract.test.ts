import { describe, expect, it } from "vitest";

import { parseWorkspaceSources, reconcileWorkspaceSources } from "./source-sync-contract";

describe("workspace source synchronization", () => {
  const remote = { data: [{ id: "video-1", title: "Server source", originalFilename: "server.mov", mimeType: "video/quicktime", fileSizeBytes: "1024", status: "ready", createdAt: "2026-08-26T00:00:00.000Z" }] };

  it("parses JSON-safe server records without accepting unsafe sizes or states", () => {
    expect(parseWorkspaceSources(remote)[0]).toMatchObject({ id: "video-1", size: 1024, status: "ready" });
    expect(() => parseWorkspaceSources({ data: [{ ...remote.data[0], status: "unknown" }] })).toThrow(/incomplete/i);
  });

  it("keeps a device-backed source and its local identity when the matching server record arrives", () => {
    const current = [{ id: "local-1", serverVideoId: "video-1", uri: "file:///source.mov", name: "Local source", mimeType: "video/quicktime", size: 20, durationMs: 5000, origin: "library" as const, importedAt: "2026-01-01T00:00:00.000Z", status: "processing" as const }];
    const reconciled = reconcileWorkspaceSources(current, parseWorkspaceSources(remote));
    expect(reconciled[0]).toMatchObject({ id: "local-1", uri: "file:///source.mov", name: "Server source", status: "ready" });
  });

  it("retains a device-only draft when the workspace refresh contains no matching server source", () => {
    const localOnly = [{ id: "local-draft", uri: "file:///draft.mov", name: "Draft", mimeType: "video/mp4", size: 12, durationMs: null, origin: "files" as const, importedAt: "2026-01-01T00:00:00.000Z", status: "ready_to_queue" as const }];
    const reconciled = reconcileWorkspaceSources(localOnly, parseWorkspaceSources(remote));
    expect(reconciled).toEqual(expect.arrayContaining([expect.objectContaining({ id: "local-draft", uri: "file:///draft.mov", status: "ready_to_queue" })]));
  });
});
