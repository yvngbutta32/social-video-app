import { File } from "expo-file-system";

import type { MobileSource } from "@/lib/creator-workflow";
import { nextIncompletePart, partRange, readUploadEtag, uniqueCompletedParts, type MultipartUploadRecovery } from "@/lib/resumable-upload-contract";
import { parseUploadReceipt, sourceUploadTitle, type UploadReceipt } from "@/lib/upload-contract";
import { viralBoostRequest } from "@/lib/viralboost-api";

export { parseUploadReceipt, sourceUploadTitle, type UploadReceipt } from "@/lib/upload-contract";

type InitiateMultipartResponse = { data?: { videoId?: string; partSizeBytes?: number; partCount?: number } };
type MultipartStatusResponse = { data?: { videoId?: string; partSizeBytes?: number; partCount?: number; completedParts?: number[] } };
type PartUrlResponse = { data?: { partNumber?: number; uploadUrl?: string } };
type CompleteMultipartResponse = { data?: { videoId?: string; status?: UploadReceipt["status"] } };

export class ResumableUploadUnavailableError extends Error {}

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  return payload?.error || payload?.message || fallback;
}

function parseRecovery(input: InitiateMultipartResponse | MultipartStatusResponse): MultipartUploadRecovery {
  const data = input.data;
  const videoId = data?.videoId;
  const partSizeBytes = data?.partSizeBytes;
  const partCount = data?.partCount;
  if (!videoId || typeof partSizeBytes !== "number" || typeof partCount !== "number" || !Number.isSafeInteger(partSizeBytes) || !Number.isSafeInteger(partCount) || partSizeBytes <= 0 || partCount <= 0) {
    throw new Error("The secure resumable upload session was incomplete.");
  }
  return { videoId, partSizeBytes, partCount, uploadedPartNumbers: uniqueCompletedParts("completedParts" in data && Array.isArray(data.completedParts) ? data.completedParts : []) };
}

async function initiateMultipartUpload(source: MobileSource, sizeBytes: number) {
  const response = await viralBoostRequest("/api/v1/videos/uploads/multipart/initiate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName: source.name, contentType: source.mimeType || "application/octet-stream", sizeBytes, title: sourceUploadTitle(source) }),
  });
  if (!response.ok) {
    const message = await responseError(response, "Resumable private upload is unavailable.");
    if (response.status === 404 || response.status === 503) throw new ResumableUploadUnavailableError(message);
    throw new Error(message);
  }
  return parseRecovery(await response.json() as InitiateMultipartResponse);
}

async function refreshMultipartUpload(recovery: MultipartUploadRecovery) {
  const response = await viralBoostRequest(`/api/v1/videos/uploads/multipart/${recovery.videoId}`);
  if (!response.ok) throw new Error(await responseError(response, "The resumable private upload status is unavailable."));
  return parseRecovery(await response.json() as MultipartStatusResponse);
}

async function requestPartUrl(videoId: string, partNumber: number) {
  const response = await viralBoostRequest(`/api/v1/videos/uploads/multipart/${videoId}/part-url`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ partNumber }),
  });
  if (!response.ok) throw new Error(await responseError(response, "A secure upload URL could not be prepared."));
  const payload = await response.json() as PartUrlResponse;
  if (payload.data?.partNumber !== partNumber || !payload.data.uploadUrl) throw new Error("The secure upload URL response was incomplete.");
  return payload.data.uploadUrl;
}

export async function uploadCreatorSourceResumable(
  source: MobileSource,
  onRecovery: (recovery: MultipartUploadRecovery) => void,
) {
  if (!source.uri) throw new Error("This source is stored in your private workspace but is not available as a device file to upload again.");
  const file = new File(source.uri);
  if (!file.exists || file.size <= 0) throw new Error("This source is no longer available on this device. Import it again before uploading.");
  let recovery = source.multipartUpload ? await refreshMultipartUpload(source.multipartUpload) : await initiateMultipartUpload(source, file.size);
  onRecovery(recovery);
  for (let partNumber = nextIncompletePart(recovery.partCount, recovery.uploadedPartNumbers); partNumber !== null; partNumber = nextIncompletePart(recovery.partCount, recovery.uploadedPartNumbers)) {
    const uploadUrl = await requestPartUrl(recovery.videoId, partNumber);
    const range = partRange(partNumber, recovery.partSizeBytes, file.size);
    const response = await fetch(uploadUrl, { method: "PUT", body: file.slice(range.start, range.end, source.mimeType || "application/octet-stream") });
    if (!response.ok) throw new Error("A private source part could not be stored. Retry to continue from the last confirmed part.");
    readUploadEtag(response.headers.get("etag"));
    recovery = { ...recovery, uploadedPartNumbers: uniqueCompletedParts([...recovery.uploadedPartNumbers, partNumber]) };
    onRecovery(recovery);
  }
  const completed = await viralBoostRequest(`/api/v1/videos/uploads/multipart/${recovery.videoId}/complete`, { method: "POST" });
  if (!completed.ok) throw new Error(await responseError(completed, "The private upload could not be completed. Refresh and retry safely."));
  const payload = await completed.json() as CompleteMultipartResponse;
  if (!payload.data?.videoId || !payload.data.status) throw new Error("The private upload completion response was incomplete.");
  return { id: payload.data.videoId, status: payload.data.status, recovery } satisfies UploadReceipt & { recovery: MultipartUploadRecovery };
}

export async function uploadCreatorSource(source: MobileSource) {
  if (!source.uri) throw new Error("This source is stored in your private workspace but is not available as a device file to upload again.");
  const file = new File(source.uri);
  if (!file.exists || file.size <= 0) {
    throw new Error("This source is no longer available on this device. Import it again before uploading.");
  }
  const body = new FormData();
  body.append("file", file);
  body.append("title", sourceUploadTitle(source));
  const response = await viralBoostRequest("/api/v1/videos/upload", { method: "POST", body });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(payload?.error || payload?.message || "The private source could not be uploaded.");
  }
  return parseUploadReceipt(await response.json());
}
