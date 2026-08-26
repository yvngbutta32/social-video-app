export type MobileAuthData = {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
  refreshToken: string;
};

export type WorkspaceMembership = { workspace?: { id?: string } };

export function parseNativeAuthData(payload: unknown): MobileAuthData {
  const data = (payload as { data?: unknown })?.data as Partial<MobileAuthData> | undefined;
  if (!data?.accessToken || !data.refreshToken || !data.user?.id || !data.user.email) {
    throw new Error("The secure mobile session response was incomplete. Please try again or contact the pilot administrator.");
  }
  return data as MobileAuthData;
}

export function selectWorkspaceId(memberships: WorkspaceMembership[]) {
  const workspaceId = memberships.find((membership) => membership.workspace?.id)?.workspace?.id;
  if (!workspaceId) {
    throw new Error("No active creator workspace is available for this invited account.");
  }
  return workspaceId;
}
