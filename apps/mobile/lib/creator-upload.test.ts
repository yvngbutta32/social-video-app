import { describe, expect, it } from "vitest";

import { parseUploadReceipt, sourceUploadTitle } from "./upload-contract";

describe("creator upload contract", () => {
  it("creates a compact server-safe title from a selected filename", () => {
    expect(sourceUploadTitle({ name: "Launch idea.mov" })).toBe("Launch idea");
  });

  it("accepts a confirmed server upload receipt and rejects incomplete data", () => {
    expect(parseUploadReceipt({ data: { id: "video-1", status: "uploading" } })).toEqual({ id: "video-1", status: "uploading" });
    expect(() => parseUploadReceipt({ data: { status: "uploading" } })).toThrow(/incomplete/i);
  });
});
