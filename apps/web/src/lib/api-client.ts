export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function createApiHeaders(init: RequestInit | undefined, accessToken?: string, workspaceId?: string) {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body && !(typeof FormData !== 'undefined' && init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  return headers;
}

export async function apiRequest<T>(path: string, accessToken?: string, init?: RequestInit, workspaceId?: string): Promise<T> {
  const headers = createApiHeaders(init, accessToken, workspaceId);

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload?.message || payload?.error || 'The request could not be completed.', response.status);
  }
  return payload as T;
}

export type ApiVideo = {
  id: string;
  title: string | null;
  originalFilename: string | null;
  status: 'uploading' | 'processing' | 'ready' | 'failed' | 'archived';
  createdAt: string;
  variants?: Array<{ id: string; platform: string; status: string; scheduledPosts?: Array<{ status: string }> }>;
};

export type ApiPlatformCapability = {
  platform: string;
  label: string;
  officialPublishing: 'direct_post' | 'media_publish' | 'video_insert' | 'not_configured';
  creatorAccountRequirement: string;
  supportsDrafts: boolean;
  supportsScheduling: boolean;
  metricsStatus: 'planned' | 'available_after_connection';
  readiness: 'official_connector_ready' | 'connector_required';
  safeguards: string[];
};

export type ApiSocialAccount = {
  id: string;
  platform: string;
  username: string | null;
  displayName: string | null;
  isActive: boolean;
  connectionState?: 'connected' | 'token_expired' | 'revoked';
  capability?: ApiPlatformCapability | null;
};

export type GrowthPlan = {
  platform: 'tiktok' | 'instagram' | 'youtube';
  variantType: string;
  aspectRatio: string;
  hook: string;
  caption: string;
  hypothesis: string;
  learningQuestion: string;
  recommendedWindow: string;
  changes: string[];
  safeguards: string[];
};

export type AdaptationRecipe = {
  version: 1;
  platform: string;
  mode: 'automatic' | 'manual';
  sourceRange: { startSeconds: number; endSeconds: number; selectionMethod: string; rationale: string };
  composition: { mode: 'fit' | 'crop' | 'blur_bg' | 'smart_crop' | 'smart_fill'; focalPoint?: { x: number; y: number }; showSafeZones: boolean };
  captions: { enabled: boolean; style: 'off' | 'clean' | 'high_contrast' };
  headline: string | null;
  audio: { normalize: boolean };
  output: { aspectRatio: string; width: number; height: number; fps: number; maxDurationSeconds: number };
  provenance: { sourceVideoId: string; generatedAt: string; revision: number };
};

export type AdaptationRecord = {
  variantId: string;
  platform: string;
  status: string;
  recipe: AdaptationRecipe;
  artifact: { objectKey: string; thumbnailObjectKey: string | null; completedAt: string | null; state: 'current_recipe_rendered' | 'previous_recipe_artifact_available' } | null;
  renderState: string;
  quality: { durationSeconds?: number; dimensions?: string; sizeMB?: number; validationIssues?: string[] } | null;
  appliedRecipe: { focalCompositionApplied?: boolean; safeZoneGuideRequested?: boolean; safeZoneGuideRendered?: boolean; headlineOverlay?: boolean; timedCaptionsRendered?: boolean; audioNormalized?: boolean } | null;
  errorMessage: string | null;
  safeguards: string[];
};

export type PublishingIntentSummary = {
  id: string;
  status: string;
  scheduledAt: string;
  postedAt: string | null;
  creatorApprovedAt: string | null;
  retryCount: number;
  nextAttemptAt: string | null;
  deadLetteredAt: string | null;
  errorMessage: string | null;
  variant: { id: string; platform: string; videoId: string };
  socialAccount: { id: string; platform: string; username: string | null; displayName: string | null; isActive: boolean };
  publishingAttempts: Array<{ attemptNumber: number; status: string; requestedAt: string; completedAt: string | null; errorMessage: string | null }>;
};

export type Readiness = {
  sourceVideoId: string;
  state: 'attention_required' | 'ready_for_experiment_plan' | 'ready_for_creator_approval' | 'operating';
  sourceReady: boolean;
  connectedDestinations: number;
  preparedVariants: number;
  activePosts: number;
  failedPosts: number;
  reasons: string[];
  safeguards: string[];
};

export type ExperimentScorecard = {
  objective: string;
  baseline: number | null;
  baselineSampleSize: number;
  decisionState: 'awaiting_metrics' | 'needs_baseline' | 'measuring';
  evidenceQuality: 'directional_only' | 'decision_ready_for_review';
  canDeclareWinner: boolean;
  variants: Array<{ variantId: string; platform: string; sampleSize: number; observed: number | null; relativeLift: number | null; state: string; canDeclareWinner: boolean }>;
  metricFreshness?: {
    observations: Array<{ scheduledPostId: string; platform: string; observedAt: string; importedAt: string | null; provenance: unknown; state: 'fresh' | 'aging' | 'stale'; ageMs: number; importLagMs: number }>;
    counts: { fresh: number; aging: number; stale: number };
  };
  safeguards: string[];
};

export type ReachPlan = {
  sourceTitle: string;
  objective: string;
  platforms: string[];
  activeDestinations: number;
  steps: Array<{ id: string; sequence: number; type: string; title: string; action: string; purpose: string; checkpoint: string }>;
  safeguards: string[];
};

export type LearningSignal = {
  decision: 'continue_collecting' | 'retain_and_retest' | 'revise_hypothesis' | 'inconclusive';
  confidence: 'low' | 'moderate' | 'high';
  sufficientSample: boolean;
  relativeLift: number;
  explanation: string;
  safeguards: string[];
};


export type AdaptationPreview = {
  kind: 'video' | 'thumbnail';
  url: string;
  expiresAt: string;
  safeguards: string[];
};

export function getAdaptationPreview(variantId: string, kind: 'video' | 'thumbnail' = 'video', accessToken?: string) {
  return apiRequest<{ data: AdaptationPreview }>(`/growth/adaptations/${variantId}/preview?kind=${kind}`, accessToken);
}


export type ClipCandidate = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  source: 'scene_detection' | 'opening_fallback';
  sceneNumbers: number[];
  captionCueCount: number;
  rationale: string;
  safeguards: string[];
};

export type ClipCandidateResponse = {
  videoId: string;
  platform: string;
  candidates: ClipCandidate[];
  evidence: { sceneCount: number; captionCueCount: number; analysisState: 'scene_detection_available' | 'opening_fallback_only' };
  safeguards: string[];
};

export function getClipCandidates(videoId: string, platform: string, accessToken?: string) {
  return apiRequest<{ data: ClipCandidateResponse }>(`/growth/clip-candidates/${videoId}?platform=${encodeURIComponent(platform)}`, accessToken);
}


export type ProcessingDiagnostic = {
  state: 'queued' | 'processing' | 'ready' | 'failed' | 'dispatch_failed' | 'unknown';
  phase: string | null;
  percent: number | null;
  platform: string | null;
  completedPlatforms: number | null;
  totalPlatforms: number | null;
  retry: { allowed: boolean; manualRetryCount: number; remainingManualRetries: number; recommendedAction: string };
  issue: { code: string; message: string };
  safeguards: string[];
};

export function getProcessingDiagnostics(videoId: string, accessToken?: string, workspaceId?: string) {
  return apiRequest<{ data: { videoId: string; updatedAt: string; diagnostic: ProcessingDiagnostic } }>(`/videos/${videoId}/processing-diagnostics`, accessToken, undefined, workspaceId);
}

export function retryVideoProcessing(videoId: string, accessToken?: string, workspaceId?: string) {
  return apiRequest<{ data: { videoId: string; manualRetryCount: number; nextStep: string } }>(`/videos/${videoId}/retry-processing`, accessToken, { method: 'POST' }, workspaceId);
}
