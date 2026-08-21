import { google, drive_v3 } from 'googleapis';
import { Readable, PassThrough } from 'stream';
import crypto from 'crypto';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { StorageProvider, StorageResult, StorageFile, StreamContent } from './base.js';

const config = getConfig();

export class GoogleDriveStorageProvider implements StorageProvider {
  name = 'GDRIVE';
  private drive: drive_v3.Drive;
  private folderId: string;

  constructor() {
    const auth = new google.auth.OAuth2(
      config.GOOGLE_DRIVE_CLIENT_ID,
      config.GOOGLE_DRIVE_CLIENT_SECRET
    );
    auth.setCredentials({
      refresh_token: config.GOOGLE_DRIVE_REFRESH_TOKEN,
    });
    this.drive = google.drive({ version: 'v3', auth });
    this.folderId = config.GOOGLE_DRIVE_FOLDER_ID || 'root';
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

    const fileMetadata: drive_v3.Schema$File = {
      name: filePath.split('/').pop() || 'archive',
      parents: [this.folderId],
    };

    const media = {
      mimeType: 'application/octet-stream',
      body: passThrough,
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, size, md5Checksum',
    });

    const checksum = hash.digest('hex');

    logger.info({ filePath, fileId: response.data.id, size, checksum }, 'Uploaded to Google Drive');

    return {
      path: response.data.id || filePath,
      size: parseInt(response.data.size || '0', 10),
      checksum,
      metadata,
      url: `https://drive.google.com/file/d/${response.data.id}/view`,
    };
  }

  async download(filePath: string): Promise<Readable> {
    const response = await this.drive.files.get({
      fileId: filePath,
      alt: 'media',
    }, { responseType: 'stream' });

    return response.data as Readable;
  }

  async delete(filePath: string): Promise<void> {
    await this.drive.files.delete({ fileId: filePath });
    logger.info({ filePath }, 'Deleted from Google Drive');
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.drive.files.get({ fileId: filePath, fields: 'id' });
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
    // Google Drive doesn't have traditional signed URLs, return the web view link
    return `https://drive.google.com/file/d/${filePath}/view`;
  }

  async list(prefix?: string): Promise<StorageFile[]> {
    const files: StorageFile[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.drive.files.list({
        q: prefix ? `name contains '${prefix}' and '${this.folderId}' in parents` : `'${this.folderId}' in parents`,
        fields: 'nextPageToken, files(id, name, size, modifiedTime, mimeType)',
        pageToken,
        pageSize: 100,
      });

      if (response.data.files) {
        for (const file of response.data.files) {
          files.push({
            path: file.id || '',
            size: parseInt(file.size || '0', 10),
            lastModified: new Date(file.modifiedTime || Date.now()),
            metadata: { name: file.name || '', mimeType: file.mimeType || '' },
          });
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return files;
  }
}