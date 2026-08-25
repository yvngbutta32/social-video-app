export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, accessToken?: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body && !(typeof FormData !== 'undefined' && init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

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

export type ApiSocialAccount = {
  id: string;
  platform: string;
  username: string | null;
  displayName: string | null;
  isActive: boolean;
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
