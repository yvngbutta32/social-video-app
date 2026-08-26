type Metadata = Record<string, unknown>;

export type ProcessingDiagnostic = {
  state: 'queued' | 'processing' | 'ready' | 'failed' | 'dispatch_failed' | 'unknown';
  phase: string | null;
  percent: number | null;
  platform: string | null;
  completedPlatforms: number | null;
  totalPlatforms: number | null;
  retry: {
    allowed: boolean;
    manualRetryCount: number;
    remainingManualRetries: number;
    recommendedAction: string;
  };
  issue: {
    code: 'none' | 'processing_service_unavailable' | 'storage_unavailable' | 'media_validation_failed' | 'rendering_failed' | 'analysis_failed' | 'processing_failed';
    message: string;
  };
  safeguards: string[];
};

const MAX_MANUAL_RETRIES = 3;

function record(value: unknown): Metadata {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Metadata : {};
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function classifyProcessingIssue(state: ProcessingDiagnostic['state'], rawError: string | null) {
  if (state !== 'failed' && state !== 'dispatch_failed') {
    return { code: 'none' as const, message: 'No processing failure is currently recorded.' };
  }

  const error = (rawError ?? '').toLowerCase();
  if (/minio|s3|storage|upload|download|bucket/.test(error)) {
    return { code: 'storage_unavailable' as const, message: 'Private media storage could not be reached while processing. Your source has not been modified.' };
  }
  if (/redis|queue|econnrefused|connection refused|dispatch/.test(error)) {
    return { code: 'processing_service_unavailable' as const, message: 'The local processing service is temporarily unavailable. Your original source remains private and unchanged.' };
  }
  if (/invalid|unsupported|codec|corrupt|duration|resolution/.test(error)) {
    return { code: 'media_validation_failed' as const, message: 'The media could not be validated for rendering. Review the source format or upload a supported source again.' };
  }
  if (/ffmpeg|render|transcode|filter/.test(error)) {
    return { code: 'rendering_failed' as const, message: 'The platform adaptation render did not complete. You can safely retry; the source and saved edit recipe remain unchanged.' };
  }
  if (/scene|caption|transcript|whisper|analysis/.test(error)) {
    return { code: 'analysis_failed' as const, message: 'Optional source analysis did not complete. A retry may restore scene-aware drafts and caption cues.' };
  }
  return { code: 'processing_failed' as const, message: 'Processing did not complete. You can safely retry while keeping the original source unchanged.' };
}

export function buildProcessingDiagnostic(input: {
  status: string;
  metadata: unknown;
}): ProcessingDiagnostic {
  const metadata = record(input.metadata);
  const processingState = stringOrNull(metadata.processingState);
  const state = processingState === 'dispatch_failed'
    ? 'dispatch_failed'
    : input.status === 'ready'
      ? 'ready'
      : input.status === 'failed'
        ? 'failed'
        : processingState === 'queued' || input.status === 'uploading'
          ? 'queued'
          : input.status === 'processing'
            ? 'processing'
            : 'unknown';
  const manualRetryCount = Math.max(0, Math.floor(numberOrNull(metadata.manualRetryCount) ?? 0));
  const issue = classifyProcessingIssue(state, stringOrNull(metadata.processingError) ?? stringOrNull(metadata.error));
  const retryAllowed = (state === 'failed' || state === 'dispatch_failed') && manualRetryCount < MAX_MANUAL_RETRIES;

  return {
    state,
    phase: stringOrNull(metadata.phase),
    percent: numberOrNull(metadata.percent),
    platform: stringOrNull(metadata.platform),
    completedPlatforms: numberOrNull(metadata.completedPlatforms),
    totalPlatforms: numberOrNull(metadata.totalPlatforms),
    retry: {
      allowed: retryAllowed,
      manualRetryCount,
      remainingManualRetries: Math.max(0, MAX_MANUAL_RETRIES - manualRetryCount),
      recommendedAction: retryAllowed
        ? 'Retry processing when the creator is ready. The original source and any saved adaptation recipe remain unchanged.'
        : state === 'ready'
          ? 'Continue to review or refine the rendered adaptation.'
          : state === 'processing' || state === 'queued'
            ? 'Processing is already in progress. Wait for the next durable progress update before retrying.'
            : 'Manual retry is unavailable. Review the source format or wait for the processing service to recover.',
    },
    issue,
    safeguards: [
      'Diagnostics describe pipeline state; they do not predict content performance or reach.',
      'A retry never changes the original source media.',
      'Raw infrastructure errors are not exposed to creators.',
    ],
  };
}
