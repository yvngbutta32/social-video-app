import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import config from './config.js';
import logger from './logger.js';

const s3Client = new S3Client({
  endpoint: `http${config.MINIO_USE_SSL ? 's' : ''}://${config.MINIO_ENDPOINT}:${config.MINIO_PORT}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.MINIO_ACCESS_KEY,
    secretAccessKey: config.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

const mirrorS3Client = new S3Client({
  endpoint: `http${config.MINIO_USE_SSL ? 's' : ''}://${config.MINIO_ENDPOINT}:${config.MINIO_PORT}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.MINIO_ACCESS_KEY,
    secretAccessKey: config.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

async function ensureBucket(client, bucket) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      logger.info({ bucket }, 'Created bucket');
    } else {
      throw error;
    }
  }
}

export async function downloadFile(key, bucket = config.MINIO_BUCKET) {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);
    return response.Body;
  } catch (error) {
    logger.error({ key, bucket, err: error }, 'Download failed');
    throw error;
  }
}

export async function uploadFile(key, body, contentType, bucket = config.MINIO_BUCKET, metadata = {}) {
  try {
    await ensureBucket(s3Client, bucket);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });
    await s3Client.send(command);
    return { key, bucket };
  } catch (error) {
    logger.error({ key, bucket, err: error }, 'Upload failed');
    throw error;
  }
}

export async function uploadToMirror(key, body, contentType, metadata = {}) {
  try {
    await ensureBucket(mirrorS3Client, config.MIRROR_BUCKET);
    const command = new PutObjectCommand({
      Bucket: config.MIRROR_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });
    await mirrorS3Client.send(command);
    return { key, bucket: config.MIRROR_BUCKET };
  } catch (error) {
    logger.error({ key, bucket: config.MIRROR_BUCKET, err: error }, 'Mirror upload failed');
    throw error;
  }
}

export async function fileExists(key, bucket = config.MINIO_BUCKET) {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

export async function getPresignedDownloadUrl(key, expiresIn = 3600, bucket = config.MINIO_BUCKET) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function listFiles(prefix, bucket = config.MINIO_BUCKET) {
  const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
  const response = await s3Client.send(command);
  return response.Contents || [];
}

export async function deleteFile(key, bucket = config.MINIO_BUCKET) {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await s3Client.send(command);
}

export async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export { s3Client, mirrorS3Client };