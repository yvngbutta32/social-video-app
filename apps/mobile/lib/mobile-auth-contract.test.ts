import { describe, expect, it } from "vitest";

import { assertAuthorizedWorkspace, listAuthorizedWorkspaces, parseNativeAuthData, selectWorkspaceId } from "./mobile-auth-contract";

describe("native ViralBoost authentication contract", () => {
  it("accepts a complete native-only token response", () => {
    expect(parseNativeAuthData({ data: { user: { id: "creator-1", email: "creator@example.com", name: "Creator" }, accessToken: "access", refreshToken: "refresh" } })).toMatchObject({ accessToken: "access", refreshToken: "refresh" });
  });

  it("rejects a browser-shaped response that does not expose a native refresh token", () => {
    expect(() => parseNativeAuthData({ data: { user: { id: "creator-1", email: "creator@example.com" }, accessToken: "access" } })).toThrow(/incomplete/i);
  });

  it("selects an available invited workspace and rejects missing membership", () => {
    expect(selectWorkspaceId([{ workspace: { id: "workspace-1" } }])).toBe("workspace-1");
    expect(() => selectWorkspaceId([])).toThrow(/workspace/i);
  });

  it("requires an explicit choice for multiple authorized workspaces", () => {
    const workspaces = listAuthorizedWorkspaces([{ workspace: { id: "one", name: "One" } }, { workspace: { id: "two", name: "Two" } }, { workspace: { id: "one", name: "One" } }]);
    expect(workspaces).toEqual([{ id: "one", name: "One", slug: null }, { id: "two", name: "Two", slug: null }]);
    expect(() => selectWorkspaceId([{ workspace: { id: "one" } }, { workspace: { id: "two" } }])).toThrow(/choose/i);
    expect(assertAuthorizedWorkspace(workspaces, "two").name).toBe("Two");
    expect(() => assertAuthorizedWorkspace(workspaces, "missing")).toThrow(/authorized/i);
  });
});
