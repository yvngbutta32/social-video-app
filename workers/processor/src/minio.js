import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config.js';
import { logger } from './logger.js';

const s3Client = new S3Client({
  endpoint: `http://${config.minio.endpoint}:${config.minio.port}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

const BUCKET = config.minio.bucket;

async function ensureBucket() {
  try {
    // MinIO auto-creates buckets on first write, but we can check
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      const { CreateBucketCommand } = await import('@aws-sdk/client-s3');
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
      logger.info({ bucket: BUCKET }, 'Created bucket');
    } else {
      logger.error({ err: error }, 'Error checking bucket');
      throw error;
    }
  }
}

export async function uploadFile(key, body, contentType, metadata = {}) {
  await ensureBucket();
  
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata,
  });
  
  await s3Client.send(command);
  return `s3://${BUCKET}/${key}`;
}

export async function uploadMultipart(key, contentType, metadata = {}) {
  await ensureBucket();
  
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
  });
  
  const response = await s3Client.send(command);
  return response.UploadId;
}

export async function uploadPart(key, uploadId, partNumber, body) {
  const command = new UploadPartCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    Body: body,
  });
  
  const response = await s3Client.send(command);
  return { ETag: response.ETag, PartNumber: partNumber };
}

export async function completeMultipart(key, uploadId, parts) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });
  
  await s3Client.send(command);
  return `s3://${BUCKET}/${key}`;
}

export async function abortMultipart(key, uploadId) {
  const command = new AbortMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
  });
  
  await s3Client.send(command);
}

export async function downloadFile(key, bucket = BUCKET) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  const response = await s3Client.send(command);
  return response.Body;
}

export async function deleteFile(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  
  await s3Client.send(command);
}

export async function getPresignedUploadUrl(key, contentType, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  
  return await getSignedUrl(s3Client, command, { expiresIn });
}

export async function getPresignedDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  
  return await getSignedUrl(s3Client, command, { expiresIn });
}

export async function fileExists(key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

export function getPublicUrl(key) {
  return `http://${config.minio.endpoint}:${config.minio.port}/${BUCKET}/${key}`;
}