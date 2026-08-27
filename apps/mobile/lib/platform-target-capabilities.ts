import type { CreatorTargetPlatform } from "./creator-workflow";

const targetPlatforms = new Set<CreatorTargetPlatform>(["tiktok", "instagram", "youtube", "linkedin"]);
const officialPublishingValues = new Set(["direct_post", "media_publish", "video_insert", "not_configured"]);
const readinessValues = new Set(["official_connector_ready", "connector_required"]);
const connectionStateValues = new Set(["connected", "token_expired", "revoked"]);

export type PlatformCapability = {
  platform: CreatorTargetPlatform;
  label: string;
  officialPublishing: "direct_post" | "media_publish" | "video_insert" | "not_configured";
  creatorAccountRequirement: string;
  readiness: "official_connector_ready" | "connector_required";
  safeguards: string[];
  actionRequirements: Array<{ label: string; sourceUrl: string | null }>;
};

export type WorkspacePlatformAccount = {
  platform: CreatorTargetPlatform;
  username: string | null;
  displayName: string | null;
  connectionState: "connected" | "token_expired" | "revoked";
};

export type PlatformTargetConnectionState = {
  platform: CreatorTargetPlatform;
  state: "action_ready" | "connected" | "connection_required" | "official_connector_unavailable" | "status_unavailable";
  label: string;
  detail: string;
  accountName: string | null;
  actionRequirements: Array<{ label: string; sourceUrl: string | null }>;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asTargetPlatform(value: unknown): CreatorTargetPlatform | null {
  return typeof value === "string" && targetPlatforms.has(value as CreatorTargetPlatform) ? value as CreatorTargetPlatform : null;
}

const actionReadinessStateValues = new Set(["action_ready", "official_connector_required", "creator_connection_required", "creator_reconnection_required"]);

export function parsePlatformActionReadiness(payload: unknown): PlatformTargetConnectionState[] {
  const root = asObject(payload);
  if (!Array.isArray(root?.data)) throw new Error("Platform action readiness is unavailable from this secure workspace.");

  return root.data.flatMap((value) => {
    const item = asObject(value);
    const platform = asTargetPlatform(item?.platform);
    if (!item || !platform || typeof item.label !== "string" || typeof item.actionAllowed !== "boolean" || !actionReadinessStateValues.has(item.state as string) || !Array.isArray(item.blockers) || !item.blockers.every((blocker) => typeof blocker === "string") || !Array.isArray(item.actionRequirements)) return [];
    const actionRequirements = item.actionRequirements.flatMap((requirement) => {
      const parsed = asObject(requirement);
      return typeof parsed?.label === "string" && (typeof parsed.sourceUrl === "string" || parsed.sourceUrl === null) ? [{ label: parsed.label, sourceUrl: typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : null }] : [];
    });
    const state: PlatformTargetConnectionState["state"] = item.actionAllowed
      ? "action_ready"
      : item.state === "official_connector_required"
        ? "official_connector_unavailable"
        : "connection_required";
    return [{
      platform,
      state,
      label: item.actionAllowed ? "Ready for creator review" : item.state === "official_connector_required" ? "Official connector unavailable" : item.state === "creator_reconnection_required" ? "Reconnect creator account" : "Creator connection required",
      detail: item.actionAllowed ? "The platform gate is clear. Creator review and explicit approval are still required for any action." : item.blockers[0] ?? "This target is not ready for a creator action.",
      accountName: typeof item.accountName === "string" ? item.accountName : null,
      actionRequirements,
    }];
  });
}

export function parsePlatformCapabilities(payload: unknown): PlatformCapability[] {
  const root = asObject(payload);
  if (!Array.isArray(root?.data)) throw new Error("Platform capabilities are unavailable from this secure workspace.");

  return root.data.flatMap((value) => {
    const item = asObject(value);
    const platform = asTargetPlatform(item?.platform);
    if (!platform || typeof item?.label !== "string" || typeof item.creatorAccountRequirement !== "string" || !officialPublishingValues.has(item.officialPublishing as string) || !readinessValues.has(item.readiness as string) || !Array.isArray(item.safeguards) || !item.safeguards.every((guardrail) => typeof guardrail === "string")) return [];
    const actionRequirements = Array.isArray(item.actionRequirements) ? item.actionRequirements.flatMap((requirement) => {
      const parsed = asObject(requirement);
      return typeof parsed?.label === "string" && (typeof parsed.sourceUrl === "string" || parsed.sourceUrl === null) ? [{ label: parsed.label, sourceUrl: typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : null }] : [];
    }) : [];
    return [{
      platform,
      label: item.label,
      officialPublishing: item.officialPublishing as PlatformCapability["officialPublishing"],
      creatorAccountRequirement: item.creatorAccountRequirement,
      readiness: item.readiness as PlatformCapability["readiness"],
      safeguards: item.safeguards,
      actionRequirements,
    }];
  });
}

export function parseWorkspacePlatformAccounts(payload: unknown): WorkspacePlatformAccount[] {
  const root = asObject(payload);
  if (!Array.isArray(root?.data)) throw new Error("Platform account status is unavailable from this secure workspace.");

  return root.data.flatMap((value) => {
    const item = asObject(value);
    const platform = asTargetPlatform(item?.platform);
    if (!item || !platform || !connectionStateValues.has(item.connectionState as string)) return [];
    return [{
      platform,
      username: typeof item.username === "string" ? item.username : null,
      displayName: typeof item.displayName === "string" ? item.displayName : null,
      connectionState: item.connectionState as WorkspacePlatformAccount["connectionState"],
    }];
  });
}

export function projectPlatformTargetConnectionStates(
  platforms: readonly CreatorTargetPlatform[],
  accounts: WorkspacePlatformAccount[],
  capabilities: PlatformCapability[]
): PlatformTargetConnectionState[] {
  return platforms.map((platform) => {
    const capability = capabilities.find((item) => item.platform === platform);
    const account = accounts.find((item) => item.platform === platform && item.connectionState === "connected") ?? accounts.find((item) => item.platform === platform) ?? null;
    const accountName = account?.displayName ?? account?.username ?? null;

    if (!capability) {
      return { platform, state: "status_unavailable", label: "Connection status unavailable", detail: "The private API did not return a verified capability for this target.", accountName, actionRequirements: [] };
    }

    if (account?.connectionState === "connected") {
      const connectorDetail = capability.readiness === "official_connector_ready"
        ? "Official creator-authorized connector is available. Creator approval remains required."
        : "A creator account is connected, but the official connector still requires deployment and verification.";
      return { platform, state: "connected", label: "Creator account connected", detail: connectorDetail, accountName, actionRequirements: capability.actionRequirements };
    }

    if (capability.officialPublishing === "not_configured") {
      return { platform, state: "official_connector_unavailable", label: "Official connector unavailable", detail: capability.safeguards[0] ?? "No official publishing connector is configured for this target.", accountName, actionRequirements: capability.actionRequirements };
    }

    if (account?.connectionState === "token_expired") {
      return { platform, state: "connection_required", label: "Reconnect creator account", detail: "The prior creator authorization has expired. Reconnect through the official flow before any authorized action.", accountName, actionRequirements: capability.actionRequirements };
    }

    if (account?.connectionState === "revoked") {
      return { platform, state: "connection_required", label: "Reconnect creator account", detail: "The prior creator authorization is no longer active. Reconnect through the official flow before any authorized action.", accountName, actionRequirements: capability.actionRequirements };
    }

    return { platform, state: "connection_required", label: "Creator connection required", detail: capability.creatorAccountRequirement, accountName: null, actionRequirements: capability.actionRequirements };
  });
}
