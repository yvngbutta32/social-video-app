type NumericValue = number | bigint | string | { toString(): string };

export type LearningMetric = {
  views?: NumericValue | null;
  likes?: NumericValue | null;
  comments?: NumericValue | null;
  shares?: NumericValue | null;
  saves?: NumericValue | null;
  followerGain?: NumericValue | null;
  completionRate?: NumericValue | null;
};

export type LearningObjective = 'views' | 'engagement' | 'followers' | 'retention';

function toNumber(value: NumericValue | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'bigint' ? Number(value) : Number(typeof value === 'object' ? value.toString() : value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mean(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function normalizedMetric(metric: LearningMetric, objective: LearningObjective) {
  const views = Math.max(toNumber(metric.views), 1);
  const engagement = (toNumber(metric.likes) + toNumber(metric.comments) + toNumber(metric.shares) + toNumber(metric.saves)) / views;
  const followerRate = toNumber(metric.followerGain) / views;
  const completion = Math.max(0, Math.min(1, toNumber(metric.completionRate)));

  switch (objective) {
    case 'views':
      return Math.log10(views + 1);
    case 'engagement':
      return engagement;
    case 'followers':
      return followerRate;
    case 'retention':
      return completion;
  }
}

export function evaluateLearningSignal(input: {
  objective: LearningObjective;
  experiment: LearningMetric[];
  baseline: LearningMetric[];
  minimumSampleSize?: number;
}) {
  const minimumSampleSize = input.minimumSampleSize ?? 3;
  const experimentValues = input.experiment.map((metric) => normalizedMetric(metric, input.objective));
  const baselineValues = input.baseline.map((metric) => normalizedMetric(metric, input.objective));
  const experimentScore = mean(experimentValues);
  const baselineScore = mean(baselineValues);
  const denominator = Math.max(Math.abs(baselineScore), 0.0001);
  const lift = (experimentScore - baselineScore) / denominator;
  const sufficientSample = experimentValues.length >= minimumSampleSize && baselineValues.length >= minimumSampleSize;
  const confidence = sufficientSample
    ? Math.min(0.95, 0.35 + 0.08 * Math.min(experimentValues.length, baselineValues.length) + Math.min(Math.abs(lift), 0.25))
    : Math.min(0.45, 0.1 + 0.05 * Math.min(experimentValues.length, baselineValues.length));

  const decision = !sufficientSample
    ? 'continue_collecting'
    : lift >= 0.1
      ? 'retain_and_retest'
      : lift <= -0.1
        ? 'revise_hypothesis'
        : 'inconclusive';

  return {
    objective: input.objective,
    experimentSampleSize: experimentValues.length,
    baselineSampleSize: baselineValues.length,
    experimentScore,
    baselineScore,
    relativeLift: lift,
    confidence,
    sufficientSample,
    decision,
    explanation: !sufficientSample
      ? `More evidence is needed before changing the creator strategy. At least ${minimumSampleSize} experiment and baseline observations are required.`
      : decision === 'retain_and_retest'
        ? 'The experiment is outperforming the creator’s recent baseline. Retain the underlying hypothesis and repeat it with one controlled variation.'
        : decision === 'revise_hypothesis'
          ? 'The experiment is underperforming the creator’s recent baseline. Preserve the source insight but revise the opening, proof sequence, or platform treatment.'
          : 'The result is near the creator’s recent baseline. Keep the experiment visible, but do not infer a durable improvement yet.',
    safeguards: [
      'This compares results with the creator’s own historical baseline; it does not claim platform-wide ranking knowledge.',
      'The confidence estimate reflects sample sufficiency and observed effect size, not a guarantee of future performance.',
      'A single post is never treated as proof that a creative strategy will generalize.',
    ],
  };
}
