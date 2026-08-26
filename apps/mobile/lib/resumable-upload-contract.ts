export type MultipartUploadRecovery = {
  videoId: string;
  partSizeBytes: number;
  partCount: number;
  uploadedPartNumbers: number[];
};

export function partRange(partNumber: number, partSizeBytes: number, totalBytes: number) {
  if (!Number.isInteger(partNumber) || partNumber < 1 || !Number.isSafeInteger(partSizeBytes) || partSizeBytes <= 0 || !Number.isSafeInteger(totalBytes) || totalBytes <= 0) {
    throw new Error("A valid source and upload part are required.");
  }
  const start = (partNumber - 1) * partSizeBytes;
  if (start >= totalBytes) throw new Error("This source part is outside the selected file.");
  return { start, end: Math.min(start + partSizeBytes, totalBytes) };
}

export function nextIncompletePart(partCount: number, completedPartNumbers: number[]) {
  const completed = new Set(completedPartNumbers);
  for (let partNumber = 1; partNumber <= partCount; partNumber += 1) if (!completed.has(partNumber)) return partNumber;
  return null;
}

export function uniqueCompletedParts(parts: number[]) {
  return [...new Set(parts.filter((part) => Number.isInteger(part) && part > 0))].sort((left, right) => left - right);
}

export function readUploadEtag(value: string | null) {
  if (!value?.trim()) throw new Error("The private storage service did not confirm this uploaded source part.");
  return value.trim();
}
