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

## Compliant organic amplification checkpoint

Growth Studio now exposes a server-generated reach architecture for ready creator sources. The plan sequences a creator-authorized native seed, approved cross-platform adaptations, voluntary share and conversation surfaces, an optional creator-approved collaboration brief, and an evidence checkpoint. Each step states its purpose and the measurement checkpoint so distribution is treated as a testable operating loop rather than an impression promise.

The plan explicitly separates planned distribution, confirmed delivery, and observed performance. It does not purchase reach, create fake engagement, use unauthorized access, spam communities, or claim control over recommendation ranking. Official platform capabilities remain a creator-authorized execution boundary; current research is recorded in `PLATFORM_AMPLIFICATION_RESEARCH.md`.

The reach-plan contract, API type-check/build, and web type-check/build passed.

## Platform foundation checkpoint

The platform foundation now exposes an explicit capability registry for TikTok, Instagram, YouTube, Facebook, X, and LinkedIn. Each platform declares its official publishing mode, creator-account requirement, draft/scheduling support, metrics state, and safeguards. Capabilities marked `connector_required` are not presented as production-ready.

Social-account access and refresh tokens are encrypted with AES-256-GCM using the deployment `ENCRYPTION_KEY`; API responses redact encrypted credential fields. The previous refresh-token and metrics-sync success stubs now return an honest not-configured response rather than recording synthetic state. The legacy browser-based publisher is blocked by default and requires an explicit development-only opt-in, keeping production delivery behind official creator-authorized connectors.

Platform capability, token round-trip, credential-redaction, creator-autonomy, and API build checks passed. Actual OAuth, token refresh, official publishing, and platform metrics ingestion remain deployment-gated until platform app credentials and approved permissions are configured.

## Outcome scorecard and platform trust checkpoint

Growth Studio now has a baseline-relative experiment scorecard endpoint and creator-facing panel. It deduplicates metric snapshots by scheduled post, reports sample size, observed objective value, relative lift, and cautious states such as `awaiting_metrics`, `needs_baseline`, and `measuring`. This makes product value legible through creator outcomes rather than unsupported reach promises.

The platform foundation also includes an explicit capability registry, AES-256-GCM credential encryption, redaction of encrypted tokens from API responses, honest not-configured responses for unsupported refresh and metric-sync connectors, and a production block on legacy browser automation. Full API and web validation passed for this checkpoint.

## Decision-quality checkpoint

The experiment scorecard now distinguishes directional-only evidence from decision-ready-for-review evidence. It requires at least three observations per variant and five baseline observations before a variant can be marked eligible for winner review. Growth Studio suppresses percentage-lift claims for smaller samples and labels them as directional, while continuing to surface the creator’s own baseline and collection state.

The scorecard contract, API type-check/build, and web type-check/build passed. This safeguard is designed to protect creator trust and investor-grade measurement quality: a small sample can inform the next test, but it cannot be presented as a reliable causal result or future-performance guarantee.

## Premium delivery-readiness UX checkpoint

Growth Studio now distinguishes an active creator-connected destination from an official connector that is actually ready for production delivery. A connected account whose platform connector remains unconfigured is labeled `Connected · official connector required` rather than presented as publish-ready. The creator-facing scorecard continues to suppress winner-style percentage claims until minimum evidence thresholds are met.

Web type-check/build and API Growth Studio type-check/build plus contract validation passed. This keeps the premium workflow truthful while official OAuth, publishing, and metrics connectors remain deployment-gated.

## One-source multi-platform creator checkpoint

Growth Studio now supports the complete declared destination set—TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, X, and LinkedIn—when the creator selects experiments. The browser maps selections to the server’s shared platform contract rather than falling back to YouTube for unknown labels. Each destination retains its native tone, mark, and adaptation identity.

Active accounts still show their official connector readiness explicitly. A connected account without a production-tested official connector is not represented as publish-ready, preserving creator control and truthful execution boundaries.

Web type-check/build and API Growth Studio type-check/build plus contract validation passed.

## Durable multi-platform experiment checkpoint

The live experiment-plan endpoint now creates or reuses workspace-owned `VideoVariant` records using a deterministic plan key. The response includes a durable `variantId`, while active destinations remain marked `variant_rendering_required` until the processor produces a ready asset. This closes the gap between a transient planning response and the later creator approval/publishing lifecycle.

The browser uses the durable variant ID for experiment identity and labels pending variants as rendering required rather than approval-ready. The source, variant, destination, approval, scheduling, and delivery boundaries remain separate.

Growth, pilot, and platform contracts, API type-check/build, and web type-check/build passed.

## Creator delivery observability checkpoint

Added a workspace-scoped `GET /publishing/intents` history endpoint with bounded status filtering and recent attempt summaries. Growth Studio now auto-refreshes recent creator-approved intents and displays platform, destination, intent state, and latest attempt state. This makes queued, retrying, failed, and published outcomes visible without giving the developer operational content controls.

The experiment-plan endpoint also persists or reuses workspace-owned variants through a deterministic plan key and keeps approval blocked until the variant is rendered and ready. API contracts, type-check/build, web build, and processor syntax validation passed.

## Variant identity and artifact-reuse checkpoint

The Growth Studio experiment-plan transaction now reuses a matching planned variant by deterministic `planKey` and, when present, reuses the processor-produced ready artifact for the same source and platform. It preserves prior generation metadata while attaching the experiment hypothesis, preventing duplicate platform variants and avoiding a false pending state when a rendered artifact already exists.

The response remains explicit: a connected destination is not enough for approval; the variant must be rendered and ready. Growth, pilot, and platform contracts plus API and web production builds passed after this correction.

## Durable processing progress checkpoint

The processor now persists structured progress under each video’s `metadata.processing` record. It reports initialization, active platform rendering, platform completion, deduplicated-output completion, final readiness, and failure state with phase, percentage, platform count, timestamps, and retryability context. This gives the creator UI a truthful basis for progress and recovery messaging while preserving existing FFmpeg and MinIO behavior.

The progress update is workspace-safe through the video ID already authorized by the queued processing contract. Processor syntax checks, Growth/Pilot/Platform contracts, API type-check/build, and web type-check/build passed.

## Strict official platform webhook boundary checkpoint

The public provider callback endpoint no longer returns a false success for unverified or unprocessed events. TikTok, Instagram, and YouTube callbacks now require a configured deployment secret (environment or secret file), HMAC-SHA256 verification with timing-safe comparison, and optional five-minute timestamp replay protection. Unsupported platforms are rejected, and even a verified callback returns an explicit not-implemented response until a certified connector maps it to a creator-owned account and durable delivery or metric transition.

The regression suite covers valid signed payloads, invalid signatures, stale timestamps, absent configuration, and public-route security messaging. API/web builds and processor syntax validation passed.

## Official metric-ingestion readiness checkpoint

Added the additive `5_metric_ingestion_provenance` migration and schema fields for an idempotent connector `ingestionKey`, immutable connector provenance, and import freshness. A private `/internal/connectors/metrics` contract now accepts only a token-authenticated connector worker, resolves the observation to an active creator-owned scheduled post by social account and platform post ID, upserts its official metric snapshot, and records an `official_metric_ingested` usage event in the same transaction.

Growth Studio scorecards now surface fresh, aging, and stale observation counts. They make data recency visible without implying that metric freshness predicts future reach. The connector token is deployment-secret backed; no creator browser route can submit metric imports. Prisma validation/generation, focused API and web validation, and regression coverage passed. Applying the migration and exercising a real official connector remains a persistent-host release gate.
