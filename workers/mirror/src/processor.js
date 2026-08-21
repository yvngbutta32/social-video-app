import { v4 as uuidv4 } from 'uuid';
import config from './config.js';
import logger from './logger.js';
import * as minio from './minio.js';
import * as db from './db.js';
import * as encryption from './encryption.js';

async function processMirrorJob(jobData) {
  const { videoId, creatorId, creatorProfileId, originalS3Key, metadata = {} } = jobData;
  const startTime = Date.now();

  logger.info({ videoId, creatorId, creatorProfileId, originalS3Key }, 'Starting mirror job');

  try {
    // Get video info
    const video = await db.getVideoById(videoId);
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    // Get creator profile
    const creatorProfile = await db.getCreatorProfileById(creatorProfileId);
    if (!creatorProfile) {
      throw new Error(`Creator profile not found: ${creatorProfileId}`);
    }

    // Download original file from MinIO
    logger.debug({ originalS3Key }, 'Downloading original file');
    const fileStream = await minio.downloadFile(originalS3Key);
    const fileBuffer = await minio.streamToBuffer(fileStream);

    // Validate file size
    const fileSizeGB = fileBuffer.length / (1024 * 1024 * 1024);
    if (fileSizeGB > config.MAX_FILE_SIZE_GB) {
      throw new Error(`File size ${fileSizeGB.toFixed(2)}GB exceeds maximum ${config.MAX_FILE_SIZE_GB}GB`);
    }

    // Calculate checksum
    const checksum = encryption.calculateChecksum(fileBuffer);

    // Encrypt file
    logger.debug({ fileSizeBytes: fileBuffer.length }, 'Encrypting file');
    const encryptedData = encryption.encrypt(fileBuffer);

    // Generate mirror key
    const mirrorKey = `mirror/${creatorProfileId}/${videoId}/${uuidv4()}.enc`;

    // Prepare metadata for mirror
    const mirrorMetadata = {
      originalKey: originalS3Key,
      videoId,
      creatorId,
      creatorProfileId,
      originalFileName: metadata.fileName || 'video.mp4',
      originalMimeType: metadata.mimeType || 'video/mp4',
      fileSizeBytes: fileBuffer.length,
      checksum,
      encryptionKeyId: encryptedData.keyId,
      encryptionAlgorithm: encryptedData.algorithm,
      mirroredAt: new Date().toISOString(),
      ...metadata,
    };

    // Upload encrypted file to mirror bucket
    logger.debug({ mirrorKey }, 'Uploading encrypted mirror');
    await minio.uploadToMirror(mirrorKey, encryptedData.encrypted, 'application/octet-stream', {
      ...mirrorMetadata,
      'encryption-key-id': encryptedData.keyId,
      'encryption-algorithm': encryptedData.algorithm,
      'encryption-salt': encryptedData.salt.toString('base64'),
      'encryption-iv': encryptedData.iv.toString('base64'),
      'encryption-auth-tag': encryptedData.authTag.toString('base64'),
    });

    // Save mirror record to database
    const mirrorRecord = await db.createMirrorRecord({
      videoId,
      creatorId,
      creatorProfileId,
      originalS3Key,
      mirrorS3Key: mirrorKey,
      mirrorBucket: config.MIRROR_BUCKET,
      encryptionKeyId: encryptedData.keyId,
      fileSizeBytes: fileBuffer.length,
      checksum,
      metadata: mirrorMetadata,
    });

    // Optionally include thumbnails and metadata files
    if (config.INCLUDE_THUMBNAILS && metadata.thumbnailKey) {
      await mirrorThumbnail(metadata.thumbnailKey, creatorProfileId, videoId, mirrorRecord.id);
    }

    if (config.INCLUDE_METADATA && metadata.metadataKey) {
      await mirrorMetadataFile(metadata.metadataKey, creatorProfileId, videoId, mirrorRecord.id);
    }

    const duration = Date.now() - startTime;
    logger.info({
      videoId,
      mirrorId: mirrorRecord.id,
      mirrorKey,
      fileSizeBytes: fileBuffer.length,
      duration,
    }, 'Mirror job completed successfully');

    return {
      success: true,
      mirrorId: mirrorRecord.id,
      mirrorKey,
      fileSizeBytes: fileBuffer.length,
      checksum,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ videoId, err: error, duration }, 'Mirror job failed');
    throw error;
  }
}

async function mirrorThumbnail(thumbnailKey, creatorProfileId, videoId, mirrorId) {
  try {
    const thumbnailStream = await minio.downloadFile(thumbnailKey);
    const thumbnailBuffer = await minio.streamToBuffer(thumbnailStream);

    const mirrorThumbnailKey = `mirror/${creatorProfileId}/${videoId}/${mirrorId}/thumbnail${thumbnailKey.substring(thumbnailKey.lastIndexOf('.'))}`;
    await minio.uploadToMirror(mirrorThumbnailKey, thumbnailBuffer, 'image/jpeg', {
      mirrorId,
      originalKey: thumbnailKey,
      type: 'thumbnail',
    });

    logger.debug({ mirrorThumbnailKey }, 'Thumbnail mirrored');
  } catch (error) {
    logger.warn({ thumbnailKey, err: error }, 'Failed to mirror thumbnail');
  }
}

async function mirrorMetadataFile(metadataKey, creatorProfileId, videoId, mirrorId) {
  try {
    const metadataStream = await minio.downloadFile(metadataKey);
    const metadataBuffer = await minio.streamToBuffer(metadataStream);

    const mirrorMetadataKey = `mirror/${creatorProfileId}/${videoId}/${mirrorId}/metadata.json`;
    await minio.uploadToMirror(mirrorMetadataKey, metadataBuffer, 'application/json', {
      mirrorId,
      originalKey: metadataKey,
      type: 'metadata',
    });

    logger.debug({ mirrorMetadataKey }, 'Metadata file mirrored');
  } catch (error) {
    logger.warn({ metadataKey, err: error }, 'Failed to mirror metadata file');
  }
}

export { processMirrorJob };