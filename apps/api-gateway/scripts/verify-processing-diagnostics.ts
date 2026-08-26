import assert from 'node:assert/strict';

import { buildProcessingDiagnostic } from '../src/lib/processing-diagnostics.js';

const queued = buildProcessingDiagnostic({
  status: 'uploading',
  metadata: { processingState: 'queued', processingJobId: 'video-processing:source-1' },
});
assert.equal(queued.state, 'queued');
assert.equal(queued.retry.allowed, false);
assert.equal(queued.issue.code, 'none');

const renderingFailure = buildProcessingDiagnostic({
  status: 'failed',
  metadata: {
    processingState: 'failed',
    processingError: 'ffmpeg filter graph failed to initialize',
    manualRetryCount: 1,
    phase: 'rendering_platform_variant',
    percent: 64,
  },
});
assert.equal(renderingFailure.state, 'failed');
assert.equal(renderingFailure.issue.code, 'rendering_failed');
assert.equal(renderingFailure.retry.allowed, true);
assert.equal(renderingFailure.retry.remainingManualRetries, 2);
assert.equal(renderingFailure.percent, 64);

const storageFailure = buildProcessingDiagnostic({
  status: 'failed',
  metadata: { processingError: 'MinIO bucket connection refused', manualRetryCount: 3 },
});
assert.equal(storageFailure.issue.code, 'storage_unavailable');
assert.equal(storageFailure.retry.allowed, false);
assert.equal(storageFailure.retry.remainingManualRetries, 0);

const dispatchFailure = buildProcessingDiagnostic({
  status: 'uploading',
  metadata: { processingState: 'dispatch_failed', processingError: 'Redis queue connection refused' },
});
assert.equal(dispatchFailure.state, 'dispatch_failed');
assert.equal(dispatchFailure.issue.code, 'processing_service_unavailable');
assert.equal(dispatchFailure.retry.allowed, true);
assert.match(dispatchFailure.issue.message, /original source remains private/i);

const ready = buildProcessingDiagnostic({
  status: 'ready',
  metadata: { processingState: 'complete', percent: 100, completedPlatforms: 3, totalPlatforms: 3 },
});
assert.equal(ready.state, 'ready');
assert.equal(ready.retry.allowed, false);
assert.equal(ready.completedPlatforms, 3);

console.log('Processing diagnostics contract verified.');
