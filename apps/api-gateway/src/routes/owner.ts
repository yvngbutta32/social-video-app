import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '../lib/prisma.js';
import type { Variables } from '../index.js';
import { requirePlatformOwner } from '../lib/pilot-access.js';

const inviteSchema = z.object({
  email: z.string().email(),
  clientName: z.string().trim().min(2).max(120),
  workspaceSlug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

const clientQuerySchema = z.object({
  status: z.enum(['pending', 'active', 'paused', 'deactivated']).optional(),
});

function createWorkspaceSlug(clientName: string) {
  const base = clientName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52) || 'pilot-client';

  return `${base}-${Date.now().toString(36)}`;
}

function getPilotStatus(settings: unknown) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return 'pending';
  }

  const status = (settings as { pilotStatus?: string }).pilotStatus;
  return ['pending', 'active', 'paused', 'deactivated'].includes(status || '') ? status : 'pending';
}

async function writeOwnerAudit(
  adminId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>
) {
  await prisma.adminAuditLog.create({
    data: { adminId, action, resourceType, resourceId, metadata: metadata as any },
  });
}

export function createOwnerRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/clients', zValidator('query', clientQuerySchema), async (c: any) => {
    const owner = await requirePlatformOwner(c.get('user'));
    const { status } = c.req.valid('query');

    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: owner.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        members: {
          where: { role: 'owner' },
          select: {
            joinedAt: true,
            user: { select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true } },
          },
        },
        socialAccounts: {
          select: { platform: true, isActive: true, lastSyncAt: true },
        },
        videos: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, title: true, status: true, createdAt: true },
        },
        _count: {
          select: { members: true, videos: true, socialAccounts: true, abTests: true },
        },
      },
    });

    const clients = workspaces
      .map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        status: getPilotStatus(workspace.settings),
        publishingPaused: Boolean((workspace.settings as any)?.publishingPaused),
        client: workspace.members[0]?.user || null,
        clientJoinedAt: workspace.members[0]?.joinedAt || null,
        connectedPlatforms: workspace.socialAccounts.filter((account) => account.isActive).map((account) => account.platform),
        latestVideo: workspace.videos[0] || null,
        counts: workspace._count,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      }))
      .filter((workspace) => !status || workspace.status === status);

    return c.json({ data: clients });
  });

  app.post('/invites', zValidator('json', inviteSchema), async (c: any) => {
    const owner = await requirePlatformOwner(c.get('user'));
    const body = c.req.valid('json');
    const email = body.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      throw new HTTPException(409, { message: 'This email already has an account' });
    }

    const baseSlug = body.workspaceSlug || createWorkspaceSlug(body.clientName);
    const slug = baseSlug.toLowerCase();
    const existingWorkspace = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (existingWorkspace) {
      throw new HTTPException(409, { message: 'Choose a different workspace slug' });
    }

    const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000);
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: body.clientName,
          slug,
          ownerId: owner.id,
          plan: 'agency',
          settings: {
            pilotStatus: 'pending',
            publishingPaused: true,
            createdFrom: 'owner-invite',
          },
        },
      });

      const invite = await tx.inviteCode.create({
        data: {
          email,
          role: 'creator',
          workspaceId: workspace.id,
          createdById: owner.id,
          expiresAt,
          maxUses: 1,
        } as any,
      });

      return { workspace, invite };
    });

    await writeOwnerAudit(owner.id, 'pilot_invite_created', 'workspace', result.workspace.id, {
      email,
      inviteId: result.invite.id,
      expiresAt: result.invite.expiresAt.toISOString(),
    });

    return c.json({
      data: {
        workspace: { id: result.workspace.id, name: result.workspace.name, slug: result.workspace.slug },
        invite: {
          id: result.invite.id,
          code: result.invite.code,
          email: result.invite.email,
          expiresAt: result.invite.expiresAt,
          status: result.invite.status,
        },
      },
      message: 'Pilot invitation created. Deliver the code only to the selected client.',
    }, 201);
  });

  app.post('/invites/:id/revoke', async (c: any) => {
    const owner = await requirePlatformOwner(c.get('user'));
    const invite = await prisma.inviteCode.findFirst({
      where: { id: c.req.param('id'), createdById: owner.id },
      select: { id: true, workspaceId: true, status: true },
    });

    if (!invite) {
      throw new HTTPException(404, { message: 'Pilot invitation not found' });
    }

    if (invite.status === 'USED') {
      throw new HTTPException(409, { message: 'Used invitations cannot be revoked' });
    }

    await prisma.inviteCode.update({ where: { id: invite.id }, data: { status: 'REVOKED' } });
    await writeOwnerAudit(owner.id, 'pilot_invite_revoked', 'invite', invite.id, { workspaceId: invite.workspaceId });

    return c.json({ success: true });
  });

  app.get('/clients/:id', async (c: any) => {
    const owner = await requirePlatformOwner(c.get('user'));
    const workspaceId = c.req.param('id');
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId: owner.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        socialAccounts: {
          select: { id: true, platform: true, username: true, displayName: true, isActive: true, lastSyncAt: true, connectedAt: true },
        },
        videos: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { variants: { select: { id: true, platform: true, status: true, createdAt: true } } },
        },
        abTests: {
          orderBy: { startedAt: 'desc' },
          take: 20,
          select: { id: true, name: true, status: true, startedAt: true, completedAt: true, results: true },
        },
      },
    });

    if (!workspace) {
      throw new HTTPException(404, { message: 'Client workspace not found' });
    }

    await writeOwnerAudit(owner.id, 'pilot_client_oversight_viewed', 'workspace', workspace.id, {});
    return c.json({ data: { ...workspace, pilotStatus: getPilotStatus(workspace.settings) } });
  });


  return app;
}
