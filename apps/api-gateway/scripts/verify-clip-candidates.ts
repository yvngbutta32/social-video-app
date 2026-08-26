import assert from 'node:assert/strict';

import {
  applyManualAdaptationEdit,
  createAutomaticAdaptationRecipe,
} from '../src/lib/adaptation-recipe.js';
import { createClipCandidates, extractClipAnalysis } from '../src/lib/clip-candidates.js';

const sourceVideoId = '11111111-1111-4111-8111-111111111111';
const scenes = [
  { scene_number: 1, start_time: 0, end_time: 12, duration: 12 },
  { scene_number: 2, start_time: 15, end_time: 29, duration: 14 },
  { scene_number: 3, start_time: 35, end_time: 56, duration: 21 },
];
const captions = [
  { start: 1, end: 4, text: 'Opening cue' },
  { start: 16, end: 19, text: 'Second cue' },
  { start: 38, end: 45, text: 'Third cue' },
];

const candidates = createClipCandidates({
  durationSeconds: 60,
  preferredDurationSeconds: 20,
  scenes,
  captions,
});
assert.equal(candidates.length, 3);
assert.deepEqual(candidates.map((candidate) => candidate.startSeconds), [0, 15, 35]);
assert.ok(candidates.every((candidate) => candidate.source === 'scene_detection'));
assert.ok(candidates.every((candidate) => candidate.endSeconds <= 60));
assert.equal(candidates[1]?.captionCueCount, 1);
assert.match(candidates[0]?.rationale ?? '', /not a claim that this is the best-performing moment/i);

const fallback = createClipCandidates({
  durationSeconds: 90,
  preferredDurationSeconds: 45,
  scenes: [],
  captions: [],
});
assert.equal(fallback.length, 1);
assert.equal(fallback[0]?.source, 'opening_fallback');
assert.equal(fallback[0]?.startSeconds, 0);
assert.equal(fallback[0]?.endSeconds, 45);

const extracted = extractClipAnalysis([{ generationParams: { scenes, captions } }]);
assert.equal(extracted.scenes.length, 3);
assert.equal(extracted.captions.length, 3);

const automaticRecipe = createAutomaticAdaptationRecipe({
  platform: 'tiktok',
  sourceVideoId,
  durationSeconds: 60,
});
const creatorSelectedRecipe = applyManualAdaptationEdit(automaticRecipe, {
  clipCandidateId: candidates[1]!.id,
  sourceRange: {
    startSeconds: candidates[1]!.startSeconds,
    endSeconds: candidates[1]!.endSeconds,
  },
});
assert.equal(creatorSelectedRecipe.sourceRange.selectionMethod, 'scene_candidate');
assert.equal(creatorSelectedRecipe.sourceRange.startSeconds, 15);
assert.equal(creatorSelectedRecipe.provenance.revision, 2);

console.log('Scene-aware clip candidate contract verified.');
