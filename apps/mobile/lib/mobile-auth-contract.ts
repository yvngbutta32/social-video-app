export type MobileAuthData = {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
  refreshToken: string;
};

export type WorkspaceMembership = { workspace?: { id?: string; name?: string | null; slug?: string | null } };
export type AuthorizedWorkspace = { id: string; name: string; slug: string | null };

export function listAuthorizedWorkspaces(memberships: WorkspaceMembership[]): AuthorizedWorkspace[] {
  const seen = new Set<string>();
  return memberships.flatMap((membership) => {
    const id = membership.workspace?.id;
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name: membership.workspace?.name?.trim() || "Creator workspace", slug: membership.workspace?.slug ?? null }];
  });
}

export function parseNativeAuthData(payload: unknown): MobileAuthData {
  const data = (payload as { data?: unknown })?.data as Partial<MobileAuthData> | undefined;
  if (!data?.accessToken || !data.refreshToken || !data.user?.id || !data.user.email) {
    throw new Error("The secure mobile session response was incomplete. Please try again or contact the pilot administrator.");
  }
  return data as MobileAuthData;
}

export function selectWorkspaceId(memberships: WorkspaceMembership[]) {
  const workspaces = listAuthorizedWorkspaces(memberships);
  if (!workspaces.length) {
    throw new Error("No active creator workspace is available for this invited account.");
  }
  if (workspaces.length !== 1) throw new Error("Choose the creator workspace you want to use before continuing.");
  return workspaces[0].id;
}

export function assertAuthorizedWorkspace(workspaces: AuthorizedWorkspace[], workspaceId: string) {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new Error("This workspace is no longer authorized for the current invited account.");
  return workspace;
}
