import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGrowthExperimentPlan } from '../src/lib/growth-plan.js';

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

  const growthRoute = await readFile(new URL('../src/routes/growth.ts', import.meta.url), 'utf8');
  assert.match(growthRoute, /requireWorkspaceAccess\(actor, video\.workspaceId\)/);
  assert.match(growthRoute, /video\.status !== 'ready'/);
  assert.match(growthRoute, /No experiment is scheduled or published by this endpoint/);
  assert.match(growthRoute, /account_connection_required/);

  console.log('Growth-plan verification passed.');
  console.log(`Verified ${plan.length} transparent platform experiments and creator-approval safeguards.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
