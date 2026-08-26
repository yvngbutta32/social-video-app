export type SourceAnalytics = {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalReach: number;
  totalImpressions: number;
};

const keys: (keyof SourceAnalytics)[] = ["totalViews", "totalLikes", "totalComments", "totalShares", "totalSaves", "totalReach", "totalImpressions"];

export function parseSourceAnalytics(payload: unknown): SourceAnalytics {
  const source = (payload as { data?: Record<string, unknown> })?.data;
  if (!source) throw new Error("Outcome data is not available for this source yet.");
  const result = {} as SourceAnalytics;
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error("Outcome data is incomplete. Refresh after the connected platform has reported new metrics.");
    }
    result[key] = value;
  }
  return result;
}

export function formatMetric(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
