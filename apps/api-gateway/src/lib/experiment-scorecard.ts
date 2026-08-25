export type ScorecardObjective = 'views' | 'engagement' | 'followers' | 'retention';

type MetricPoint = {
  scheduledPostId: string;
  variantId?: string | null;
  platform?: string;
  recordedAt?: Date | string;
  views?: number | bigint | { toString(): string } | null;
  likes?: number | bigint | { toString(): string } | null;
  comments?: number | bigint | { toString(): string } | null;
  shares?: number | bigint | { toString(): string } | null;
  saves?: number | bigint | { toString(): string } | null;
  followerGain?: number | null;
  completionRate?: number | { toString(): string } | null;
};

function numberValue(value: MetricPoint[keyof MetricPoint]) {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function objectiveValue(metric: MetricPoint, objective: ScorecardObjective) {
  if (objective === 'engagement') return ['likes', 'comments', 'shares', 'saves'].reduce((sum, key) => sum + numberValue(metric[key as keyof MetricPoint]), 0);
  if (objective === 'followers') return numberValue(metric.followerGain);
  if (objective === 'retention') return numberValue(metric.completionRate);
  return numberValue(metric.views);
}

const MINIMUM_VARIANT_SAMPLE = 3;
const MINIMUM_BASELINE_SAMPLE = 5;

export function buildExperimentScorecard(input: {
  objective: ScorecardObjective;
  variants: Array<{ id: string; platform: string; metrics: MetricPoint[] }>;
  baseline: MetricPoint[];
}) {
  const latestByPost = new Map<string, MetricPoint>();
  for (const metric of [...input.baseline].sort((a, b) => new Date(a.recordedAt ?? 0).getTime() - new Date(b.recordedAt ?? 0).getTime())) latestByPost.set(metric.scheduledPostId, metric);
  const baselineValues = [...latestByPost.values()].map((metric) => objectiveValue(metric, input.objective));
  const baseline = baselineValues.length ? baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length : null;

  const variants = input.variants.map((variant) => {
    const latestVariantByPost = new Map<string, MetricPoint>();
    for (const metric of [...variant.metrics].sort((a, b) => new Date(a.recordedAt ?? 0).getTime() - new Date(b.recordedAt ?? 0).getTime())) latestVariantByPost.set(metric.scheduledPostId, metric);
    const values = [...latestVariantByPost.values()].map((metric) => objectiveValue(metric, input.objective));
    const observed = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const relativeLift = baseline && observed !== null ? (observed - baseline) / baseline : null;
    const state = values.length === 0 ? 'awaiting_metrics' : baseline === null ? 'needs_baseline' : 'measuring';
    return { variantId: variant.id, platform: variant.platform, sampleSize: values.length, observed, relativeLift, state, canDeclareWinner: values.length >= MINIMUM_VARIANT_SAMPLE && baselineValues.length >= MINIMUM_BASELINE_SAMPLE };
  });

  return {
    objective: input.objective,
    baseline,
    baselineSampleSize: baselineValues.length,
    variants,
    decisionState: variants.every((variant) => variant.sampleSize === 0) ? 'awaiting_metrics' : baseline === null ? 'needs_baseline' : 'measuring',
    evidenceQuality: baselineValues.length < MINIMUM_BASELINE_SAMPLE || variants.some((variant) => variant.sampleSize < MINIMUM_VARIANT_SAMPLE) ? 'directional_only' : 'decision_ready_for_review',
    canDeclareWinner: baselineValues.length >= MINIMUM_BASELINE_SAMPLE && variants.length > 0 && variants.every((variant) => variant.canDeclareWinner),
    safeguards: [
      `A decision requires at least ${MINIMUM_VARIANT_SAMPLE} observations per variant and ${MINIMUM_BASELINE_SAMPLE} baseline observations.`,
      'Scores use the latest recorded point per scheduled post to avoid double-counting snapshots.',
      'A relative lift is not causal proof and does not guarantee future performance.',
      'Continue collecting until the learning evaluator confirms a sufficient sample.',
    ],
  };
}
