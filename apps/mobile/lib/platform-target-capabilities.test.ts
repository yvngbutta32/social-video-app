import { describe, expect, it } from "vitest";

import { parsePlatformActionReadiness, parsePlatformCapabilities, parseWorkspacePlatformAccounts, projectPlatformTargetConnectionStates } from "./platform-target-capabilities";

describe("platform target capability projection", () => {
  const capabilities = parsePlatformCapabilities({
    data: [
      { platform: "tiktok", label: "TikTok", officialPublishing: "direct_post", creatorAccountRequirement: "Official TikTok creator account", readiness: "connector_required", safeguards: ["Creator approval remains required."], actionRequirements: [{ label: "Complete creator authorization.", sourceUrl: "https://developers.tiktok.com/docs/en/content-posting-api-get-started" }] },
      { platform: "instagram", label: "Instagram", officialPublishing: "media_publish", creatorAccountRequirement: "Official Instagram professional account", readiness: "connector_required", safeguards: ["Creator approval remains required."], actionRequirements: [{ label: "Validate account eligibility.", sourceUrl: "https://developers.facebook.com/documentation/instagram-platform/content-publishing" }] },
      { platform: "linkedin", label: "LinkedIn", officialPublishing: "not_configured", creatorAccountRequirement: "Official LinkedIn account", readiness: "connector_required", safeguards: ["No publishing is enabled until an official connector is implemented and tested."], actionRequirements: [{ label: "Request w_member_social.", sourceUrl: "https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin" }] },
    ],
  });

  it("projects connected, connection-required, and unavailable states from verified response fields", () => {
    const accounts = parseWorkspacePlatformAccounts({ data: [{ platform: "tiktok", username: "creator", displayName: "Creator One", isActive: true, connectionState: "connected" }] });
    expect(projectPlatformTargetConnectionStates(["tiktok", "instagram", "linkedin"], accounts, capabilities)).toEqual([
      expect.objectContaining({ platform: "tiktok", state: "connected", accountName: "Creator One", actionRequirements: [expect.objectContaining({ label: "Complete creator authorization." })] }),
      expect.objectContaining({ platform: "instagram", state: "connection_required" }),
      expect.objectContaining({ platform: "linkedin", state: "official_connector_unavailable" }),
    ]);
  });

  it("keeps expired authorizations distinct from a verified active account", () => {
    const accounts = parseWorkspacePlatformAccounts({ data: [{ platform: "tiktok", username: "creator", displayName: null, isActive: true, connectionState: "token_expired" }] });
    expect(projectPlatformTargetConnectionStates(["tiktok"], accounts, capabilities)[0]).toMatchObject({ state: "connection_required", label: "Reconnect creator account" });
  });

  it("rejects malformed response envelopes rather than inventing a capability state", () => {
    expect(() => parsePlatformCapabilities({ data: {} })).toThrow(/unavailable/i);
    expect(() => parseWorkspacePlatformAccounts({})).toThrow(/unavailable/i);
  });

  it("maps the server-derived action gate without presenting blocked targets as ready", () => {
    const states = parsePlatformActionReadiness({ data: [
      { platform: "tiktok", label: "TikTok", actionAllowed: false, state: "official_connector_required", accountName: "Creator One", blockers: ["The certified official connector is not deployed and verified for this target."], actionRequirements: [{ label: "Complete creator authorization.", sourceUrl: "https://developers.tiktok.com/docs/en/content-posting-api-get-started" }] },
      { platform: "youtube", label: "YouTube", actionAllowed: true, state: "action_ready", accountName: "Creator One", blockers: [], actionRequirements: [] },
    ] });
    expect(states).toEqual([
      expect.objectContaining({ platform: "tiktok", state: "official_connector_unavailable", label: "Official connector unavailable" }),
      expect.objectContaining({ platform: "youtube", state: "action_ready", label: "Ready for creator review" }),
    ]);
  });
});
