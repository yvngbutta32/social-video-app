import { actionAttemptKey, decideOfficialAction, isTerminalOfficialActionStatus } from '../src/lib/official-action-contract.js';

const base = {
  workspaceId: 'workspace-1',
  creatorId: 'creator-1',
  variantId: 'variant-1',
  platform: 'youtube' as const,
  approvalId: 'approval-1',
  idempotencyKey: 'publish:variant-1:001',
  connectorAccountId: 'youtube-account-1',
  artifactFingerprint: 'sha256:artifact',
  requestedAt: '2026-09-11T00:00:00.000Z',
  creatorApproved: true,
  workspaceAuthorized: true,
  connectorReady: true,
  artifactReady: true,
};

const allowed = decideOfficialAction(base);
if (!allowed.allowed || allowed.reasons.length !== 0 || !allowed.safeguards.some((item) => item.includes('does not guarantee'))) throw new Error('A fully authorized official action was rejected incorrectly.');

const blocked = decideOfficialAction({ ...base, approvalId: null, creatorApproved: false, connectorReady: false, workspaceAuthorized: false });
if (blocked.allowed || blocked.reasons.length !== 3) throw new Error('Missing approval, connector readiness, and workspace authorization were not blocked.');

for (const existingStatus of ['succeeded', 'attempting', 'reconciling'] as const) {
  const duplicate = decideOfficialAction({ ...base, existingStatus });
  if (duplicate.allowed || !duplicate.reasons.at(-1)?.includes('already in progress or has succeeded')) throw new Error(`Duplicate ${existingStatus} action was not blocked.`);
}

if (actionAttemptKey(base.idempotencyKey, 2) !== 'publish:variant-1:001:attempt:2') throw new Error('Attempt idempotency key was not stable.');
if (!isTerminalOfficialActionStatus('succeeded') || isTerminalOfficialActionStatus('attempting')) throw new Error('Terminal action status classification is incorrect.');
console.log('official action contract passed');
