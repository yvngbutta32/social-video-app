export type RetryPolicy = {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
};

export type RetryDecision = {
  retryable: boolean;
  exhausted: boolean;
  nextDelayMs: number | null;
  reason: string;
};

export function decideRetry(input: {
  retryCount: number;
  responseStatus?: number | null;
  policy?: Partial<RetryPolicy>;
}): RetryDecision {
  const policy: RetryPolicy = {
    maxRetries: Math.max(0, Math.min(10, input.policy?.maxRetries ?? 3)),
    initialDelayMs: Math.max(1000, input.policy?.initialDelayMs ?? 1000),
    backoffMultiplier: Math.max(1, input.policy?.backoffMultiplier ?? 2),
  };
  const status = input.responseStatus ?? 0;
  const retryableStatus = status === 0 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
  const exhausted = input.retryCount >= policy.maxRetries;

  if (exhausted) {
    return { retryable: false, exhausted: true, nextDelayMs: null, reason: 'Retry budget exhausted; preserve the failure for review.' };
  }
  if (!retryableStatus) {
    return { retryable: false, exhausted: false, nextDelayMs: null, reason: 'The destination returned a non-retryable response. Correct the request or destination before retrying.' };
  }

  const nextDelayMs = Math.round(policy.initialDelayMs * Math.pow(policy.backoffMultiplier, input.retryCount));
  return { retryable: true, exhausted: false, nextDelayMs, reason: 'The failure is transient or rate-limited and may be retried within the configured budget.' };
}

export function assessCreatorWorkflowReadiness(input: {
  sourceStatus: 'uploading' | 'processing' | 'ready' | 'failed' | 'archived';
  connectedDestinations: number;
  preparedVariants: number;
  failedVariants: number;
  scheduledPosts: Array<{ status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed' | 'cancelled'; retryCount: number; errorMessage?: string | null }>;
}) {
  const failures = input.scheduledPosts.filter((post) => post.status === 'failed');
  const activePosts = input.scheduledPosts.filter((post) => ['scheduled', 'posting', 'posted'].includes(post.status));
  const reasons: string[] = [];

  if (input.sourceStatus !== 'ready') reasons.push('The source video must finish processing before creator experiments can be prepared.');
  if (input.connectedDestinations === 0) reasons.push('Connect at least one creator-owned destination before preparing a launch plan.');
  if (input.failedVariants > 0) reasons.push(`${input.failedVariants} prepared version${input.failedVariants === 1 ? '' : 's'} need attention before launch.`);
  if (failures.length > 0) reasons.push(`${failures.length} publishing job${failures.length === 1 ? '' : 's'} failed and remains visible for recovery.`);

  const state = reasons.length > 0
    ? 'attention_required'
    : input.preparedVariants === 0
      ? 'ready_for_experiment_plan'
      : activePosts.length === 0
        ? 'ready_for_creator_approval'
        : 'operating';

  return {
    state,
    sourceReady: input.sourceStatus === 'ready',
    connectedDestinations: input.connectedDestinations,
    preparedVariants: input.preparedVariants,
    activePosts: activePosts.length,
    failedPosts: failures.length,
    reasons,
    safeguards: [
      'Readiness reports operational state; it does not predict or guarantee content distribution.',
      'Failed delivery attempts remain visible instead of being silently discarded.',
      'The creator must approve content before any publishing workflow is activated.',
    ],
  };
}
