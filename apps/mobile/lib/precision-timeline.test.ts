import { describe, expect, it } from "vitest";

import { formatTimelineTime, minimumTrimDurationSeconds, normalizeTrimRange, nudgeTrimRange, trimDurationSeconds } from "./precision-timeline";

describe("precision timeline", () => {
  it("normalizes invalid and inverted ranges without changing the non-destructive recipe model", () => {
    expect(normalizeTrimRange({ trimStartSeconds: 12, trimEndSeconds: 4 })).toEqual({ trimStartSeconds: 12, trimEndSeconds: 12.5 });
    expect(normalizeTrimRange({ trimStartSeconds: -3, trimEndSeconds: Number.NaN })).toEqual({ trimStartSeconds: 0, trimEndSeconds: 0.5 });
  });

  it("nudges only the requested edge and retains the minimum selectable duration", () => {
    expect(nudgeTrimRange({ trimStartSeconds: 2, trimEndSeconds: 6 }, "start", 1.5)).toEqual({ trimStartSeconds: 3.5, trimEndSeconds: 6 });
    expect(nudgeTrimRange({ trimStartSeconds: 2, trimEndSeconds: 6 }, "end", -20)).toEqual({ trimStartSeconds: 2, trimEndSeconds: 2 + minimumTrimDurationSeconds });
  });

  it("formats creator-facing timing and duration deterministically", () => {
    expect(trimDurationSeconds({ trimStartSeconds: 3, trimEndSeconds: 12.4 })).toBeCloseTo(9.4);
    expect(formatTimelineTime(65.25)).toBe("1:05.3");
  });
});
