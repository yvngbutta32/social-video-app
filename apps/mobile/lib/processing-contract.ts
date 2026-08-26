export type ProcessingDiagnostic = {
  state: "queued" | "processing" | "ready" | "failed" | "dispatch_failed" | "unknown";
  phase: string | null;
  percent: number | null;
  platform: string | null;
  completedPlatforms: number | null;
  totalPlatforms: number | null;
  retry: { allowed: boolean; manualRetryCount: number; remainingManualRetries: number; recommendedAction: string };
  issue: { code: string; message: string };
  safeguards: string[];
};

export function parseProcessingDiagnostic(payload: unknown) {
  const data = (payload as { data?: { videoId?: string; updatedAt?: string; diagnostic?: ProcessingDiagnostic } })?.data;
  if (!data?.videoId || !data.diagnostic?.state || !data.diagnostic.retry || !data.diagnostic.issue) {
    throw new Error("The processing update was incomplete. Try refreshing this source again.");
  }
  return data as { videoId: string; updatedAt: string; diagnostic: ProcessingDiagnostic };
}

export function processingStateTitle(state: ProcessingDiagnostic["state"]) {
  return ({ queued: "Queued for private processing", processing: "Private processing in progress", ready: "Adaptations are ready to review", failed: "Processing needs attention", dispatch_failed: "Queue connection needs attention", unknown: "Processing state not available" })[state];
}
