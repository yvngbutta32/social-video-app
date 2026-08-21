import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { StorageProvider } from './base.js';
import { MinioStorageProvider, S3StorageProvider } from './minio.js';
import { GoogleDriveStorageProvider } from './gdrive.js';
import { OneDriveStorageProvider } from './onedrive.js';
import { EmailStorageProvider } from './email.js';

const config = getConfig();

let providers: Map<string, StorageProvider> = new Map();

export function getStorageProvider(destination: string): StorageProvider {
  const cached = providers.get(destination);
  if (cached) return cached;

  let provider: StorageProvider;

  switch (destination.toUpperCase()) {
    case 'MINIO':
      provider = new MinioStorageProvider();
      break;
    case 'S3':
      provider = new S3StorageProvider();
      break;
    case 'GDRIVE':
      provider = new GoogleDriveStorageProvider();
      break;
    case 'ONEDRIVE':
      provider = new OneDriveStorageProvider();
      break;
    case 'EMAIL':
      provider = new EmailStorageProvider();
      break;
    default:
      throw new Error(`Unknown storage destination: ${destination}`);
  }

  providers.set(destination, provider);
  logger.info({ destination }, 'Initialized storage provider');
  return provider;
}

export function clearProviders(): void {
  providers.clear();
}