import assert from 'node:assert/strict';

import { createPrivatePreviewUrl } from '../src/lib/source-storage.js';

const previous = {
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT,
  bucket: process.env.MINIO_BUCKET,
};

async function main() {
  try {
    process.env.MINIO_ACCESS_KEY = 'preview-test-access';
  process.env.MINIO_SECRET_KEY = 'preview-test-secret';
  process.env.MINIO_PUBLIC_ENDPOINT = 'https://media.example.test';
  process.env.MINIO_BUCKET = 'private-media';

  const url = await createPrivatePreviewUrl({
    key: 'variants/video-1/private-preview.mp4',
    expiresInSeconds: 300,
  });

  assert.ok(url.startsWith('https://media.example.test/private-media/variants/video-1/private-preview.mp4?'));
  assert.match(url, /X-Amz-Expires=300/);
  assert.doesNotMatch(url, /preview-test-secret/);

  delete process.env.MINIO_PUBLIC_ENDPOINT;
  await assert.rejects(
    () => createPrivatePreviewUrl({ key: 'variants/video-1/private-preview.mp4' }),
    /MINIO_PUBLIC_ENDPOINT/,
  );

    console.log('Private artifact preview contract verified.');
  } finally {
    if (previous.accessKey === undefined) delete process.env.MINIO_ACCESS_KEY; else process.env.MINIO_ACCESS_KEY = previous.accessKey;
    if (previous.secretKey === undefined) delete process.env.MINIO_SECRET_KEY; else process.env.MINIO_SECRET_KEY = previous.secretKey;
    if (previous.publicEndpoint === undefined) delete process.env.MINIO_PUBLIC_ENDPOINT; else process.env.MINIO_PUBLIC_ENDPOINT = previous.publicEndpoint;
    if (previous.bucket === undefined) delete process.env.MINIO_BUCKET; else process.env.MINIO_BUCKET = previous.bucket;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
