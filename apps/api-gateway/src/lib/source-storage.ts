import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateBucketCommand, CreateMultipartUploadCommand, GetObjectCommand, HeadBucketCommand, ListPartsCommand, PutObjectCommand, S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

function client(endpoint?: string) {
  const config = storageConfig();
  return new S3Client({
    endpoint: endpoint || config.endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true,
  });
}

export async function probePrivateSourceStorage() {
  const config = storageConfig();
  if (!config.accessKeyId || !config.secretAccessKey) throw new Error('Private source storage credentials are not configured');
  await client().send(new HeadBucketCommand({ Bucket: config.bucket }));
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

export const MULTIPART_SOURCE_PART_BYTES = 8 * 1024 * 1024;
export const MAX_MULTIPART_SOURCE_PARTS = 10_000;

function publicClient() {
  const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT;
  if (!publicEndpoint) {
    throw new Error('Private source resume is unavailable until MINIO_PUBLIC_ENDPOINT is configured for device access');
  }
  const normalizedPublicEndpoint = /^https?:\/\//.test(publicEndpoint) ? publicEndpoint : `https://${publicEndpoint}`;
  return client(normalizedPublicEndpoint);
}

export function multipartPartCount(sizeBytes: number, partBytes = MULTIPART_SOURCE_PART_BYTES) {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) throw new Error('A positive source size is required for multipart upload');
  return Math.ceil(sizeBytes / partBytes);
}

export async function createMultipartSourceUpload(input: { workspaceId: string; originalFilename: string; contentType: string }) {
  const config = storageConfig();
  if (!config.accessKeyId || !config.secretAccessKey) throw new Error('Private source storage credentials are not configured');
  const s3 = client();
  await ensureBucket(s3, config.bucket);
  const key = sourceObjectKey(input.workspaceId, input.originalFilename);
  const created = await s3.send(new CreateMultipartUploadCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: input.contentType,
    Metadata: { workspaceId: input.workspaceId, sourceType: 'creator-upload' },
  }));
  if (!created.UploadId) throw new Error('Private source upload session could not be created');
  return { bucket: config.bucket, key, uploadId: created.UploadId };
}

export async function createMultipartPartUrl(input: { bucket: string; key: string; uploadId: string; partNumber: number }) {
  const expiresIn = 10 * 60;
  const url = await getSignedUrl(publicClient(), new UploadPartCommand({
    Bucket: input.bucket,
    Key: input.key,
    UploadId: input.uploadId,
    PartNumber: input.partNumber,
  }), { expiresIn });
  return { url, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
}

export async function listMultipartSourceParts(input: { bucket: string; key: string; uploadId: string }) {
  const result = await client().send(new ListPartsCommand({ Bucket: input.bucket, Key: input.key, UploadId: input.uploadId }));
  return (result.Parts || []).flatMap((part) => part.PartNumber && part.ETag ? [{ partNumber: part.PartNumber, etag: part.ETag, sizeBytes: part.Size ?? null }] : []);
}

export async function completeMultipartSourceUpload(input: { bucket: string; key: string; uploadId: string; parts: Array<{ partNumber: number; etag: string }> }) {
  if (!input.parts.length) throw new Error('Private source upload has no completed parts');
  await client().send(new CompleteMultipartUploadCommand({
    Bucket: input.bucket,
    Key: input.key,
    UploadId: input.uploadId,
    MultipartUpload: { Parts: input.parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) },
  }));
}

export async function abortMultipartSourceUpload(input: { bucket: string; key: string; uploadId: string }) {
  await client().send(new AbortMultipartUploadCommand({ Bucket: input.bucket, Key: input.key, UploadId: input.uploadId }));
}

export async function createPrivatePreviewUrl(input: {
  key: string;
  bucket?: string | null;
  expiresInSeconds?: number;
}) {
  const config = storageConfig();
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('Private artifact preview storage credentials are not configured');
  }
  const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT;
  if (!publicEndpoint) {
    throw new Error('Private artifact preview is unavailable until MINIO_PUBLIC_ENDPOINT is configured for browser access');
  }
  const normalizedPublicEndpoint = /^https?:\/\//.test(publicEndpoint) ? publicEndpoint : `https://${publicEndpoint}`;
  const expiresIn = Math.min(Math.max(input.expiresInSeconds ?? 300, 60), 900);
  return getSignedUrl(client(normalizedPublicEndpoint), new GetObjectCommand({
    Bucket: input.bucket || config.bucket,
    Key: input.key,
    ResponseContentDisposition: 'inline',
  }), { expiresIn });
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
