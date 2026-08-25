# Closed-Pilot Access and Data Audit

## Existing Foundations

The repository already has strong primitives for a multi-tenant pilot. `Workspace` owns social accounts, source videos, generated video variants, scheduled posts, campaigns, and metrics. `WorkspaceMember` connects users to workspaces and records a workspace-specific role. `Video.uploadedBy` and `VideoVariant.videoId` provide the starting provenance chain from source content to derived assets. The existing audit models can record both workspace actions and owner-level administrative actions.

| Existing primitive | Current capability | Closed-pilot use |
|---|---|---|
| `Workspace` | Isolates content and performance data by `workspaceId`. | One private workspace per selected client. |
| `WorkspaceMember` | Assigns users to workspaces with a role. | Client owner and collaborator access inside a selected client workspace. |
| `User.role` | Stores a global user role. | Reserve `owner` for the platform owner’s global oversight rights. |
| `InviteCode` | Stores email, expiry, status, creator, and invited role. | Extend it to bind an invite to the client workspace it provisions. |
| `Video` + `VideoVariant` | Associates source content with derivative assets. | Preserve provenance from client source videos to all generated outputs. |
| `AuditLog` + `AdminAuditLog` | Captures workspace and administrative events. | Record owner oversight, access changes, pauses, and workflow decisions. |

## Gaps That Must Be Addressed

| Gap | Current behavior | Required pilot change |
|---|---|---|
| **Public registration** | `/auth/register` creates a user and workspace for anyone. | Require a valid, unused, email-bound invitation before creator account creation. |
| **Invitation scope** | `InviteCode` is not linked to a workspace. | Bind every invite to the creator workspace it provisions. |
| **Token role source** | Login uses the first workspace membership role. | Use `User.role` for platform-wide developer privileges and determine creator rights from the target workspace membership. |
| **Workspace selection** | Content and analytics routes call `findFirst` for a user workspace. | Resolve an explicit workspace context and verify the requester’s membership for every creator-facing request. |
| **Developer oversight** | No route supports read-only developer-wide portfolio access. | Add a dedicated developer route guarded by global `User.role === owner` and limit it to observation plus access governance. |
| **Creator workflow control** | Workflow state is not explicitly tied to a creator control surface. | Ensure only creator-side routes can pause or resume their own publishing workflow. |
| **Access audit trail** | Audit structures exist but are not used for pilot controls. | Write an administrative audit event when issuing/revoking invites or accessing an oversight record. |

## Authorization Decisions

The platform developer is a global identity, represented by `User.role = owner`. Creator owners and collaborators are never granted global owner status; their authority comes from `WorkspaceMember.role` inside their own workspace. Creator-facing resource queries must always be scoped to a workspace selected by the creator context and verified against a membership record. Developer portfolio routes must be separate, deliberate, read-only, and audit logged. The developer’s only write actions are invitation issuance and access revocation.

## First Implementation Slice

The first implementation slice will establish the foundations required before any public-style client workflow is expanded:

1. Add `workspaceId` to `InviteCode` and provide an incremental migration.
2. Close registration behind a valid invitation and create the invited creator member in the invitation’s workspace.
3. Add developer-only APIs for issuing/revoking pilot invitations, listing creator workspaces, and opening a read-only creator workspace overview.
4. Add a creator-scoped workspace resolution helper to replace `findFirst` authorization patterns as routes are migrated.
5. Add creator-side workflow controls for pausing or resuming publication without exposing those controls to the developer.

The new owner command-center user interface and the client source-video workflow will consume these foundations in the next implementation slices.
