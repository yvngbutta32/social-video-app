# ViralBoost: Complete Product Scope, Current State, and Remaining Roadmap

**Assessment date:** August 26, 2026
**Basis:** The current primary repository (`social-video-app`), the native companion (`viralboost-mobile`), validated contract and quality checks, maintained risk documentation, and the official platform integration research recorded in this project. This report separates **implemented and test-validated behavior** from **planned work** and **external certification gates**.

## 1. What ViralBoost Is Intended to Accomplish

ViralBoost is an **invite-only creator operating system** for a small, controlled cohort of creators. Its purpose is to help a creator turn media they are permitted to use into platform-aware, editable drafts; review and approve any next action themselves; and learn from measured, creator-owned outcomes over time.

> ViralBoost is not a generic scheduler, a bot network, an audience-placement system, or a mechanism for guaranteed virality. It cannot control a platform’s recommendations, reach, follower growth, or public feed placement.

The intended creator journey is:

| Stage | Intended creator experience | Product boundary |
|---|---|---|
| 1. Private intake | Import video media the creator owns or is permitted to use. | Media stays workspace-scoped; no arbitrary public scraping or unauthorized account access. |
| 2. Private processing | Create processing records and platform-native adaptation recipes from one source. | A draft is not a claim that it is published, public, or predicted to perform well. |
| 3. Creator-selected targets | Choose TikTok, Instagram Reels, YouTube Shorts, and/or LinkedIn for a specific source. | Target selection prepares editable intent only; it does not connect accounts or authorize a post. |
| 4. Non-destructive editing | Adjust clip range, framing, focal composition, captions, headline overlay, and audio preferences. | Original source media is preserved. A revised recipe needs a new render before it is current. |
| 5. Private review | Review a time-limited, workspace-authorized artifact when a private renderer has completed it. | Preview URLs are short lived; neither storage credentials nor public object paths are exposed. |
| 6. Creator approval | Review action readiness and explicitly approve an eligible, creator-owned destination. | Owner/developer oversight is read only; readiness does not schedule or publish anything by itself. |
| 7. Authorized execution | Use an official platform connector to execute an explicitly approved action. | An official OAuth connection, platform requirements, and actual provider confirmation are mandatory. |
| 8. Evidence-based learning | Compare official measurements against the creator’s own baseline and decide whether evidence is still directional or ready for review. | The product avoids causal, ranking, reach, or future-performance guarantees. |

## 2. Current Product Scope: What Is Implemented

### Creator workspace and access controls

The system has an invite-only workspace model with explicit workspace selection. Clients carry the selected workspace through authenticated requests. Route-level guards distinguish read access from creator-only mutations; resource mismatches return non-leaking not-found behavior. The developer/owner is explicitly an oversight identity: they can see authorized high-level operations but cannot edit, approve, or publish creator media.

| Capability | Current state | Evidence boundary |
|---|---|---|
| Invite-only access and workspace membership | Implemented | A live invited-account acceptance test is still required. |
| Explicit selected workspace | Implemented across creator data routes, source workflows, growth/adaptation operations, analytics, publishing intent, accounts, and activity data. | Multi-workspace behavior still needs staging validation using a real invited user. |
| Creator versus owner role boundary | Implemented; creator-write controls reject read-only owner oversight. | Requires a staging role-matrix exercise before release. |
| Audit events and activity timeline | Implemented with privacy-safe projections. | Needs verification against a deployed audit-log database. |

### Private media intake, processing, and recovery

ViralBoost has a self-owned source workflow designed around MinIO-compatible private storage, workspace-scoped object keys, server-authorized multipart upload sessions, queue dispatch, deterministic job identities, safe diagnostics, bounded retry, and resumable device-side recovery metadata. The mobile companion keeps sensitive access material in secure storage and keeps only safe recovery metadata in ordinary local storage.

| Capability | Current state | What it does not establish yet |
|---|---|---|
| Creator-authorized multipart uploads | Implemented and contract-tested. | Device-reachable private object storage validation. |
| Resumable upload recovery | Implemented using non-sensitive recovery metadata. | Real interruption/retry behavior against deployed storage. |
| Processing dispatch and retry | Deterministic BullMQ design with bounded creator-visible retry. | A persistent Redis, worker, database, MinIO, and FFmpeg end-to-end run. |
| Safe source diagnostics | Implemented; raw infrastructure error text is withheld from creators. | Real fault-injection testing in staging. |
| Expired multipart cleanup | Protected cleanup trigger exists. | A persistent scheduled caller must be configured in the deployed environment. |

### Platform adaptation and non-destructive editing

From a source, the product creates durable platform variants and versioned recipes. Creators select only the targets they want per source. Native Review and Edit Lab support explicit target selection, deterministic adaptation plans, clip candidates when persisted scene evidence exists, trim, framing/focal composition, caption preferences, headline overlay, and audio normalization preference. These changes are non-destructive: a recipe revision produces a new rendering lifecycle rather than altering the original source.

| Capability | Current state | Current limitation |
|---|---|---|
| Creator-chosen platform targets | Implemented for TikTok, Instagram Reels, YouTube Shorts, and LinkedIn. | A source target is local workflow preference until production cross-device policy is defined and tested. |
| Platform-native adaptation plan | Implemented as durable, workspace-owned variants/recipes. | It is a preparation plan, not a performance prediction. |
| Scene-aware clip candidates | Implemented when processor scene/caption evidence is available; honest opening fallback otherwise. | Requires live processor scene analysis for runtime proof. |
| Manual non-destructive edits | Implemented with validated recipe revisions and deterministic re-render identity. | Requires deployed renderer proof and physical-device usability validation. |
| Artifact render lifecycle | Queued/rendering/ready/prior-artifact/failure states are represented. | Real storage, FFmpeg, queue, and worker orchestration remain staging-gated. |
| Private artifact preview | Implemented with workspace authorization and short-lived signed URLs. | Needs a browser/device-reachable private artifact endpoint and actual artifact playback testing. |

### Native companion application

The Expo native companion provides portrait-first creator flows for Home, source intake, Library, Review, Edit Lab, Learn, and Profile/workspace activity. It uses secure session storage for sensitive tokens and workspace selection, local persistence for safe source and draft metadata, selected-platform persistence per source, and accessible labels/states for target selection, connection status, and plan refresh actions.

| Capability | Current state | Validation status |
|---|---|---|
| iPhone and Android codebase | Implemented as a shared Expo native application. | Type checks, linting, deterministic tests, and Expo Doctor pass. Physical device acceptance remains open. |
| Mobile authentication/session model | Implemented against the self-owned API, including native refresh contract. | Needs real invite, sign-in, rotated-refresh, logout, and expiry testing against deployed API. |
| Native source synchronization | Implemented without overwriting device-only drafts. | Needs cross-device/multi-workspace staging validation. |
| Review accessibility semantics | Implemented for selected state, connection status, and private-draft action clarity. | VoiceOver and TalkBack testing, Dynamic Type, contrast, and keyboard/assistive-flow validation remain open. |

### Official platform boundary and action readiness

The product intentionally treats platforms as external, creator-authorized boundaries. Capability records identify the official delivery model, known prerequisites, safeguards, and whether a connector is actually configured. Tokens are encrypted at rest using AES-256-GCM and credential fields are redacted from API responses. Browser automation is blocked from production delivery. Native Review presents a server-derived action-readiness result based on the selected workspace’s connector configuration, authorization activity, and token-expiry facts.

| Platform | Current adaptation target | Current official action state | Verified external prerequisites |
|---|---|---|---|
| TikTok | Yes | Connector is not certified/deployed. | Registered app, approved `video.publish` scope, creator authorization, and audit before treating API-posted content as publicly visible. [1] |
| Instagram Reels | Yes | Connector is not certified/deployed. | Eligible professional account, required official permissions, possible Page Publishing Authorization, and media-hosting requirements. [2] |
| YouTube Shorts | Yes | Connector is not certified/deployed. | Authorized upload scope and API-project audit before treating an API upload as publicly visible. [3] |
| LinkedIn | Yes | Connector is not certified/deployed. | `w_member_social`, authenticated creator identity, and explicit visibility at final action time. [4] |

The present readiness endpoint is deliberately a **gate**, not a delivery mechanism. It can say that an official connector is missing, a creator connection is absent, or an authorization has expired. It cannot certify a provider action until an actual certified connector receives and reconciles the platform response.

### Learning, analytics, and owner oversight

The API has baseline-relative learning and scorecard contracts that distinguish small-sample directional evidence from stronger review-ready evidence. It carries metric provenance/freshness concepts and rejects synthetic success messaging. The owner oversight view is read-only and provides authorized health/activity visibility rather than fictional campaign performance or content control.

| Capability | Current state | Current limitation |
|---|---|---|
| Baseline-relative scorecards | Implemented with evidence thresholds and cautious states. | Requires official metrics collected from a certified connector and database integration fixtures. |
| Metrics provenance/freshness | Data model and private connector-ingestion boundary are implemented. | No live provider metric importer is certified. |
| Analytics correctness hardening | Explicit workspace filtering and latest-observation aggregation rules are implemented and verified with deterministic tests. | Must still be proven against real PostgreSQL/Timescale data and real reporting traffic. |
| Owner operational health | Read-only safe readiness projection is implemented. | Needs staging observability, alerts, dashboards, and incident response proof. |

## 3. Technical Architecture

| Layer | Main technologies and role | Security/reliability role |
|---|---|---|
| Native companion | Expo SDK 54, React Native, Expo Router, TypeScript, SecureStore, AsyncStorage. | Runs creator workflows; retains only bounded non-sensitive recovery/draft metadata outside secure storage. |
| Web workspace | Next.js 16, React, TypeScript, React Query. | Provides browser creator and read-only developer/owner experiences. |
| API gateway | Hono, Zod, JWT, Prisma. | Enforces selected-workspace access, role boundaries, input validation, safe error responses, and private API contracts. |
| Data model | PostgreSQL/Timescale-oriented Prisma schema. | Models workspaces, memberships, sources, variants, recipe revisions, intents, attempts, accounts, metrics, and audit events. |
| Object storage | Self-owned MinIO/S3-compatible object storage. | Stores private sources and artifacts under workspace-specific keys; signed review URLs have limited lifetime. |
| Work queues and workers | Redis/BullMQ plus processor workers and FFmpeg. | Supports deterministic source/variant job identity, progress, bounded retries, and recovery states. |
| Platform connector layer | Official OAuth/publishing/metrics boundary, encrypted tokens, HMAC webhook verification. | Avoids unapproved browser automation, raw token exposure, and false success claims. |
| Operations | Dependency readiness, rate limits, CI contracts, diagnostics, audit events. | Must be completed with persistent deployment, monitoring, backups, and fault recovery exercises. |

## 4. What Still Needs to Be Built or Proven

### A. Highest-priority product and platform work

The most important missing capability is **one fully certified official connector**, delivered end to end. The correct approach is depth before breadth: choose one supported platform, implement its official OAuth flow with state/PKCE and the narrow required scopes, discover the creator’s account, encrypt and rotate tokens, upload/submit media, record idempotent action attempts, persist the platform post ID, reconcile asynchronous status, collect official metrics, process revocation, and expose recovery guidance. The product should not activate the other platforms as publish-capable until each has equivalent provider-specific evidence.

| Priority | Remaining work | Completion standard | Dependency |
|---:|---|---|---|
| P0 | Certified first official connector | A selected creator completes authorized OAuth, approves a rendered artifact, receives a real provider post ID, and receives fresh official metrics with retries/reconciliation. | Provider app registration, credentials, scopes, audit/review, staging account. |
| P0 | Persistent staging stack | PostgreSQL migrations, Redis, MinIO, FFmpeg worker, API, web, and observability run together; key failures recover. | Docker-capable or equivalent persistent host. |
| P0 | Database/queue/storage integration tier | Migration, upload, render, retry, cleanup, and analytics tests run against disposable real services. | Persistent staging infrastructure. |
| P0 | Physical mobile acceptance | Native auth, upload, recovery, Review, Edit Lab, signed preview, and workspace switching run on iPhone and Android devices. | Test devices and device-reachable staging. |
| P1 | Accessible mobile validation | VoiceOver, TalkBack, Dynamic Type, contrast, loading/error flows, and one-handed portrait usability are verified. | Physical devices and structured test cases. |
| P1 | Analytics/learning proof | Official metrics appear exactly once, remain fresh/provenanced, and scorecards match database-backed fixtures. | Certified official connector and deployed database. |
| P1 | Operations and recovery | Scheduled multipart cleanup, SLOs, dashboards, alerts, backup/restore, provider outage, queue failure, and storage failure drills. | Persistent host, monitoring, incident ownership. |
| P1 | Security and policy release work | Threat model, external review, privacy policy, terms, retention/deletion policy, support/recovery procedure, store compliance. | Legal/business ownership and release environment. |
| P2 | Premium creator workflow depth | Better timeline editing, caption workflow, thumbnail/cover design controls, collaboration briefs, controlled experimentation views, and cohort usability research. | Validated renderer and a small creator cohort. |
| P2 | Competitive evidence | Measure activation, time-to-ready draft, delivery success, processing recovery, metric freshness, creator retention, and baseline-relative outcomes. | Invited cohort with consented, anonymized analytics. |

### B. Code/documentation cleanup still needed

The root `README.md` still contains legacy claims about Playwright publishing, anti-detection, viral prediction, automatic A/B promotion, and multi-platform delivery that conflict with the current creator-authorized product boundary. That document should be rewritten before it is used as product, investor, sales, or engineering guidance. The maintained audit, reliability ledger, and capability code should be treated as the more accurate evidence source until the README is corrected.

The Expo dependency graph also has a known transitive advisory gate. It should be remediated only through a tested Expo-SDK-supported dependency update, because prior manual overrides broke the Expo-compatible Vitest/Vite graph and were intentionally reverted.

### C. External blockers that cannot be truthfully “coded around”

| External requirement | Why it cannot be bypassed |
|---|---|
| Official platform app credentials, scopes, reviews, and audits | Providers control OAuth, API access, audits, rate limits, and what actions their APIs permit. |
| Persistent database, queue, storage, and FFmpeg environment | End-to-end media processing, delivery, and recovery cannot be certified from isolated code contracts alone. |
| Device and store validation | Native behavior, accessibility, signing, and store acceptance require real device and account environments. |
| Legal/privacy and policy ownership | Consent, retention, deletion, creator agreements, disclosures, and store statements require owner/legal decisions. |
| Real creator cohort evidence | Competitive effectiveness, retention, and learning value must be measured with real consenting users rather than inferred from code. |

## 5. Validation Evidence to Date

| Area | Current validation evidence | What the evidence does not cover |
|---|---|---|
| API | Contract scripts for authorization, workspace resolution, growth/adaptation, artifacts, processing diagnostics, capabilities, truthful boundaries, analytics integrity, builds, lint, TypeScript, and production dependency audit. | Real provider APIs, database transactions, Redis, MinIO, worker processing, and network faults. |
| Native app | 15 deterministic test files / 37 tests; lint, TypeScript, and Expo Doctor checks passed. | Physical iOS/Android experience, hardware/media-library behavior, accessibility services, and device-network interruptions. |
| Web | Recent web tests, lint, type-check, and production build passed during the preceding validated milestones. | Browser end-to-end flows against a live invited workspace and a fully deployed API. |
| Security/privacy | Workspace contract tests, creator/owner action boundaries, encrypted-token redaction, rate limiting, webhook verification, and safe error contracts are implemented. | Independent penetration test, live key management review, and provider-side OAuth security certification. |

## 6. Recommended Delivery Sequence

The next best move is not to add broad new “viral” features. The credible path is to complete one **vertical slice** from invite to measurable official outcome:

1. Provision a persistent, private staging environment with PostgreSQL, Redis, MinIO, FFmpeg worker, API, web, and monitoring.
2. Apply and verify the full migration chain with disposable staging data; test backup and restore.
3. Choose one official platform and complete provider registration/audit requirements.
4. Implement and test its OAuth, account discovery, scoped token storage/rotation, recovery, and revocation flow.
5. Move a rendered private artifact through explicit creator approval to an official provider action; store and reconcile the provider’s actual post ID.
6. Ingest official metrics into the provenance/freshness data model and compare an experiment to the creator’s own baseline.
7. Validate the same flow on both native platforms, then run a small invited cohort with clear consent and measured outcomes.
8. Only after this vertical slice is reliable should ViralBoost expand official publishing breadth, advanced editing depth, or marketing claims.

## 7. Current Positioning: What Can Be Said Honestly

ViralBoost can be described as an **invite-only, privacy-first creator workflow platform under active hardening**. It already contains a meaningful self-owned foundation for private source intake, platform-targeted draft preparation, non-destructive editing, artifact review, explicit creator approval, workspace isolation, and cautious learning. It is **not yet a finished launch product**, a guaranteed-growth system, or a certified multi-platform publisher.

It can become a strong rival in the creator workflow category only by proving a reliable official connector, fast and trustworthy private media processing, polished native usability, and measurable creator decision value. Feature breadth alone is not evidence of competitiveness; reliability, provider compliance, user trust, and observed creator outcomes are the decisive proof points.

## References

[1]: https://developers.tiktok.com/docs/en/content-posting-api-get-started "TikTok for Developers — Content Posting API: Get Started"
[2]: https://developers.facebook.com/documentation/instagram-platform/content-publishing "Meta for Developers — Instagram Content Publishing"
[3]: https://developers.google.com/youtube/v3/docs/videos/insert "Google for Developers — YouTube Data API: videos.insert"
[4]: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin "Microsoft Learn — Share on LinkedIn"
