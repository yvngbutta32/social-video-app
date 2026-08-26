import { File } from "expo-file-system";

import type { MobileSource } from "@/lib/creator-workflow";
import { parseUploadReceipt, sourceUploadTitle, type UploadReceipt } from "@/lib/upload-contract";
import { viralBoostRequest } from "@/lib/viralboost-api";

export { parseUploadReceipt, sourceUploadTitle, type UploadReceipt } from "@/lib/upload-contract";

export async function uploadCreatorSource(source: MobileSource) {
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
