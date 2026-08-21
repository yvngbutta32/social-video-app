import { Client as MinioClient } from 'minio';
import { Readable, PassThrough } from 'stream';
import crypto from 'crypto';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { StorageProvider, StorageResult, StorageFile, StreamContent } from './base.js';

const config = getConfig();

export class MinioStorageProvider implements StorageProvider {
  name = 'MINIO';
  private client: MinioClient;
  private bucket: string;

  constructor() {
    this.client = new MinioClient({
      endPoint: config.MINIO_ENDPOINT,
      port: config.MINIO_PORT,
      useSSL: config.MINIO_USE_SSL,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
      region: config.MINIO_REGION,
    });
    this.bucket = config.MINIO_BUCKET;
    this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket, config.MINIO_REGION);
      logger.info({ bucket: this.bucket }, 'Created MinIO bucket');
    }
  }

  async upload(filePath: string, content: StreamContent, metadata?: Record<string, string>): Promise<StorageResult> {
    const hash = crypto.createHash('sha256');
    const passThrough = new PassThrough();

    let stream: Readable;
    let size: number;

    if (Buffer.isBuffer(content)) {
      stream = Readable.from(content);
      size = content.length;
    } else {
      stream = content;
      size = 0;
    }

    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.pipe(passThrough);

    await this.client.putObject(this.bucket, filePath, passThrough, size, {
      'Content-Type': 'application/octet-stream',
      ...metadata,
    });

    const checksum = hash.digest('hex');

    logger.info({ filePath, size, checksum }, 'Uploaded to MinIO');

    return {
      path: filePath,
      size,
      checksum,
      metadata,
    };
  }

  async download(filePath: string): Promise<Readable> {
    const stream = await this.client.getObject(this.bucket, filePath);
    return stream;
  }

  async delete(filePath: string): Promise<void> {
    await this.client.removeObject(this.bucket, filePath);
    logger.info({ filePath }, 'Deleted from MinIO');
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, filePath, expiresIn);
  }

  async list(prefix?: string): Promise<StorageFile[]> {
    const files: StorageFile[] = [];
    const stream = this.client.listObjects(this.bucket, prefix, true);

    for await (const obj of stream) {
      files.push({
        path: obj.name,
        size: obj.size,
        lastModified: obj.lastModified,
        metadata: obj.metaData,
      });
    }

    return files;
  }
}

export class S3StorageProvider implements StorageProvider {
  name = 'S3';
  private client: any = null;
  private bucket: string = '';
  private s3Module: any = null;
  private presignerModule: any = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.s3Module = await import('@aws-sdk/client-s3');
    this.presignerModule = await import('@aws-sdk/s3-request-presigner');

    this.client = new this.s3Module.S3Client({
      region: config.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucket = config.AWS_S3_BUCKET || '';
  }

  private async ensureInit(): Promise<void> {
    if (!this.client) {
      await this.init();
    }
  }

  async upload(filePath: string, content: Readable | Buffer, metadata?: Record<string, string>): Promise<StorageResult> {
    await this.ensureInit();
    const { PutObjectCommand } = this.s3Module;
    const body = Buffer.isBuffer(content) ? content : await this.streamToBuffer(content);
    const checksum = crypto.createHash('sha256').update(body).digest('hex');

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
      Body: body,
      ContentType: 'application/octet-stream',
      Metadata: metadata,
      ChecksumSHA256: checksum,
    }));

    logger.info({ filePath, size: body.length, checksum }, 'Uploaded to S3');

    return {
      path: filePath,
      size: body.length,
      checksum,
      metadata,
    };
  }

  async download(filePath: string): Promise<Readable> {
    await this.ensureInit();
    const { GetObjectCommand } = this.s3Module;
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    }));

    return response.Body as Readable;
  }

  async delete(filePath: string): Promise<void> {
    await this.ensureInit();
    const { DeleteObjectCommand } = this.s3Module;
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    }));
    logger.info({ filePath }, 'Deleted from S3');
  }

  async exists(filePath: string): Promise<boolean> {
    await this.ensureInit();
    const { HeadObjectCommand } = this.s3Module;
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      }));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
    await this.ensureInit();
    const { GetObjectCommand } = this.s3Module;
    const { getSignedUrl } = this.presignerModule;

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async list(prefix?: string): Promise<StorageFile[]> {
    await this.ensureInit();
    const { ListObjectsV2Command } = this.s3Module;
    const files: StorageFile[] = [];

    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));

      if (response.Contents) {
        for (const obj of response.Contents) {
          files.push({
            path: obj.Key || '',
            size: obj.Size || 0,
            lastModified: obj.LastModified || new Date(),
            metadata: {},
          });
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return files;
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}