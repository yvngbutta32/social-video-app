import assert from 'node:assert/strict';

import {
  applyManualAdaptationEdit,
  createAutomaticAdaptationRecipe,
  parseAdaptationRecipe,
} from '../src/lib/adaptation-recipe.js';
import { variantRenderJobId } from '../src/lib/processing-dispatch.js';

const sourceVideoId = '11111111-1111-4111-8111-111111111111';

const automatic = createAutomaticAdaptationRecipe({
  platform: 'youtube',
  sourceVideoId,
  durationSeconds: 120,
  headline: 'A creator-controlled automatic draft',
});

assert.equal(automatic.mode, 'automatic');
assert.equal(automatic.sourceRange.selectionMethod, 'source_start_fallback');
assert.equal(automatic.sourceRange.startSeconds, 0);
assert.equal(automatic.sourceRange.endSeconds, 45);
assert.equal(automatic.output.maxDurationSeconds, 60);
assert.equal(automatic.provenance.sourceVideoId, sourceVideoId);
assert.equal(parseAdaptationRecipe(automatic)?.platform, 'youtube');

const manual = applyManualAdaptationEdit(automatic, {
  sourceRange: { startSeconds: 12.5, endSeconds: 49.5 },
  composition: { mode: 'blur_bg', showSafeZones: false },
  captions: { enabled: false, style: 'off' },
  headline: 'Creator refined hook',
  audio: { normalize: false },
});

assert.equal(manual.mode, 'manual');
assert.equal(manual.sourceRange.selectionMethod, 'creator_custom');
assert.equal(manual.sourceRange.startSeconds, 12.5);
assert.equal(manual.sourceRange.endSeconds, 49.5);
assert.equal(manual.composition.mode, 'blur_bg');
assert.equal(manual.captions.enabled, false);
assert.equal(manual.headline, 'Creator refined hook');
assert.equal(manual.audio.normalize, false);
assert.equal(manual.provenance.revision, automatic.provenance.revision + 1);

assert.throws(() => applyManualAdaptationEdit(automatic, {
  sourceRange: { startSeconds: 0, endSeconds: 61 },
}), /exceeds the 60-second platform recipe limit/);

assert.equal(variantRenderJobId('22222222-2222-4222-8222-222222222222', 3), 'variant-render:22222222-2222-4222-8222-222222222222:r3');

console.log('Adaptation recipe contract verified.');
