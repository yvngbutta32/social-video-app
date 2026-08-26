import assert from 'node:assert/strict';

import { buildFilterComplex } from '../src/render-filter.js';

const verticalSpec = {
  width: 1080,
  height: 1920,
  safeZones: { top: 150, bottom: 300, left: 80, right: 80 },
};

const wideInputFocusedLeft = buildFilterComplex(verticalSpec, 1920, 1080, {
  mode: 'smart_crop',
  focusPoint: { x: 0.15, y: 0.5 },
});
assert.match(wideInputFocusedLeft, /0\.150000\*iw/);
assert.match(wideInputFocusedLeft, /max\(0\\,min\(/);
assert.doesNotMatch(wideInputFocusedLeft, /drawbox=/);

const tallInputFocusedLow = buildFilterComplex(verticalSpec, 1080, 1920, {
  mode: 'smart_fill',
  focusPoint: { x: 0.5, y: 0.82 },
});
assert.match(tallInputFocusedLow, /0\.820000\*ih/);

const editorGuidePreview = buildFilterComplex(verticalSpec, 1920, 1080, {
  mode: 'smart_crop',
  safeZone: true,
});
assert.match(editorGuidePreview, /drawbox=/);

const headlineOverlay = buildFilterComplex(verticalSpec, 1920, 1080, {
  mode: 'fit',
  addCaptions: true,
  captionText: "Creator: 100% focus\nnow",
});
assert.match(headlineOverlay, /Creator\\: 100\\% focus now/);

console.log('Renderer focal-composition and delivery-safety contract verified.');
