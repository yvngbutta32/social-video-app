import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

function readSecret(name: string, fileName: string) {
  const direct = process.env[name];
  if (direct) return direct;
  const file = process.env[fileName];
  if (!file) return '';
  try {
    return readFileSync(file, 'utf8').trim();
  } catch {
    return '';
  }
}

function storageConfig() {
  const endpoint = process.env.MINIO_ENDPOINT || 'minio:9000';
  const normalizedEndpoint = /^https?:\/\//.test(endpoint) ? endpoint : `http://${endpoint}`;
  return {
    endpoint: normalizedEndpoint,
    bucket: process.env.MINIO_BUCKET || 'videos',
    accessKeyId: readSecret('MINIO_ACCESS_KEY', 'MINIO_ACCESS_KEY_FILE'),
    secretAccessKey: readSecret('MINIO_SECRET_KEY', 'MINIO_SECRET_KEY_FILE'),
  };
}

function client() {
  const config = storageConfig();
  return new S3Client({
    endpoint: config.endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true,
  });
}

async function ensureBucket(s3: S3Client, bucket: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchBucket') {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      return;
    }
    throw error;
  }
}

export function sourceObjectKey(workspaceId: string, originalFilename: string) {
  const extension = originalFilename.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] || '.mp4';
  return `workspaces/${workspaceId}/sources/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
}

export async function uploadSource(input: {
  workspaceId: string;
  originalFilename: string;
  contentType: string;
  body: Buffer;
}) {
  const config = storageConfig();
  const s3 = client();
  const key = sourceObjectKey(input.workspaceId, input.originalFilename);
  await ensureBucket(s3, config.bucket);
  await s3.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: input.body,
    ContentType: input.contentType,
    Metadata: { workspaceId: input.workspaceId, sourceType: 'creator-upload' },
  }));
  return { bucket: config.bucket, key, sizeBytes: input.body.byteLength };
}
