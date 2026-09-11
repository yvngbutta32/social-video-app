export type OfficialActionPlatform = 'tiktok' | 'instagram' | 'youtube' | 'linkedin';
export type OfficialActionStatus = 'draft' | 'approved' | 'queued' | 'attempting' | 'succeeded' | 'reconciling' | 'failed' | 'cancelled';

export type OfficialActionRequest = {
  workspaceId: string;
  creatorId: string;
  variantId: string;
  platform: OfficialActionPlatform;
  approvalId: string | null;
  idempotencyKey: string;
  connectorAccountId: string | null;
  artifactFingerprint: string;
  requestedAt: string;
};

export type OfficialActionDecision = {
  allowed: boolean;
  status: OfficialActionStatus;
  reasons: string[];
  safeguards: string[];
};

const keyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const platformSet = new Set<OfficialActionPlatform>(['tiktok', 'instagram', 'youtube', 'linkedin']);

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validates the immutable boundary before a provider adapter is invoked. */
export function decideOfficialAction(input: OfficialActionRequest & {
  creatorApproved: boolean;
  workspaceAuthorized: boolean;
  connectorReady: boolean;
  artifactReady: boolean;
  existingStatus?: OfficialActionStatus | null;
}): OfficialActionDecision {
  const reasons: string[] = [];
  if (!nonEmpty(input.workspaceId) || !nonEmpty(input.creatorId)) reasons.push('A creator and explicit workspace are required.');
  if (!nonEmpty(input.variantId) || !nonEmpty(input.artifactFingerprint)) reasons.push('A selected render artifact is required.');
  if (!platformSet.has(input.platform)) reasons.push('The requested platform is unsupported.');
  if (!keyPattern.test(input.idempotencyKey)) reasons.push('The idempotency key is invalid.');
  if (!input.approvalId || !input.creatorApproved) reasons.push('Explicit creator approval is required.');
  if (!input.workspaceAuthorized) reasons.push('The selected workspace is not authorized for this action.');
  if (!input.connectorAccountId || !input.connectorReady) reasons.push('A creator-authorized official connector is not ready.');
  if (!input.artifactReady) reasons.push('The selected private artifact is not ready.');
  if (input.existingStatus === 'succeeded' || input.existingStatus === 'attempting' || input.existingStatus === 'reconciling') reasons.push('An equivalent action is already in progress or has succeeded.');

  return {
    allowed: reasons.length === 0,
    status: reasons.length === 0 ? 'approved' : (input.existingStatus ?? 'draft'),
    reasons,
    safeguards: [
      'The action may call only a verified official provider connector.',
      'The idempotency key must be persisted and reused across retries.',
      'Provider confirmation and reconciliation are required before success is recorded.',
      'The action does not guarantee feed placement, impressions, followers, or reach.',
    ],
  };
}

export function actionAttemptKey(idempotencyKey: string, attemptNumber: number) {
  if (!keyPattern.test(idempotencyKey) || !Number.isInteger(attemptNumber) || attemptNumber < 1) throw new Error('Invalid official action attempt key input.');
  return `${idempotencyKey}:attempt:${attemptNumber}`;
}

export function isTerminalOfficialActionStatus(status: OfficialActionStatus) {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}
