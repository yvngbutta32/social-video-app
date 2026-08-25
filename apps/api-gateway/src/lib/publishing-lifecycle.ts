import { decideRetry, type RetryPolicy } from './reliability.js';

export type PublishLifecycleStatus = 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed' | 'cancelled';
export type PublishAttemptStatus = 'queued' | 'attempting' | 'succeeded' | 'retry_scheduled' | 'dead_lettered' | 'cancelled';

export function validateCreatorApproval(input: {
  postStatus: PublishLifecycleStatus;
  sourceReady: boolean;
  variantReady: boolean;
  destinationActive: boolean;
}) {
  const reasons: string[] = [];
  if (input.postStatus !== 'draft') reasons.push('Only a draft creator intent may be approved.');
  if (!input.sourceReady) reasons.push('The source video must be ready before approval.');
  if (!input.variantReady) reasons.push('The selected version must be ready before approval.');
  if (!input.destinationActive) reasons.push('The selected creator-owned destination must be active before approval.');

  return {
    approved: reasons.length === 0,
    reasons,
    safeguards: [
      'Creator approval activates a scheduled workflow; it does not guarantee publishing, feed placement, or reach.',
      'An approved intent still requires a creator-authorized official platform connection at execution time.',
      'The platform owner retains read-only oversight and cannot approve or schedule creator content.',
    ],
  };
}

export function resolvePublishAttemptOutcome(input: {
  retryCountBeforeAttempt: number;
  responseStatus?: number | null;
  policy?: Partial<RetryPolicy>;
  succeeded: boolean;
}) {
  if (input.succeeded) {
    return {
      postStatus: 'posted' as const,
      attemptStatus: 'succeeded' as PublishAttemptStatus,
      nextAttemptAt: null,
      deadLetter: false,
      reason: 'The creator-authorized destination confirmed the delivery.',
    };
  }

  const retry = decideRetry({
    retryCount: input.retryCountBeforeAttempt + 1,
    responseStatus: input.responseStatus,
    policy: input.policy,
  });

  if (retry.retryable && retry.nextDelayMs !== null) {
    return {
      postStatus: 'scheduled' as const,
      attemptStatus: 'retry_scheduled' as PublishAttemptStatus,
      nextAttemptAt: new Date(Date.now() + retry.nextDelayMs),
      deadLetter: false,
      reason: retry.reason,
    };
  }

  return {
    postStatus: 'failed' as const,
    attemptStatus: 'dead_lettered' as PublishAttemptStatus,
    nextAttemptAt: null,
    deadLetter: true,
    reason: retry.reason,
  };
}

export function createAttemptIdempotencyKey(postIdempotencyKey: string, attemptNumber: number) {
  return `${postIdempotencyKey}:attempt:${attemptNumber}`;
}
