# ViralBoost

**ViralBoost** is an invite-only, privacy-first creator operating system under active development. It helps authorized creators turn permitted source media into platform-aware, editable private drafts; review the resulting artifacts; explicitly approve eligible actions; and learn from measured outcomes.

> ViralBoost does **not** control recommendation systems, public feed placement, reach, followers, views, fame, or platform ranking. It does not use bots, fake engagement, spam, browser-automation delivery, or unauthorized account access. Every external platform action must use an official creator-authorized integration and remain subject to the platform’s rules and response.

## Product Boundary

| ViralBoost does | ViralBoost does not do |
|---|---|
| Preserves private, workspace-scoped creator sources and drafts. | Guarantee distribution, performance, follower growth, or revenue. |
| Produces transparent platform-native adaptation recipes. | Claim that a recipe is the objectively best-performing edit. |
| Supports non-destructive refinement and private artifact review. | Mutate the original source file or expose storage credentials. |
| Requires explicit creator approval and official connector readiness. | Automatically publish across all selected targets or bypass approval. |
| Uses baseline-relative, evidence-quality-aware learning. | Present small samples as causal proof or future-performance guarantees. |
| Gives the developer/owner read-only authorized oversight. | Let the owner edit, approve, or publish creator media. |

## Intended Creator Journey

1. A selected creator signs in through the invite-only workspace flow and selects an authorized workspace.
2. The creator imports media they own or are permitted to use through private, workspace-scoped source intake.
3. The creator chooses one or more targets for that source: TikTok, Instagram Reels, YouTube Shorts, and/or LinkedIn.
4. ViralBoost creates transparent, durable adaptation recipes and optional evidence-backed clip candidates.
5. The creator refines the draft non-destructively: trim, framing/focal composition, caption preference, headline overlay, and audio preference.
6. The renderer produces a private artifact; the creator reviews it using a short-lived, workspace-authorized preview.
7. The creator can see whether an official connector, creator authorization, and token state clear the action-readiness gate.
8. Only after an eligible creator explicitly approves an action may a future certified official connector attempt a platform action.
9. Official measurements, when a connector is available, are compared with the creator’s own baseline and labeled by evidence quality.

## Current Implementation

| Area | Implemented foundation | Remaining validation boundary |
|---|---|---|
| Workspace access | Invite-only membership, explicit selected workspace, creator-write versus owner-read-only controls, resource mismatch protection, audit events. | Real invited multi-workspace acceptance tests on a deployed database. |
| Media intake | Private MinIO/S3-compatible multipart sessions, safe recovery metadata, deterministic queue dispatch, bounded retry, safe diagnostics. | Device-reachable storage, Redis, PostgreSQL, FFmpeg, and worker validation together. |
| Adaptation | Durable platform recipe variants, creator-chosen targets, scene-aware candidates when source evidence exists, non-destructive revisioning. | Live renderer and real source-media verification. |
| Private review | Signed, five-minute artifact preview URLs that avoid exposing storage credentials. | Browser/device-reachable object storage and actual playback verification. |
| Action readiness | Server-derived state from selected workspace connector configuration, creator authorization activity, and token expiry. | A certified official provider connector that can execute and reconcile a real action. |
| Learning | Baseline-relative scorecards, metric provenance/freshness concepts, cautious evidence thresholds. | Official provider metric ingestion against deployed database fixtures. |
| Mobile | Expo native companion for iPhone and Android with Home, Library, Review, Edit Lab, Learn, and Profile. | Physical iOS/Android, accessibility-service, and network interruption testing. |
| Oversight | Read-only owner operational health and privacy-safe workspace activity. | Staging observability, alerting, and incident-recovery drills. |

## Architecture

```text
┌───────────────────────────────────────────────────────────────────┐
│ Creator surfaces                                                   │
│  apps/mobile: Expo / React Native          apps/web: Next.js       │
└───────────────────────────────────┬───────────────────────────────┘
                                    │ authenticated, selected-workspace requests
┌───────────────────────────────────▼───────────────────────────────┐
│ API gateway: Hono + Zod + JWT + Prisma                             │
│ Workspace access · sources · adaptations · accounts · learning     │
│ private previews · creator intents · owner read-only health        │
└───────────────┬────────────────────┬───────────────────────┬──────┘
                │                    │                       │
┌───────────────▼─────┐  ┌───────────▼──────────┐  ┌────────▼────────┐
│ PostgreSQL/Timescale │  │ Redis + BullMQ       │  │ MinIO / S3      │
│ workspace data,      │  │ source and variant   │  │ private sources │
│ variants, metrics,   │  │ processing, retries  │  │ and artifacts   │
│ intents, audit       │  └───────────┬──────────┘  └─────────────────┘
└─────────────────────┘              │
                           ┌─────────▼──────────┐
                           │ FFmpeg processor   │
                           │ private rendering  │
                           └────────────────────┘
                                    │
                           ┌────────▼──────────┐
                           │ Official provider │
                           │ OAuth / publish / │
                           │ metrics boundary  │
                           └───────────────────┘
```

The application is intentionally **self-owned at the core**: source storage, queues, workers, rendering, access controls, analytics data model, and audit records are designed to run in infrastructure controlled by the deployment owner. Social platforms remain external boundaries; their official APIs, authorization, review, rate limits, and policies control what actions can occur.

## Repository Map

| Path | Responsibility |
|---|---|
| `apps/api-gateway` | Hono API, Prisma-backed contracts, workspace authorization, source/adaptation/account/publishing/learning boundaries. |
| `apps/web` | Next.js creator workspace and read-only owner oversight experience. |
| `apps/mobile` | Expo/React Native companion preserved from the active native project. |
| `workers/processor` | Private source and variant processing plus FFmpeg rendering contracts. |
| `workers/intelligence` | Self-hosted deterministic intelligence and learning-related support paths. |
| `workers/delivery` | Future official provider delivery boundary; not a browser-automation mechanism. |
| `research` | Supporting research material, not a source of runtime truth. |
| `QA_RELIABILITY_AND_LEARNING.md` | Verification ledger, reliability boundaries, and known runtime limitations. |
| `VIRALBOOST_FULL_APPLICATION_AUDIT.md` | Historical audit and remediation record; consult it with later verified checkpoints. |

## Official Platform Requirements

Platform selection means **draft preparation**. It does not by itself create an official connection, make a target action-ready, or invoke a platform action.

| Target | Current app state | Official action prerequisites |
|---|---|---|
| TikTok | Adaptation target; connector not certified/deployed. | Registered app, approved `video.publish` scope, creator authorization, and provider audit before treating API-posted content as publicly visible. [1] |
| Instagram Reels | Adaptation target; connector not certified/deployed. | Eligible professional account, required publishing permission, applicable Page Publishing Authorization, and provider media-hosting requirements. [2] |
| YouTube Shorts | Adaptation target; connector not certified/deployed. | Creator-authorized upload scope and API-project audit before treating an API upload as publicly visible. [3] |
| LinkedIn | Adaptation target; connector not certified/deployed. | Creator `w_member_social` authorization, authenticated identity, and an explicit final visibility choice. [4] |

## Security and Trust Controls

The current codebase includes these foundational controls:

- **Explicit workspace context** on creator data routes, rather than arbitrary first-membership selection.
- **Creator-only mutation guards** for source, adaptation, approval, and related creator actions; owner oversight remains read-only.
- **AES-256-GCM encryption** for stored provider tokens and API-response credential redaction.
- **Private, workspace-scoped source and artifact keys**; previews are short lived and use signed retrieval URLs.
- **Bounded retry and diagnostic state** that avoids exposing raw infrastructure error strings to creators.
- **Request size limits and distributed rate limiting** with a bounded fallback when the limiter dependency is unavailable.
- **Webhook HMAC verification, timestamp replay protections, SSRF safeguards, and response redaction**.
- **Truthful unavailable states** for features that are not yet backed by a real connector, queue, storage service, or recovery mechanism.

These controls are implementation and contract safeguards, not a substitute for an independent security assessment or a production key-management review.

## Development and Validation

There is no root-level package command: each deployable component manages its own dependency manifest and validation commands.

| Component | Location | Typical validation |
|---|---|---|
| API gateway | `apps/api-gateway` | `npm run lint`, `npm run typecheck`, `npm run build`, targeted `npm run test:*` contract scripts, and `npm audit --omit=dev --audit-level=high`. |
| Web | `apps/web` | `npm run test`, `npm run lint`, `npm run type-check`, `npm run build`, and production dependency audit. |
| Native | `apps/mobile` | `pnpm test`, `pnpm lint`, `pnpm check`, and `npx --yes expo-doctor`. |
| Processor | `workers/processor` | Targeted syntax and renderer-contract verification before any runtime deployment claim. |

Run only the package-specific commands relevant to the changes. A successful build or contract suite verifies code paths and interfaces; it does not prove a deployment’s database, storage, queue, worker, provider, device, or network behavior.

## Release Gates

ViralBoost is **not production-launch ready** until the following are complete and documented.

| Gate | Required evidence |
|---|---|
| Persistent staging | A private persistent deployment runs PostgreSQL, Redis, MinIO, FFmpeg worker, API, web, migrations, and dependency readiness checks together. |
| Certified first connector | One official platform flow completes OAuth with proper state/PKCE, account discovery, encrypted token lifecycle, approved rendered artifact, explicit creator approval, action attempt, provider-post ID reconciliation, revocation, recovery, and official metric ingestion. |
| Data integrity | Database-backed tests cover migrations, latest-observation analytics semantics, source/variant ownership, queue retries, expiry cleanup, and failure recovery. |
| Mobile and accessibility | Physical iPhone and Android validation covers upload, editing, preview, network interruption, voice accessibility, Dynamic Type, contrast, and one-handed portrait use. |
| Security and operations | Secret management, backup/restore, alerting, SLOs, incident runbooks, dependency outage drills, and an external security review are completed. |
| Legal and store readiness | Privacy policy, terms, creator consent, retention/deletion process, platform-policy review, signing, store accounts, and required disclosures are approved by the responsible owner. |
| Cohort evidence | A consented invited cohort demonstrates activation, reliable processing/delivery, metric freshness, retention, and baseline-relative creator decision value. |

## Recommended Delivery Sequence

The highest-value next objective is a single certified vertical slice—not broad feature expansion:

1. Provision private persistent staging and run all migrations.
2. Certify one official provider OAuth/publishing/metrics integration against its sandbox or approved environment.
3. Move one private rendered artifact through explicit creator approval to a confirmed official provider post ID.
4. Ingest and reconcile official measurements, then display a baseline-relative scorecard.
5. Exercise retries, reconnect, revocation, storage/queue outage, and recovery paths.
6. Validate the same flow on physical iPhone and Android devices before enabling further platform delivery breadth.

## Documentation Status

For the detailed current product inventory and complete remaining-work roadmap, see [`apps/mobile/VIRALBOOST_COMPLETE_SCOPE_AND_ROADMAP.md`](apps/mobile/VIRALBOOST_COMPLETE_SCOPE_AND_ROADMAP.md). For research-backed provider prerequisites, see [`apps/mobile/INTEGRATION_POLICY_EVIDENCE.md`](apps/mobile/INTEGRATION_POLICY_EVIDENCE.md).

## License

Proprietary. All rights reserved.

## References

[1]: https://developers.tiktok.com/docs/en/content-posting-api-get-started "TikTok for Developers — Content Posting API: Get Started"
[2]: https://developers.facebook.com/documentation/instagram-platform/content-publishing "Meta for Developers — Instagram Content Publishing"
[3]: https://developers.google.com/youtube/v3/docs/videos/insert "Google for Developers — YouTube Data API: videos.insert"
[4]: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin "Microsoft Learn — Share on LinkedIn"
