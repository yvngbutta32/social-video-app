import { strict as assert } from 'node:assert';
import { jsonSafe } from '../src/lib/json-safe.js';

const result = jsonSafe({ fileSizeBytes: 524_288_000n, nested: [{ value: 1n }], label: 'source' });
assert.deepEqual(result, { fileSizeBytes: '524288000', nested: [{ value: '1' }], label: 'source' });

console.log('JSON-safe response serialization verified.');
