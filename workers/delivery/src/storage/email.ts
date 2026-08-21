import nodemailer from 'nodemailer';
import { Readable, PassThrough } from 'stream';
import crypto from 'crypto';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { StorageProvider, StorageResult, StorageFile, StreamContent } from './base.js';

const config = getConfig();

export class EmailStorageProvider implements StorageProvider {
  name = 'EMAIL';
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT || 587,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
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

    stream.pipe(passThrough);
    passThrough.on('data', (chunk: Buffer) => hash.update(chunk));

    const fileName = filePath.split('/').pop() || 'archive.zip';

    const chunks: Buffer[] = [];
    for await (const chunk of passThrough) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const recipients = (metadata?.recipients as string)?.split(',').map(r => r.trim()) || [config.SMTP_FROM || ''];

    await this.transporter.sendMail({
      from: config.SMTP_FROM,
      to: recipients.join(', '),
      subject: metadata?.subject || `Archive Delivery: ${fileName}`,
      text: metadata?.body || `Please find attached the archive: ${fileName}`,
      attachments: [
        {
          filename: fileName,
          content: buffer,
          contentType: 'application/zip',
        },
      ],
    });

    const checksum = hash.digest('hex');

    logger.info({ filePath, recipients, size, checksum }, 'Sent via Email');

    return {
      path: filePath,
      size,
      checksum,
      metadata,
    };
  }

  async download(filePath: string): Promise<Readable> {
    throw new Error('Email storage does not support download');
  }

  async delete(filePath: string): Promise<void> {
    // Cannot delete sent emails
    logger.warn({ filePath }, 'Email storage: delete not supported');
  }

  async exists(filePath: string): Promise<boolean> {
    return false;
  }

  async getSignedUrl(filePath: string, expiresIn?: number): Promise<string> {
    throw new Error('Email storage does not support signed URLs');
  }

  async list(prefix?: string): Promise<StorageFile[]> {
    return [];
  }
}