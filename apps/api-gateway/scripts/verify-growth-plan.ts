import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGrowthExperimentPlan } from '../src/lib/growth-plan.js';
import { evaluateLearningSignal } from '../src/lib/growth-learning.js';
import { assessCreatorWorkflowReadiness, decideRetry } from '../src/lib/reliability.js';
import { createAttemptIdempotencyKey, resolvePublishAttemptOutcome, validateCreatorApproval } from '../src/lib/publishing-lifecycle.js';
import { buildReachPlan } from '../src/lib/reach-plan.js';
import { decryptToken, encryptToken } from '../src/lib/token-crypto.js';
import { getPlatformCapability } from '../src/lib/platform-capabilities.js';
import { buildExperimentScorecard } from '../src/lib/experiment-scorecard.js';

async function main() {
  const plan = buildGrowthExperimentPlan({
    sourceTitle: 'How I simplified Monday planning',
    transcript: 'I stopped overcomplicating planning and started protecting one quiet hour for focused work.',
    platforms: ['tiktok', 'instagram', 'youtube'],
    objective: 'retention',
  });

  assert.equal(plan.length, 3);
  assert.deepEqual(plan.map((experiment) => experiment.platform), ['tiktok', 'instagram', 'youtube']);
  assert.equal(new Set(plan.map((experiment) => experiment.platform)).size, plan.length);

  const reachPlan = buildReachPlan({ sourceTitle: 'Source', platforms: ['tiktok', 'instagram', 'youtube'], objective: 'retention', activeDestinations: 2 });
  assert.deepEqual(reachPlan.steps.map((step) => step.type), ['creator_authorized_publish', 'authorized_cross_platform', 'creator_owned_share_loop', 'creator_approved_collaboration', 'evidence_checkpoint']);
  assert(reachPlan.safeguards.some((guardrail) => /fake engagement/i.test(guardrail)));
  assert(reachPlan.safeguards.some((guardrail) => /not guaranteed reach/i.test(guardrail)));

  const encryptedToken = encryptToken('creator-access-token', 'test-encryption-key');
  assert.notEqual(encryptedToken, 'creator-access-token');
  assert.equal(decryptToken(encryptedToken, 'test-encryption-key'), 'creator-access-token');
  assert.equal(getPlatformCapability('tiktok')?.officialPublishing, 'direct_post');
  assert.equal(getPlatformCapability('facebook')?.readiness, 'connector_required');
  const scorecard = buildExperimentScorecard({
    objective: 'retention',
    variants: [{ id: 'variant-1', platform: 'tiktok', metrics: [{ scheduledPostId: 'post-1', completionRate: 0.55, recordedAt: '2026-08-25T10:00:00Z' }, { scheduledPostId: 'post-1', completionRate: 0.65, recordedAt: '2026-08-25T11:00:00Z' }] }],
    baseline: [{ scheduledPostId: 'baseline-1', completionRate: 0.5, recordedAt: '2026-08-25T09:00:00Z' }],
  });
  assert.equal(scorecard.variants[0].sampleSize, 1);
  assert(Math.abs((scorecard.variants[0].relativeLift ?? 0) - 0.3) < 1e-9);
  assert.equal(scorecard.decisionState, 'measuring');
  assert(plan.every((experiment) => experiment.hook.length > 0));
  assert(plan.every((experiment) => experiment.changes.length >= 3));
  assert(plan.every((experiment) => experiment.safeguards.some((guardrail) => /not a guarantee/i.test(guardrail))));
  assert(plan.every((experiment) => experiment.safeguards.some((guardrail) => /creator retains approval/i.test(guardrail))));

  const duplicatePlan = buildGrowthExperimentPlan({
    sourceTitle: 'One idea',
    platforms: ['tiktok', 'tiktok'],
    objective: 'views',
  });
  assert.equal(duplicatePlan.length, 1, 'Duplicate platform requests should produce one controlled experiment');

  const promisingSignal = evaluateLearningSignal({
    objective: 'retention',
    experiment: [
      { views: 900, completionRate: 0.68 },
      { views: 1050, completionRate: 0.72 },
      { views: 1100, completionRate: 0.69 },
    ],
    baseline: [
      { views: 900, completionRate: 0.45 },
      { views: 1050, completionRate: 0.47 },
      { views: 1100, completionRate: 0.46 },
    ],
  });
  assert.equal(promisingSignal.sufficientSample, true);
  assert.equal(promisingSignal.decision, 'retain_and_retest');
  assert(promisingSignal.relativeLift > 0.1);
  assert(promisingSignal.safeguards.some((guardrail) => /not a guarantee/i.test(guardrail)));

  const earlySignal = evaluateLearningSignal({
    objective: 'engagement',
    experiment: [{ views: 100, likes: 20 }],
    baseline: [{ views: 100, likes: 10 }],
  });
  assert.equal(earlySignal.sufficientSample, false);
  assert.equal(earlySignal.decision, 'continue_collecting');

  const readiness = assessCreatorWorkflowReadiness({
    sourceStatus: 'ready',
    connectedDestinations: 2,
    preparedVariants: 3,
    failedVariants: 0,
    scheduledPosts: [],
  });
  assert.equal(readiness.state, 'ready_for_creator_approval');
  assert(readiness.safeguards.some((guardrail) => /silently discarded/i.test(guardrail)));

  const attentionState = assessCreatorWorkflowReadiness({
    sourceStatus: 'ready',
    connectedDestinations: 1,
    preparedVariants: 2,
    failedVariants: 1,
    scheduledPosts: [{ status: 'failed', retryCount: 2, errorMessage: 'Rate limited' }],
  });
  assert.equal(attentionState.state, 'attention_required');
  assert.equal(attentionState.failedPosts, 1);

  assert.deepEqual(decideRetry({ retryCount: 0, responseStatus: 429 }), {
    retryable: true,
    exhausted: false,
    nextDelayMs: 1000,
    reason: 'The failure is transient or rate-limited and may be retried within the configured budget.',
  });
  assert.equal(decideRetry({ retryCount: 3, responseStatus: 503 }).exhausted, true);
  assert.equal(decideRetry({ retryCount: 0, responseStatus: 400 }).retryable, false);

  const approval = validateCreatorApproval({
    postStatus: 'draft',
    sourceReady: true,
    variantReady: true,
    destinationActive: true,
  });
  assert.equal(approval.approved, true);
  assert(approval.safeguards.some((guardrail) => /does not guarantee/i.test(guardrail)));

  const blockedApproval = validateCreatorApproval({
    postStatus: 'draft',
    sourceReady: false,
    variantReady: true,
    destinationActive: false,
  });
  assert.equal(blockedApproval.approved, false);
  assert.equal(blockedApproval.reasons.length, 2);
  assert.equal(createAttemptIdempotencyKey('creator-intent-123456', 2), 'creator-intent-123456:attempt:2');

  const retryOutcome = resolvePublishAttemptOutcome({ retryCountBeforeAttempt: 0, responseStatus: 503, succeeded: false });
  assert.equal(retryOutcome.attemptStatus, 'retry_scheduled');
  assert.equal(retryOutcome.postStatus, 'scheduled');
  assert.equal(retryOutcome.deadLetter, false);

  const deadLetterOutcome = resolvePublishAttemptOutcome({ retryCountBeforeAttempt: 3, responseStatus: 503, succeeded: false });
  assert.equal(deadLetterOutcome.attemptStatus, 'dead_lettered');
  assert.equal(deadLetterOutcome.postStatus, 'failed');
  assert.equal(deadLetterOutcome.deadLetter, true);

  const growthRoute = await readFile(new URL('../src/routes/growth.ts', import.meta.url), 'utf8');
  assert.match(growthRoute, /requireWorkspaceAccess\(actor, video\.workspaceId\)/);
  assert.match(growthRoute, /video\.status !== 'ready'/);
  assert.match(growthRoute, /No experiment is scheduled or published by this endpoint/);
  assert.match(growthRoute, /account_connection_required/);
  assert.match(growthRoute, /variant_rendering_required/);
  assert.match(growthRoute, /variantId/);
  assert.match(growthRoute, /generationParams/);
  assert.match(growthRoute, /learning-signal/);
  assert.match(growthRoute, /evaluateLearningSignal/);
  assert.match(growthRoute, /readiness/);
  assert.match(growthRoute, /assessCreatorWorkflowReadiness/);
  assert.match(growthRoute, /reach-plan/);
  assert.match(growthRoute, /buildReachPlan/);
  assert.match(growthRoute, /scorecard/);
  assert.match(growthRoute, /buildExperimentScorecard/);
  const accountRoute = await readFile(new URL('../src/routes/accounts.ts', import.meta.url), 'utf8');
  assert.match(accountRoute, /encryptToken\(body\.accessToken\)/);
  assert.match(accountRoute, /accessTokenEncrypted: _accessToken/);
  assert.match(accountRoute, /refreshTokenEncrypted: _refreshToken/);
  assert.match(accountRoute, /app\.get\('\/capabilities'/);
  assert.match(accountRoute, /Official .* connector is not configured yet/);
  assert.doesNotMatch(accountRoute, /return c\.json\(\{ success: true, message: 'Token refreshed'/);

  const publisherWorker = await readFile(new URL('../../../workers/processor/src/publisher.js', import.meta.url), 'utf8');
  assert.match(publisherWorker, /official_connector_required/);
  assert.match(publisherWorker, /ALLOW_LEGACY_BROWSER_AUTOMATION/);

  const publishingRoute = await readFile(new URL('../src/routes/publishing.ts', import.meta.url), 'utf8');
  assert.match(publishingRoute, /Platform oversight is read-only/);
  assert.match(publishingRoute, /creator_publish_intent_approved/);
  assert.match(publishingRoute, /publishingAttempt\.create/);
  assert.match(publishingRoute, /official_creator_authorized_connection_required/);
  assert.match(publishingRoute, /variantReady/);

  const videoRoute = await readFile(new URL('../src/routes/videos.ts', import.meta.url), 'utf8');
  assert.match(videoRoute, /app\.post\('\/upload'/);
  assert.match(videoRoute, /No creator workspace access/);
  assert.match(videoRoute, /Only MP4, MOV, WebM, and M4V/);
  assert.match(videoRoute, /processing_queued/);
  assert.match(videoRoute, /uploadSource/);

  const dispatchAdapter = await readFile(new URL('../src/lib/processing-dispatch.ts', import.meta.url), 'utf8');
  assert.match(dispatchAdapter, /video-processing:\$\{videoId\}/);
  assert.match(dispatchAdapter, /attempts: 3/);
  assert.match(dispatchAdapter, /backoff: \{ type: 'exponential'/);

  const storageAdapter = await readFile(new URL('../src/lib/source-storage.ts', import.meta.url), 'utf8');
  assert.match(storageAdapter, /workspaces\/\$\{workspaceId\}\/sources/);
  assert.match(storageAdapter, /Metadata: \{ workspaceId/);
  assert.match(storageAdapter, /MINIO_ACCESS_KEY_FILE/);
  assert.match(storageAdapter, /forcePathStyle: true/);

  const processorEntrypoint = await readFile(new URL('../../../workers/processor/src/index.js', import.meta.url), 'utf8');
  assert.match(processorEntrypoint, /config\.workers\.videoConcurrency/);
  assert.match(processorEntrypoint, /video-processing/);
  const processorImplementation = await readFile(new URL('../../../workers/processor/src/processor.js', import.meta.url), 'utf8');
  assert.match(processorImplementation, /video\.minio_object_key/);
  const processorStorage = await readFile(new URL('../../../workers/processor/src/minio.js', import.meta.url), 'utf8');
  assert.match(processorStorage, /downloadFile\(key, bucket = BUCKET\)/);

  const lifecycleMigration = await readFile(new URL('../../web/prisma/migrations/4_creator_publish_lifecycle/migration.sql', import.meta.url), 'utf8');
  assert.match(lifecycleMigration, /publishing_attempts/);
  assert.match(lifecycleMigration, /idempotency_key/);
  assert.match(lifecycleMigration, /dead_lettered_at/);

  console.log('Growth-plan verification passed.');
  console.log(`Verified ${plan.length} transparent platform experiments and creator-approval safeguards.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
