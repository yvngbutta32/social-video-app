import { Readable } from 'stream';

export type StreamContent = Readable | Buffer;

export interface StorageProvider {
  name: string;
  upload(filePath: string, content: StreamContent, metadata?: Record<string, string>): Promise<StorageResult>;
  download(filePath: string): Promise<Readable>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  getSignedUrl(filePath: string, expiresIn?: number): Promise<string>;
  list(prefix?: string): Promise<StorageFile[]>;
}

export interface StorageResult {
  path: string;
  size: number;
  checksum: string;
  metadata?: Record<string, string>;
  url?: string;
}

export interface StorageFile {
  path: string;
  size: number;
  lastModified: Date;
  metadata?: Record<string, string>;
}

export interface DeliveryConfig {
  destination: 'MINIO' | 'S3' | 'GDRIVE' | 'ONEDRIVE' | 'EMAIL' | 'LOCAL';
  config: Record<string, unknown>;
  schedule: string; // cron expression
  enabled: boolean;
}

export interface DeliveryJob {
  id: string;
  mirrorId: string;
  configId: string;
  destination: DeliveryConfig['destination'];
  archivePath: string;
  variantIds: string[];
  metadata: Record<string, unknown>;
  retryCount: number;
  createdAt: Date;
}
