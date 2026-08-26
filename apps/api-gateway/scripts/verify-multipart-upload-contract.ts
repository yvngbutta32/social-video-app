import { MAX_MULTIPART_SOURCE_PARTS, MULTIPART_SOURCE_PART_BYTES, multipartPartCount } from '../src/lib/source-storage.js';

if (multipartPartCount(MULTIPART_SOURCE_PART_BYTES) !== 1) throw new Error('A source equal to the configured part size must use one part.');
if (multipartPartCount(MULTIPART_SOURCE_PART_BYTES + 1) !== 2) throw new Error('A source crossing the configured part size must use two parts.');
if (multipartPartCount(MULTIPART_SOURCE_PART_BYTES * MAX_MULTIPART_SOURCE_PARTS) !== MAX_MULTIPART_SOURCE_PARTS) throw new Error('The multipart part-count boundary is incorrect.');
for (const invalid of [0, -1, Number.NaN]) {
  let rejected = false;
  try { multipartPartCount(invalid); } catch { rejected = true; }
  if (!rejected) throw new Error(`Invalid source size ${invalid} must be rejected.`);
}
console.log('Multipart upload contract verification passed.');
