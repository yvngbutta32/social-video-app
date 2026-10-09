import type { LocalCreatorMedia } from "./media-import";
import type { TimedCaptionTrack } from "./timed-caption-contract";

export type SourceStatus = "ready_to_queue" | "uploading" | "processing" | "ready" | "failed" | "archived";
export const creatorTargetPlatforms = ["tiktok", "instagram", "youtube", "linkedin"] as const;
export type CreatorTargetPlatform = (typeof creatorTargetPlatforms)[number];

export type MultipartUploadRecovery = {
  videoId: string;
  partSizeBytes: number;
  partCount: number;
  uploadedPartNumbers: number[];
};

export type MobileSource = Omit<LocalCreatorMedia, "uri" | "origin"> & {
  uri: string | null;
  origin: LocalCreatorMedia["origin"] | "workspace";
  id: string;
  importedAt: string;
  status: SourceStatus;
  serverVideoId?: string;
  uploadError?: string;
  multipartUpload?: MultipartUploadRecovery;
  adaptationBrief?: string;
};

export type MobileEditRecipe = {
  sourceId: string;
  selectedClipCandidateId?: string;
  trimStartSeconds: number;
  trimEndSeconds: number;
  composition: "smart_crop" | "fit" | "blur_background";
  focalX: number;
  focalY: number;
  headline: string;
  headlinePlacement: "upper_safe" | "center_safe" | "lower_safe";
  captionsEnabled: boolean;
  timedCaptionTrack?: TimedCaptionTrack;
  normalizeAudio: boolean;
  revision: number;
};
