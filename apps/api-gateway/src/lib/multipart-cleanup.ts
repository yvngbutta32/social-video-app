export type MultipartUploadSession = {
  uploadId: string;
  objectKey: string;
  bucket: string;
  partCount: number;
  partSizeBytes: number;
};

export function parseMultipartUploadSession(metadata: unknown): MultipartUploadSession | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const candidate = (metadata as Record<string, unknown>).multipartUpload;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const value = candidate as Record<string, unknown>;
  if (typeof value.uploadId !== 'string' || typeof value.objectKey !== 'string' || typeof value.bucket !== 'string' || !Number.isInteger(value.partCount) || !Number.isInteger(value.partSizeBytes)) return null;
  return { uploadId: value.uploadId, objectKey: value.objectKey, bucket: value.bucket, partCount: value.partCount as number, partSizeBytes: value.partSizeBytes as number };
}

export function multipartUploadExpired(createdAt: Date, maxAgeHours: number, now = new Date()) {
  return createdAt.getTime() <= now.getTime() - maxAgeHours * 60 * 60 * 1000;
}
