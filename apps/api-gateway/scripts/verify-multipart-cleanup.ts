import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { multipartUploadExpired, parseMultipartUploadSession } from '../src/lib/multipart-cleanup.js';
import { createInternalConnectorRoutes } from '../src/routes/internal-connectors.js';

async function main() {
  const session = parseMultipartUploadSession({ multipartUpload: { uploadId: 'upload-1', objectKey: 'workspaces/a/source.mp4', bucket: 'videos', partCount: 2, partSizeBytes: 8 * 1024 * 1024 } });
  assert.equal(session?.uploadId, 'upload-1');
  assert.equal(parseMultipartUploadSession({ multipartUpload: { uploadId: 'missing-fields' } }), null);
  assert.equal(multipartUploadExpired(new Date('2026-08-25T00:00:00.000Z'), 24, new Date('2026-08-26T00:00:00.000Z')), true);
  assert.equal(multipartUploadExpired(new Date('2026-08-25T00:00:01.000Z'), 24, new Date('2026-08-26T00:00:00.000Z')), false);

  const internal = await readFile(new URL('../src/routes/internal-connectors.ts', import.meta.url), 'utf8');
  assert.match(internal, /maintenance\/multipart-uploads\/cleanup/);
  assert.match(internal, /abortMultipartSourceUpload/);
  assert.match(internal, /status: 'archived'/);
  assert.match(internal, /x-connector-token/);

  process.env.CONNECTOR_INGESTION_TOKEN = 'cleanup-test-token';
  const maintenance = createInternalConnectorRoutes();
  const unauthorized = await maintenance.request('/maintenance/multipart-uploads/cleanup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-connector-token': 'wrong-token' },
    body: JSON.stringify({}),
  });
  assert.equal(unauthorized.status, 401, 'Expired upload cleanup requires the protected connector token.');
  console.log('Expired multipart cleanup contract verified.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
