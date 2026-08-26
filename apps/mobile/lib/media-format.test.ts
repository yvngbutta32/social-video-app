import { describe, expect, it } from "vitest";

import { formatBytes, formatDuration } from "./media-format";

describe("creator media formatting", () => {
  it("formats known video sizes without inventing an unavailable size", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(null)).toBe("Size unavailable");
  });

  it("formats local durations and keeps unknown durations explicit", () => {
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(null)).toBe("Duration will be checked privately");
  });
});
