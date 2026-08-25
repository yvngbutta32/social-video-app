# ViralBoost Closed-Pilot Operating Model

## Product Intent

ViralBoost is a **closed, invite-only viral-growth operations platform** for a small set of selected clients. Each client works independently inside a private workspace, starting from a small library of original source videos. The platform turns those source assets into a structured campaign pipeline: source analysis, platform-specific variants, hooks and captions, reviewable publishing plans, and performance learning.

The platform is designed to improve the probability of strong content performance through disciplined experimentation, creative iteration, distribution timing, and measurement. It must never represent a post as guaranteed to become viral.

## Roles and Visibility

| Role | Workspace access | Cross-client access | Core authority |
|---|---|---|---|
| **Platform developer** | Read-only oversight access to every pilot workspace | Full portfolio visibility | Issues and revokes invitations, provisions access, monitors all source assets, generated outputs, system activity, and performance. The developer does not create, approve, edit, schedule, or manage creator content. |
| **Creator owner** | Full access to their own workspace | None | Uploads source videos, connects accounts, accepts or rejects content recommendations, manages campaigns, and approves their own publishing decisions. |
| **Creator collaborator** | Scoped access to one assigned workspace | None | Creates and reviews content according to the permissions granted by the creator owner. |

> **Visibility rule:** Creator-generated source videos, transcripts, hooks, platform variants, campaigns, scheduled posts, and performance data are always tied to a workspace. Creators can only access their own workspace. The platform developer can inspect every pilot workspace through a clearly labeled, read-only oversight experience.

## Closed-Pilot Access Lifecycle

| Stage | Developer or creator action | System behavior |
|---|---|---|
| **Invite** | Developer creates an email-bound, expiry-bound invitation for a selected creator. | No public registration path is available. |
| **Activation** | Creator accepts the invitation and completes account setup. | A private creator workspace is provisioned and the invite is consumed. |
| **Operating** | Creator uses their workspace independently; developer observes portfolio health. | Content remains creator-isolated while developer oversight is audit logged. |
| **Access suspension** | Developer revokes a selected creator’s access when necessary. | New sessions are denied while creator assets and history remain retained for audit and restoration. |
| **Creator control** | Creator pauses or resumes their own publishing workflow. | The creator retains control over their own content operation without requiring developer intervention. |

## Growth System Boundaries

ViralBoost must optimize for meaningful organic growth outcomes, not make promises it cannot control. Organic feed placement and the level of public recognition a creator achieves are determined by each platform and audience response. The product does not depend on paid amplification; instead, it uses measurable inputs—creative quality signals, content fit, platform-native formats, posting windows, retention, engagement velocity, and conversion outcomes—to improve a client’s probability of strong performance over repeated experiments.

| Organic growth capability | What ViralBoost does | Required control |
|---|---|---|
| **Content multiplication** | Converts a small source library into structured platform-specific hooks, edits, captions, formats, and campaign variations. | Every derived asset retains source-video provenance and is reviewable. |
| **Distribution optimization** | Recommends timing and publishes approved variants only to connected client-owned accounts. | The client approves each campaign and may pause automation at any time. |
| **Performance learning** | Compares content angles, hooks, platforms, timing, and audience outcomes to improve the next campaign slate. | Recommendations must show confidence and rationale rather than guarantee virality or fame. |

## Few-Videos-to-Campaign Workflow

1. A selected client uploads a small initial source set, typically **one to five original videos**.
2. The system records provenance and analyzes each asset for topic, structure, hooks, pacing, transcript, visual format, and platform suitability.
3. The intelligence layer proposes a campaign slate, including content angles, hooks, captions, platform-specific variants, posting windows, and a rationale for each recommendation.
4. The client approves, edits, or rejects the proposed organic content before publishing. The platform never assumes approval.
5. Approved variants are scheduled to connected client-owned accounts at recommended windows, then measured across platform-specific and unified performance metrics.
6. Performance outcomes update the client’s content profile so subsequent recommendations improve using their own historical data.

## Owner Command Center Requirements

The developer control plane must show every selected creator as a separate, clearly scoped workspace. It must surface activation state, recent activity, source/video counts, generated-variant counts, campaign state, connected-account health, publishing state, and high-level performance. The developer can open a creator workspace in an explicitly read-only oversight mode, issue or revoke access, and review audit history. It must not expose creator workflow controls such as editing, approving, scheduling, or publishing content.

## Non-Negotiable Guardrails

The first pilot release must enforce the following constraints:

| Guardrail | Required behavior |
|---|---|
| **No open registration** | Accounts enter only through a developer-issued invite. |
| **Tenant isolation** | Creator-facing APIs query only the active creator workspace. |
| **Explicit developer oversight** | Cross-workspace access is limited to the platform developer, is read-only, and is recorded. |
| **Content provenance** | Every generated asset traces back to a source video, workspace, and initiating user/job. |
| **Human approval** | AI recommendations and generated variations require creator approval before publishing. |
| **Creator control** | Only the creator can pause or resume their own publishing and automation workflow. |
| **Measured claims** | The interface positions recommendations as optimization guidance, not promises of virality or fame. |

## Pilot Readiness Criteria

The pilot is ready to onboard the first selected client only after invitation-only registration is enforced, client workspaces are isolated, owner oversight exists, a source-video-to-proposed-campaign workflow is usable, and owner/client actions are recorded in audit trails.
