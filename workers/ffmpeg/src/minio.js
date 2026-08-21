/**
 * MinIO client for video and thumbnail storage
 * Handles uploads, downloads, presigned URLs, and bucket management
 */

import { Client } from 'minio';
import { config } from './config.js';
import { logger } from './logger.js';

class MinioClient {
  constructor() {
    this.client = null;
    this.buckets = {
      videos: config.MINIO_BUCKET_VIDEOS,
      thumbnails: config.MINIO_BUCKET_THUMBNAILS,
    };
  }

  async connect() {
    this.client = new Client({
      endPoint: config.MINIO_ENDPOINT.split(':')[0],
      port: parseInt(config.MINIO_ENDPOINT.split(':')[1] || '9000'),
      useSSL: config.MINIO_USE_SSL,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
    });

    // Ensure buckets exist
    await this.ensureBuckets();

    logger.info('MinIO client connected');
  }

  async ensureBuckets() {
    for (const [name, bucket] of Object.entries(this.buckets)) {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket, 'us-east-1');
        logger.info({ bucket }, 'Bucket created');
      }
    }
  }

  /**
   * Upload a file to MinIO
   */
  async uploadFile(bucketName, objectName, filePath, metadata = {}) {
    const bucket = this.buckets[bucketName] || bucketName;
    const meta = {
      'Content-Type': this.getContentType(objectName),
      'X-Amz-Meta-Original-Name': metadata.originalName || objectName,
      'X-Amz-Meta-Job-Id': metadata.jobId || '',
      'X-Amz-Meta-Platform': metadata.platform || '',
      ...metadata,
    };

    await this.client.fPutObject(bucket, objectName, filePath, meta);
    logger.debug({ bucket, objectName }, 'File uploaded');

    return this.getObjectUrl(bucket, objectName);
  }

  /**
   * Upload a buffer to MinIO
   */
  async uploadBuffer(bucketName, objectName, buffer, metadata = {}) {
    const bucket = this.buckets[bucketName] || bucketName;
    const meta = {
      'Content-Type': this.getContentType(objectName),
      'X-Amz-Meta-Original-Name': metadata.originalName || objectName,
      'X-Amz-Meta-Job-Id': metadata.jobId || '',
      'X-Amz-Meta-Platform': metadata.platform || '',
      ...metadata,
    };

    await this.client.putObject(bucket, objectName, buffer, buffer.length, meta);
    logger.debug({ bucket, objectName, size: buffer.length }, 'Buffer uploaded');

    return this.getObjectUrl(bucket, objectName);
  }

  /**
   * Download a file from MinIO
   */
  async downloadFile(bucketName, objectName, filePath) {
    const bucket = this.buckets[bucketName] || bucketName;
    await this.client.fGetObject(bucket, objectName, filePath);
    logger.debug({ bucket, objectName, filePath }, 'File downloaded');
  }

  /**
   * Get a presigned URL for temporary access
   */
  async getPresignedUrl(bucketName, objectName, expirySeconds = 3600) {
    const bucket = this.buckets[bucketName] || bucketName;
    return this.client.presignedGetObject(bucket, objectName, expirySeconds);
  }

  /**
   * Get a presigned PUT URL for direct uploads
   */
  async getPresignedPutUrl(bucketName, objectName, expirySeconds = 3600) {
    const bucket = this.buckets[bucketName] || bucketName;
    return this.client.presignedPutObject(bucket, objectName, expirySeconds);
  }

  /**
   * Delete an object
   */
  async deleteObject(bucketName, objectName) {
    const bucket = this.buckets[bucketName] || bucketName;
    await this.client.removeObject(bucket, objectName);
    logger.debug({ bucket, objectName }, 'Object deleted');
  }

  /**
   * List objects in a bucket with prefix
   */
  async listObjects(bucketName, prefix = '', recursive = true) {
    const bucket = this.buckets[bucketName] || bucketName;
    const objects = [];
    const stream = this.client.listObjects(bucket, prefix, recursive);

    for await (const obj of stream) {
      objects.push(obj);
    }

    return objects;
  }

  /**
   * Get object metadata
   */
  async getObjectStat(bucketName, objectName) {
    const bucket = this.buckets[bucketName] || bucketName;
    return this.client.statObject(bucket, objectName);
  }

  /**
   * Copy object between buckets
   */
  async copyObject(srcBucket, srcObject, destBucket, destObject) {
    await this.client.copyObject(
      destBucket,
      destObject,
      `/${srcBucket}/${srcObject}`,
      {}
    );
    logger.debug({ srcBucket, srcObject, destBucket, destObject }, 'Object copied');
  }

  /**
   * Get public URL for an object
   */
  getObjectUrl(bucketName, objectName) {
    const bucket = this.buckets[bucketName] || bucketName;
    const protocol = config.MINIO_USE_SSL ? 'https' : 'http';
    const host = config.MINIO_ENDPOINT;
    return `${protocol}://${host}/${bucket}/${objectName}`;
  }

  /**
   * Determine content type from file extension
   */
  getContentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      json: 'application/json',
      txt: 'text/plain',
    };
    return types[ext] || 'application/octet-stream';
  }

  async disconnect() {
    // MinIO client doesn't need explicit disconnect
    logger.info('MinIO client disconnected');
  }
}

export { MinioClient };
export default MinioClient;