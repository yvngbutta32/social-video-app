import { describe, expect, it } from "vitest";

import { nextIncompletePart, partRange, readUploadEtag, uniqueCompletedParts } from "./resumable-upload-contract";

describe("resumable creator upload contract", () => {
  it("calculates bounded byte ranges for each source part", () => {
    expect(partRange(1, 8, 19)).toEqual({ start: 0, end: 8 });
    expect(partRange(3, 8, 19)).toEqual({ start: 16, end: 19 });
    expect(() => partRange(4, 8, 19)).toThrow(/outside/i);
  });

  it("normalizes completed parts and finds the safe recovery point", () => {
    expect(uniqueCompletedParts([3, 1, 3, 0, 2])).toEqual([1, 2, 3]);
    expect(nextIncompletePart(4, [1, 3])).toBe(2);
    expect(nextIncompletePart(2, [1, 2])).toBeNull();
  });

  it("requires storage confirmation before marking a part complete", () => {
    expect(readUploadEtag(' "part-tag" ')).toBe('"part-tag"');
    expect(() => readUploadEtag(null)).toThrow(/did not confirm/i);
  });
});
