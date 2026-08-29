import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("native Review accessibility contract", () => {
  it("labels target selection, verified connection status, and private draft refresh actions", async () => {
    const review = await readFile("app/review.tsx", "utf8");
    expect(review).toContain('accessibilityState={{ selected }}');
    expect(review).toContain("Selects or removes this target for a private editable draft");
    expect(review).toContain('accessibilityLabel="Refresh official connection status"');
    expect(review).toContain('accessibilityLiveRegion="polite"');
    expect(review).toContain('accessibilityLabel="Refresh verified adaptation plan"');
    expect(review).toContain("It does not publish content.");
    expect(review).toContain('accessibilityLabel="Creator direction for private adaptation drafts"');
    expect(review).toContain('accessibilityLabel="Save creator direction"');
    expect(review).toContain("It does not instruct a platform, publish, or guarantee an outcome.");
  });
});
