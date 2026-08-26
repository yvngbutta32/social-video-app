import { describe, expect, it } from "vitest";
import { parseWorkspaceActivity, workspaceActivityLabel } from "./workspace-activity-contract";

describe("workspace activity contract", () => {
  it("accepts only redacted creator-relevant events", () => {
    expect(parseWorkspaceActivity({ data: { events: [{ action: "workspace_selected", resourceType: "workspace", createdAt: "2026-08-26T00:00:00.000Z" }] } })).toHaveLength(1);
    expect(workspaceActivityLabel("creator_publish_intent_approved")).toMatch(/approval/i);
  });

  it("rejects missing or unsupported event shapes", () => {
    expect(() => parseWorkspaceActivity({ data: { events: [{ action: "admin_secret", createdAt: "now" }] } })).toThrow(/unsupported/i);
    expect(() => parseWorkspaceActivity({ data: {} })).toThrow(/not available/i);
  });
});
