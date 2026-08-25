import { HTTPException } from 'hono/http-exception';
import { prisma } from './prisma.js';

export type PilotActor = {
  id: string;
  email: string;
  role: string;
};

export type PilotWorkspaceSettings = {
  pilotStatus?: 'pending' | 'active' | 'paused' | 'deactivated';
  publishingPaused?: boolean;
  publishingPausedAt?: string;
  publishingPausedBy?: string;
};

function asSettings(value: unknown): PilotWorkspaceSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as PilotWorkspaceSettings;
}

export async function requirePlatformOwner(actor: PilotActor) {
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, role: true, isActive: true },
  });

  if (!user || !user.isActive || user.role !== 'owner') {
    throw new HTTPException(403, { message: 'Platform owner access is required' });
  }

  return user;
}

export async function requireWorkspaceAccess(actor: PilotActor, workspaceId: string) {
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new HTTPException(403, { message: 'Active account access is required' });
  }

  if (user.role === 'owner') {
    return { workspaceId, role: 'owner', oversight: true };
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: actor.id } },
    select: { workspaceId: true, role: true },
  });

  if (!membership) {
    throw new HTTPException(403, { message: 'No access to this client workspace' });
  }

  return { workspaceId: membership.workspaceId, role: membership.role, oversight: false };
}

export async function assertPublishingAllowed(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  });

  if (!workspace) {
    throw new HTTPException(404, { message: 'Workspace not found' });
  }

  const settings = asSettings(workspace.settings);
  if (settings.publishingPaused || settings.pilotStatus === 'paused' || settings.pilotStatus === 'deactivated') {
    throw new HTTPException(409, { message: 'Publishing is paused for this client workspace' });
  }

  return workspace;
}

export function mergePilotSettings(
  current: unknown,
  next: Partial<PilotWorkspaceSettings>
): PilotWorkspaceSettings {
  return { ...asSettings(current), ...next };
}
