import { describe, expect, it } from "vitest";

import { formatMetric, parseSourceAnalytics } from "./analytics-contract";

describe("source analytics contract", () => {
  const data = { totalViews: 2100, totalLikes: 180, totalComments: 15, totalShares: 31, totalSaves: 9, totalReach: 1600, totalImpressions: 2300 };

  it("accepts complete non-negative server aggregates", () => {
    expect(parseSourceAnalytics({ data })).toEqual(data);
    expect(formatMetric(2100)).toBe("2.1K");
  });

  it("rejects incomplete aggregates instead of replacing them with placeholders", () => {
    expect(() => parseSourceAnalytics({ data: { totalViews: 1 } })).toThrow(/incomplete/i);
  });
});
