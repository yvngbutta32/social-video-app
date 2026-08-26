# ViralBoost Full Application Audit

**Audit date:** August 26, 2026  
**Auditor:** Manus AI  
**Repository baseline:** `8fd84fd` at the beginning of the audit  
**Scope:** Codebase, routes, data contracts, security controls, dependency health, processing, analytics, deployment composition, tests, product workflow, and launch readiness.

## Executive conclusion

ViralBoost contains a **genuinely differentiated foundation** for an invite-only creator growth operating system. Its strongest verified assets are private workspace governance, creator approval boundaries, self-hosted source storage and processing design, durable experiment records, baseline-relative learning, idempotent delivery concepts, encrypted provider tokens, strict webhook signatures, and the recent connector-metric provenance contract.

The application is **not safe to launch yet**. This audit found several concrete blockers, including an authentication middleware-order defect that prevents unauthenticated registration and login, a critical Next.js dependency advisory, analytics paths that can return incorrect or inflated results, ambiguous multi-workspace selection, truthful-behavior failures in legacy routes, unimplemented but success-shaped account/export/recovery endpoints, and lack of real runtime validation.

> **Revised assessment after the full scope:** ViralBoost is **6.2/10 as a technical foundation** and **3.8/10 as a launch-ready product**. The previous higher foundation rating did not account for the newly verified authentication blocker, dependency advisory, and analytics-integrity defects. The strategic product thesis remains strong, but a 10/10 rating is not supportable until the P0 and P1 remediation gates are complete and measured in a real deployment.

| Severity | Count | Meaning |
|---|---:|---|
| **Critical** | 3 | Must be fixed before any creator can be onboarded or the web application is exposed. |
| **High** | 8 | Can compromise tenancy, data correctness, product truthfulness, security, or core user value. |
| **Medium** | 8 | Important launch-quality, operational, and workflow defects that should be closed before a premium launch. |
| **Low / backlog** | 6 | Non-blocking quality, UX, and implementation-debt items. |

## What was verified

The audit reviewed the current API, web, shared Prisma schema, worker code, Compose configuration, existing regression scripts, package manifests, Git state, and generated scan results. It also executed a focused Hono request probe against `POST /api/v1/auth/login` without an authorization header. The probe returned **401 `no authorization included in request` before the login route was entered**, independently confirming the authentication middleware-order defect.

The audit also ran `npm audit --omit=dev --json` for the API and web packages. The API reported no production dependency vulnerabilities. The web package reported one critical dependency group through `next` plus high-severity `nanoid` and nested `postcss` findings; the audit tool reported a non-major upgrade path to `next@14.2.35`. The local JSON output is preserved under `/home/ubuntu/audit-artifacts/` and summarized in `FULL_AUDIT_SOURCES.md`.

No Docker runtime was available in the sandbox, so this audit **did not** claim that Compose, database migrations, MinIO, Redis, FFmpeg, Ollama, observability, or workers run together on a persistent host. No official provider credentials were configured, so OAuth, publishing, provider callbacks, token refresh, and metric ingestion were reviewed as code contracts rather than exercised against real platforms.

## Current architecture scope

| Layer | Current implementation | Assessment |
|---|---|---|
| Creator web | Next.js 14 / React application with dashboard, developer console, Growth Studio, React Query, and `next-auth` client hooks. | Polished workflow foundation, but the session bridge and lint gate are incomplete. |
| API gateway | Hono, Zod, JWT middleware, Prisma, workspace ownership, growth, publishing, analytics, accounts, webhook, owner, and private connector routes. | Broad surface area; several large routes and authorization shortcuts require remediation. |
| Data | PostgreSQL / Timescale-oriented Prisma schema with videos, variants, scheduled posts, attempts, metrics, invitations, accounts, audit/usage events, and webhooks. | Strong conceptual model; migrations have not been applied to a real disposable database in this audit. |
| Storage and processing | MinIO-compatible private source upload, BullMQ dispatch, FFmpeg processor, output deduplication, progress metadata, and local intelligence path. | Valuable design, but runtime orchestration and creator artifact review remain incomplete. |
| Provider boundary | Capability registry, encrypted tokens, webhook HMAC verification, internal metric ingestion contract, and browser-automation production block. | Strong safety direction; no certified OAuth/publishing/metrics connector exists. |
| Operations | Compose definitions for Traefik, Authelia, Gitea, Drone, PostgreSQL, Redis, MinIO, Ollama, workers, Prometheus, Grafana, Loki, Tempo, RabbitMQ, and Postal. | Ambitious but unproven; API readiness is a placeholder and no CI workflow was found. |

# Verified findings and remediations

## Critical findings

| ID | Finding and evidence | Impact | Required fix | Acceptance gate |
|---|---|---|---|---|
| **C-01** | **Public authentication is blocked by global JWT middleware.** `src/index.ts` applies JWT middleware to `/api/v1/*` before mounting `/api/v1/auth`. The focused request probe to `/api/v1/auth/login` returned HTTP 401 before route handling. | No new invited creator can register or log in; refresh, password recovery, and email confirmation also inherit the block. | Mount public auth routes before protected middleware, or narrow the middleware to protected route groups. Explicitly protect only `/change-password`, `/me`, and any other authenticated auth actions. Add route-level tests for register, login, refresh, logout, and protected `/me`. | Registration and login return route-level validation/auth responses without a bearer token; `/me` remains rejected without a valid token. |
| **C-02** | **Web dependency audit reports a critical `next@14.2.3` vulnerability group.** `npm audit` identifies a critical authorization-bypass advisory and additional high/moderate Next.js findings, with a non-major remediation reported at `next@14.2.35`. | A publicly exposed creator application should not launch with a known critical framework advisory. | Upgrade Next.js to at least the audit-recommended patched version, update lockfiles, review Next release notes, rebuild, test route/auth behavior, and re-run production dependency audit. | `npm audit --omit=dev` reports no critical/high production vulnerability, or any exception is documented, time-bounded, and protected by compensating controls. |
| **C-03** | **Analytics can produce incorrect results.** In `analytics.ts`, combined `campaignId`, `videoId`, and `accountId` filters overwrite `where.scheduledPost` instead of composing. The raw time-series query ignores campaign/video/account filters. Several report paths sum all snapshots for a post rather than only the latest observation. | Creator decisions, scorecards, future learning, and investor evidence can be inflated or misattributed. This violates the product’s evidence-based promise. | Create a shared typed analytics filter builder. Compose nested scheduled-post predicates with `AND`. Use a latest-observation CTE/window query or materialized latest-metric view for all aggregate endpoints. Add integration fixtures covering multiple snapshots and every filter combination. | Same filters return consistent totals across overview, time series, platform, video, campaign, realtime, and scorecard surfaces; every post contributes exactly one latest snapshot per reporting window unless the endpoint explicitly models a time series. |

## High findings

| ID | Finding and evidence | Impact | Required fix | Acceptance gate |
|---|---|---|---|---|
| **H-01** | **Workspace selection is ambiguous.** Accounts, analytics, campaigns, videos, and other routes repeatedly call `workspaceMember.findFirst({ where: { userId } })`. No active workspace ID is selected or validated. | A user with more than one workspace can receive data from an arbitrary first membership; multi-tenant correctness is not guaranteed. | Introduce explicit workspace context in the JWT/session and/or an `X-Workspace-Id` header. Validate membership and role through one helper. Reject requests with no active workspace or an unauthorized selection. Replace all implicit `findFirst` selectors. | A user with two workspaces can select each deterministically; cross-workspace requests return 403/404 and contract tests cover every scoped route. |
| **H-02** | **The web/API authentication bridge is not complete.** Growth Studio reads `session.accessToken` through `useSession`, but no server-side NextAuth handler/configuration was found under the web source. | The polished “live API session” workflow may fall back to preview mode and cannot be relied on for creator onboarding. | Implement one tested authentication strategy: NextAuth server handler issuing/refreshing API JWTs, or a same-origin BFF that maintains secure API sessions. Do not expose long-lived provider/API credentials to browser code. | Browser test logs in through invite flow, loads a private source, calls `/growth/*`, and fails safely after session expiry. |
| **H-03** | **Legacy video endpoints are misleading.** `POST /api/v1/videos` stores arbitrary `sourceUrl` directly as `minioObjectKey` and does not queue processing. `POST /:id/publish` returns “Publish queued” while the queue call is commented out. | The API can claim storage or publishing work that did not happen, violating user trust and creating orphaned/inconsistent records. | Remove or hard-disable legacy routes with `410 Gone` until reimplemented; alternatively route them through the validated upload and creator-publish-intent flows. Replace false success messages with explicit connector/rendering requirements. | Every public success response corresponds to a persisted state transition and a real queue job or provider action; regression tests reject deprecated paths. |
| **H-04** | **Authentication recovery and verification routes return success without performing actions.** `forgot-password`, `reset-password`, `verify-email`, and `verify-email/confirm` contain TODOs but return success-shaped responses. Refresh also expects a token in JSON while the issued refresh token is HttpOnly and not returned to the client. | Account recovery, verification, and browser refresh are nonfunctional or misleading. | Implement hashed, single-use, expiring reset/verification tokens; rate-limit requests; use Postal or another verified mail path; read refresh cookie server-side or adopt a BFF; revoke refresh tokens after password change. Until then return explicit `501`/unavailable status rather than completion language. | End-to-end tests demonstrate reset, email confirmation, rotation, replay rejection, logout revocation, and browser refresh. |
| **H-05** | **Readiness endpoint is a false positive.** `/ready` comments “Check database connection” and “Check redis connection” but returns ready without any dependency check. | Orchestrators can route traffic to an API that cannot read/write, dispatch jobs, or use required dependencies. | Perform bounded Prisma `SELECT 1` and Redis ping checks; report dependency-specific state; add timeouts and a degraded/503 response. Include MinIO/worker capability checks only where required for the service role. | Disconnect database/Redis in staging and verify `/ready` returns non-ready without hanging. |
| **H-06** | **No certified official provider connector executes delivery, refresh, callback reconciliation, or metric collection.** Existing capability, webhook, and internal-ingestion contracts correctly signal “connector required,” but are not a working integration. | ViralBoost cannot deliver the core “creator selects authorized platforms, publishes, and learns” promise yet. | Certify one platform end to end before adding breadth: official OAuth, account discovery, encrypted token store, refresh/reconnect, media upload, idempotent publish, platform post ID, status reconciliation, metrics polling/callbacks, revocation, audit, and creator recovery UI. | One selected creator can move from approved rendered artifact to an official platform post ID and fresh metric observation on staging, with retries and reconciliation tested. |
| **H-07** | **No application-level rate limiting or general request-size limit was found.** The API accepts public auth, webhook, upload, and internal connector traffic without a demonstrated rate-limit middleware. | Credential stuffing, abusive uploads, webhook flooding, and resource exhaustion are not adequately bounded. | Add edge/proxy limits plus API-level per-route rate limits backed by Redis. Enforce content-length/body-size limits for JSON/multipart requests; apply stricter limits to auth and webhooks. | Load/abuse tests return predictable 429/413 responses without harming normal creator traffic. |
| **H-08** | **Quality automation is incomplete.** API `npm run lint` fails because no ESLint configuration exists. Web `npm run lint` enters an interactive setup prompt. No GitHub Actions, Drone pipeline definition, or other discoverable CI workflow was found. | A build passing locally is not a reliable merge/release gate; static issues and regressions can reach `main`. | Add shared ESLint/Prettier configuration, non-interactive lint scripts, unit/integration tests, schema drift checks, dependency audit, secret scan, build, and container validation to CI. Enforce branch protection. | A clean clone can run one documented CI command non-interactively and required checks gate merges. |

## Medium findings

| ID | Finding and evidence | Impact | Required fix | Acceptance gate |
|---|---|---|---|---|
| **M-01** | Account create/update routes accept raw browser-supplied access and refresh tokens before official OAuth is available. Encryption is applied, but the source and scope of the token are not proven through a provider flow. | Increases risk of pasted invalid/over-scoped credentials and bypasses OAuth consent/account discovery guarantees. | Restrict manual token ingestion to an internal, audited break-glass workflow or remove it. Build provider OAuth handoff with PKCE/state validation and explicit scopes. | Creator connects only through certified OAuth; token data never appears in browser/API response/logs. |
| **M-02** | Account status filtering only toggles `isActive`, while the route advertises `active`, `expired`, and `error` states. Refresh and metrics sync return `501`. | Account readiness can be misrepresented and creator recovery is incomplete. | Add a normalized connection-status state with token expiry, last refresh/sync, failure code, reconnect URL, and capability readiness. | Destination panel reports real active/expired/error/connector-required states from persisted facts. |
| **M-03** | Video duplication aliases the same MinIO object key and metadata, while video deletion removes only the database record in the inspected route. | Duplicates may unintentionally share source assets; deletes can leave storage orphaned; ownership and retention behavior are unclear. | Define immutable source-asset records with reference counting or copy-on-write semantics. Implement asynchronous storage cleanup with retention windows and audit events. | Duplicate/delete tests prove no unauthorized cross-record asset mutation, no premature deletion, and eventual cleanup of unreferenced storage. |
| **M-04** | Analytics exports return synthetic success, synthetic completed status, and a non-file download response. `topCampaigns` is hardcoded empty. | Creator and developer reports can appear operational while they are not; export feature is not launch-ready. | Hide these controls or return explicit unavailable state. Later add a durable export-job table, queue, private artifact storage, signed download, expiry, status, cancellation, and audit. Implement top campaign aggregation using latest observations. | An export is either unavailable with no false success or produces a real authorized file with traceable status. |
| **M-05** | Current tests are mostly contract/static verification scripts and pure-function checks. No real PostgreSQL migration test, Redis/MinIO integration test, official provider sandbox test, or browser E2E suite was found. | High-value workflows can regress despite type/build success. | Add disposable service integration tests, Playwright browser E2E for invite/login/source/upload/plan/approve, failure injection for queues/storage, and provider sandbox tests. | Release candidate must pass application, database, queue, storage, browser, and provider test tiers. |
| **M-06** | Compose definitions use secret files for many values, but Redis uses `${REDIS_PASSWORD}` in command/URLs rather than a file-backed runtime pattern. Compose has not been rendered/run in this environment. | Secrets may be exposed through environment/process inspection depending on host configuration; deployment behavior is unverified. | Move Redis and all remaining credentials to file-backed or platform-managed secrets, avoid passwords in process arguments where possible, render Compose in CI, and run staged deployment checks. | Secret scan and rendered deployment configuration show no tracked credentials and no sensitive values in process arguments/logs. |
| **M-07** | Monitoring services are declared, but there is no verified alert policy, SLO, dashboard provisioning, trace correlation, incident runbook, backup/restore drill, or dependency-aware readiness. | Observability components alone do not provide operational reliability. | Define SLIs/SLOs for API, queue age, worker failure rate, source processing time, metric freshness, provider error rate, and storage availability. Add alert routing, dashboards, runbooks, backups, restores, and quarterly drills. | Staging fault injection creates alerts, follows a runbook, and verifies recovery and data restoration. |
| **M-08** | Large API routes use broad `any` values and combine unrelated responsibilities. `intelligence.ts` is 842 lines and `analytics.ts` is 769 lines; most route files are hundreds of lines. | Raises review cost and regression risk; makes authorization and data semantics harder to verify. | Split by bounded context, extract typed service/query layers, centralize workspace resolution and errors, and add route-focused tests. | Each route module has a narrow responsibility, typed inputs/outputs, and dedicated tests. |

## Low and backlog findings

| ID | Finding | Required fix |
|---|---|---|
| **L-01** | No supported public passwordless/social SSO strategy is defined for the pilot. | Decide whether invite code + password remains deliberate; if so finish recovery/verification and abuse controls. |
| **L-02** | Creator artifact review/editing remains less mature than purpose-built repurposing products. | Add secure preview, caption/thumbnails/edit controls, render/re-render state, versioning, and accessible review flow after runtime worker validation. |
| **L-03** | No confirmed mobile/accessibility/usability research evidence exists. | Add responsive audit, keyboard navigation, contrast tests, error/loading states, and structured creator usability sessions. |
| **L-04** | Trend workers contain explicit missing provider configuration and orchestration TODOs. | Treat trends as connector-gated; avoid showing unavailable trend data as live intelligence. |
| **L-05** | A number of legacy TODO comments no longer reflect current upload/dispatch behavior. | Remove stale comments and deprecated routes so operators are not misled during incidents. |
| **L-06** | The repository has no formal architecture decision record or release checklist that gates feature claims. | Add ADRs for active workspace context, OAuth boundary, metrics semantics, data retention, and a signed release checklist. |

# Priority remediation plan

## P0: Do before any private creator onboarding

| Sequence | Work item | Primary owner | Why it comes first |
|---:|---|---|---|
| 1 | Repair auth middleware order and refresh-cookie design; add route integration tests. | API | Login and invitation onboarding are currently blocked. |
| 2 | Upgrade patched Next.js and lockfiles; re-run audit/build/test. | Web/platform | A critical framework advisory must be removed before exposure. |
| 3 | Fix analytics filter composition and latest-snapshot semantics. | Data/API | ViralBoost cannot make trustworthy learning or investor claims with incorrect metrics. |
| 4 | Replace implicit workspace selection with explicit verified workspace context. | API/web | Tenant isolation is a non-negotiable creator-trust property. |
| 5 | Disable or fix legacy false-success upload/publish/export/recovery routes. | API/product | The product must never report work that did not occur. |
| 6 | Add dependency-aware readiness and non-interactive lint/CI gates. | Platform | Stops unhealthy services and unchecked regressions from reaching creators. |

## P1: Complete during the first certified connector milestone

| Sequence | Work item | Completion standard |
|---:|---|---|
| 1 | Deploy a disposable PostgreSQL target and apply every migration, including metric provenance. | Schema, indexes, and rollback behavior verified with real data. |
| 2 | Run the Compose stack on a persistent Docker-capable staging target. | Source upload, MinIO, Redis, FFmpeg worker, local intelligence, observability, and failure recovery work together. |
| 3 | Implement one official OAuth/publishing/metrics connector. | Creator-authorized end-to-end post, reconciliation, metrics, revocation, retries, and audit are proven. |
| 4 | Connect internal metric ingestion to the certified worker. | Fresh/provenanced observations appear exactly once and analytics uses latest state correctly. |
| 5 | Add artifact review/editing and creator recovery views. | Creator can inspect the exact rendered artifact and recover from connector/render failure without developer intervention. |
| 6 | Add rate limiting, payload controls, test tiers, audit logging, and operational dashboards. | Security and reliability controls are tested under normal and failure load. |

## P2: Earn the premium product claim with evidence

The final launch work is not just additional code. ViralBoost must demonstrate that a selected cohort can onboard, upload, review, approve, publish through an official connector, receive fresh measurements, and use evidence to make better next decisions. Track activation, time-to-first-ready-source, time-to-first-approved experiment, delivery success, metric freshness, processing failure rate, creator retention, and baseline-relative outcome changes. Do not claim virality, follower guarantees, feed placement, or millions of impressions; platforms retain control over recommendation and audience allocation. [3] [4] [5]

## Launch quality gates

| Gate | Evidence required before launch |
|---|---|
| Authentication and tenancy | Public invite/login/refresh flows work; workspace is explicit; cross-workspace tests pass. |
| Security | No critical/high production dependency finding; secrets are managed; rate/body limits, OAuth state/PKCE, webhook signatures, and security review pass. OWASP ASVS is an appropriate verification baseline. [2] |
| Data correctness | Latest-snapshot analytics and all filter combinations are tested; metric provenance/freshness is visible; no synthetic success states remain. |
| Runtime | Staging Compose deployment, migrations, backup/restore, dependency-aware readiness, queue dead-letter recovery, and alerts are exercised. |
| Provider execution | One official connector is certified end to end with a selected creator account. |
| Creator experience | Creator can see artifact, approval, delivery, failure/recovery, and measured outcomes without developer intervention. |
| Evidence | A small invited cohort supplies activation, retention, reliability, and outcome data. |

## Positive findings worth retaining

The audit did not find production dependency vulnerabilities in the API package. It confirmed that secret files and `.env` files are ignored by Git, provider webhooks are not permissively accepted, browser automation is explicitly blocked for production delivery, metric-ingestion provenance is idempotent by design, creator approval is distinct from scheduling/publishing, and the repository is consistently built and contract-tested before milestone commits. These practices should be retained while the P0 defects are corrected.

## Scope limitations

This is a code and configuration audit, not a penetration test, legal/privacy opinion, provider certification, accessibility conformance assessment, or live-load benchmark. The findings describe defects and gaps that were verified through code inspection, targeted probes, command output, or documented absence. Additional issues can surface when migrations, the full Compose stack, real OAuth clients, actual creator media, provider webhooks, and a persistent staging environment are exercised.

## References

[1]: https://github.com/advisories/GHSA-f82v-jwr5-mffw "GitHub Advisory: Authorization Bypass in Next.js Middleware"
[2]: https://owasp.org/www-project-application-security-verification-standard/ "OWASP Application Security Verification Standard"
[3]: https://developers.tiktok.com/products/content-posting-api/ "TikTok for Developers: Content Posting API"
[4]: https://developers.facebook.com/documentation/instagram-platform/content-publishing "Meta for Developers: Instagram Content Publishing"
[5]: https://developers.google.com/youtube/v3/docs/videos/insert "YouTube Data API: videos.insert"
