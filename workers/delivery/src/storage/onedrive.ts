import { Client } from '@microsoft/microsoft-graph-client';
import { Readable, PassThrough } from 'stream';
import crypto from 'crypto';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { StorageProvider, StorageResult, StorageFile, StreamContent } from './base.js';

const config = getConfig();

export class OneDriveStorageProvider implements StorageProvider {
  name = 'ONEDRIVE';
  private client: Client;
  private folderId: string;

  constructor() {
    this.client = Client.init({
      authProvider: (done) => {
        // This would need a proper token refresh implementation
        // For now, we'll use the refresh token to get access token
        done(null, config.ONEDRIVE_REFRESH_TOKEN || null);
      },
    });
    this.folderId = config.ONEDRIVE_FOLDER_ID || 'root';
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

    const fileName = filePath.split('/').pop() || 'archive';

    const response = await this.client
      .api(`/me/drive/items/${this.folderId}:/${fileName}:/content`)
      .putStream(passThrough);

    const checksum = hash.digest('hex');

    logger.info({ filePath, fileId: response.id, size, checksum }, 'Uploaded to OneDrive');

    return {
      path: response.id || filePath,
      size: response.size || size,
      checksum,
      metadata,
      url: response.webUrl,
    };
  }

  async download(filePath: string): Promise<Readable> {
    const response = await this.client
      .api(`/me/drive/items/${filePath}/content`)
      .getStream();

    return response as Readable;
  }

  async delete(filePath: string): Promise<void> {
    await this.client.api(`/me/drive/items/${filePath}`).delete();
    logger.info({ filePath }, 'Deleted from OneDrive');
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.client.api(`/me/drive/items/${filePath}`).get();
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
    const response = await this.client
      .api(`/me/drive/items/${filePath}/createLink`)
      .post({ type: 'view', scope: 'anonymous', expirationDateTime: new Date(Date.now() + expiresIn * 1000).toISOString() });

    return response.link.webUrl;
  }

  async list(prefix?: string): Promise<StorageFile[]> {
    const files: StorageFile[] = [];
    let nextLink: string | undefined = `/me/drive/items/${this.folderId}/children`;

    if (prefix) {
      nextLink = `/me/drive/items/${this.folderId}/children?$filter=startswith(name,'${prefix}')`;
    }

    while (nextLink) {
      const response = await this.client.api(nextLink).get();
      if (response.value) {
        for (const item of response.value) {
          files.push({
            path: item.id,
            size: item.size || 0,
            lastModified: new Date(item.lastModifiedDateTime || Date.now()),
            metadata: { name: item.name, mimeType: item.file?.mimeType },
          });
        }
      }
      nextLink = response['@odata.nextLink'];
    }

    return files;
  }
}