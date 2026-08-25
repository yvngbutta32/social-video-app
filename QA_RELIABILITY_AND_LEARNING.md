# Reliability and Continuous Learning Verification

**Date:** 2026-08-25

## Creator-specific learning safeguards

The Growth Studio API now evaluates an experiment against the creator workspace’s own recent metric baseline. The evaluator supports views, engagement, follower, and retention objectives; normalizes persisted numeric types; distinguishes positive, negative, and inconclusive outcomes; and refuses to recommend a strategy change until both experiment and baseline have sufficient evidence. Its response explicitly states that it does not infer platform-wide ranking knowledge or guarantee future performance.

## Operational readiness safeguards

The Growth Studio API now reports a source workflow’s operational readiness. It identifies unfinished source processing, missing connected destinations, failed variants, and failed publishing jobs before a creator proceeds. The response is designed to surface recovery work rather than silently treating a workflow as successful.

## Delivery recovery safeguards

Webhook retries now use a bounded, deterministic retry policy. Transient, rate-limited, and server-side failures may be retried with exponential delay inside the configured retry budget. Non-retryable responses and exhausted budgets return a clear recovery state instead of continuing indefinitely. Successful recovery is explicitly recorded in the route response.

## Test evidence

The API pilot, platform-contract, and Growth Studio contract suites all passed. The API gateway’s strict TypeScript validation and production build both passed after the learning, readiness, and retry safeguards were added.

## Creator-controlled publish lifecycle checkpoint

The platform now persists a **draft creator publish intent** separately from creator approval. A creator workspace member may create a future-dated intent only when its source, prepared version, and destination are compatible and belong to the same workspace. The platform-owner oversight identity is explicitly refused for all create and approval mutations.

| Lifecycle concern | Persisted control | Verification outcome |
|---|---|---|
| Duplicate requests | Workspace-scoped idempotency key on `scheduled_posts` | Repeated create request returns the original intent rather than creating a second schedule. |
| Explicit consent | `creator_approved_at` and `creator_approved_by` | Approval is accepted only for a draft with a ready source, ready version, and active creator-owned destination. |
| Queue traceability | `publishing_attempts` with unique post/attempt and workspace/idempotency constraints | Approval creates an initial immutable queued attempt record. |
| Recovery state | Retry count, last/next attempt timestamps, and dead-letter timestamp | Deterministic retry logic returns either a scheduled recovery window or terminal dead-letter outcome. |
| Forensics | Workspace-scoped audit events in the same transaction as create and approval changes | Creator intent and approval state changes are attributable to the requesting workspace user. |

This checkpoint does **not** claim that ViralBoost can publish to every social platform. It creates the safe, auditable scheduling and recovery contract required for a future worker that uses each creator’s authorized official platform connection. No publishing worker or platform ranking control has been asserted or tested in this sandbox.

## Database validation boundary

The shared Prisma schema validates successfully and the client was regenerated against the new lifecycle contract. The additive `4_creator_publish_lifecycle` migration has not been applied here because no disposable Docker-capable PostgreSQL target is available in this sandbox. Production rollout remains gated on applying and testing all incremental migrations against a real disposable PostgreSQL instance.

## Authenticated Growth Studio integration

Growth Studio now uses the existing authenticated session bearer token through a typed browser API client and React Query. It loads ready workspace-owned source videos and active creator-authorized destinations, sends live source-fingerprint and experiment-plan requests, refreshes operational readiness and workspace-baseline learning signals, and renders real destination availability instead of presenting static platform readiness.

The local file chooser and example source remain explicitly preview-only because the current video API accepts a source URL and the production upload-to-private-storage pipeline is not yet complete. A selected local file cannot be mistaken for a live source: the interface tells the creator that a workspace source must exist before live analysis or planning can run.

The web type-check and production build passed after the integration. The complete API pilot/platform/Growth Studio contract suite, API type-check/build, and self-hosted intelligence regression checks also passed.

## Private creator source intake checkpoint

Growth Studio’s file chooser now uploads authenticated creator files to `POST /api/v1/videos/upload`. The API validates the creator workspace, restricts accepted media types to MP4/MOV/WebM/M4V, enforces a configurable 500 MB default limit, stores bytes under a workspace-scoped MinIO object key, and creates a private video record with processing-pending state. The browser then keeps the source locked from live fingerprinting until the API reports `ready`.

Storage credentials are read from deployment environment variables or Docker secret files and are never returned to the browser. The source key includes the workspace boundary and a generated identifier rather than a user-controlled path. The API and web type-checks, source-intake contract assertions, and production builds passed.

The source-processing worker still needs to be connected to the queued record on a Docker-capable persistent deployment target. Until that worker is deployed and tested, a newly uploaded source correctly remains processing-pending rather than being falsely presented as analysis-ready.

## Queued source processing checkpoint

Private source uploads now dispatch a deterministic BullMQ `video-processing` job keyed by the video ID. The dispatcher uses bounded attempts and exponential backoff, while the API records `processingJobId`, queue time, and dispatch failures in the workspace-scoped video metadata. Repeated requests for the same video cannot create a second processing job ID.

The processor bootstrap now reads its actual worker configuration shape, and source retrieval uses the canonical `minio_object_key` and persisted bucket rather than the obsolete `s3_key` field. Growth Studio polls the authenticated source record while processing is pending and unlocks live fingerprinting only after the source status becomes `ready`.

API and web type-checks/builds, Growth Studio contract tests, and processor JavaScript syntax checks passed. Runtime validation of Redis, MinIO, PostgreSQL, FFmpeg, and the BullMQ worker remains gated on a Docker-capable persistent deployment target; this sandbox has no Docker runtime.
