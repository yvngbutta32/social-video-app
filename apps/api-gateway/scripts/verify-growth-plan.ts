import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGrowthExperimentPlan } from '../src/lib/growth-plan.js';
import { evaluateLearningSignal } from '../src/lib/growth-learning.js';
import { assessCreatorWorkflowReadiness, decideRetry } from '../src/lib/reliability.js';

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

  const growthRoute = await readFile(new URL('../src/routes/growth.ts', import.meta.url), 'utf8');
  assert.match(growthRoute, /requireWorkspaceAccess\(actor, video\.workspaceId\)/);
  assert.match(growthRoute, /video\.status !== 'ready'/);
  assert.match(growthRoute, /No experiment is scheduled or published by this endpoint/);
  assert.match(growthRoute, /account_connection_required/);
  assert.match(growthRoute, /learning-signal/);
  assert.match(growthRoute, /evaluateLearningSignal/);
  assert.match(growthRoute, /readiness/);
  assert.match(growthRoute, /assessCreatorWorkflowReadiness/);

  console.log('Growth-plan verification passed.');
  console.log(`Verified ${plan.length} transparent platform experiments and creator-approval safeguards.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
