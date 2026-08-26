import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { sign, verify } from 'hono/jwt';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { NATIVE_CLIENT_HEADER, withNativeRefreshToken } from '../lib/native-client-auth.js';
import type { Variables } from '../index.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  inviteCode: z.string().min(8).max(128),
  company: z.string().max(200).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().default(false),
});

const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});

const refreshTokenLifetimeSeconds = 60 * 60 * 24 * 30;

function createRefreshToken(userId: string, secret: string) {
  return sign(
    { sub: userId, type: 'refresh', exp: Math.floor(Date.now() / 1000) + refreshTokenLifetimeSeconds },
    secret,
    'HS256'
  );
}

export function createAuthRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.post('/register', zValidator('json', registerSchema), async (c: any) => {
    const body = c.req.valid('json');
    
    const normalizedEmail = body.email.trim().toLowerCase();
    const invite = await prisma.inviteCode.findUnique({
      where: { code: body.inviteCode },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        maxUses: true,
        usedCount: true,
        workspaceId: true,
      },
    });

    if (
      !invite ||
      invite.status !== 'PENDING' ||
      invite.email.trim().toLowerCase() !== normalizedEmail ||
      invite.expiresAt <= new Date() ||
      invite.usedCount >= invite.maxUses ||
      !invite.workspaceId
    ) {
      throw new HTTPException(403, { message: 'A valid pilot invitation is required' });
    }

    const [existingUser, workspace] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
      prisma.workspace.findUnique({ where: { id: invite.workspaceId }, select: { id: true, settings: true } }),
    ]);

    if (existingUser) {
      throw new HTTPException(409, { message: 'Email already registered' });
    }

    if (!workspace) {
      throw new HTTPException(409, { message: 'This pilot invitation no longer has an active workspace' });
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const workspaceRole = invite.role === 'creator' ? 'owner' : invite.role;
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: hashedPassword,
          name: body.name,
          role: invite.role,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: createdUser.id,
          role: workspaceRole,
          joinedAt: new Date(),
        },
      });

      await tx.workspace.update({
        where: { id: workspace.id },
        data: {
          settings: {
            ...((workspace.settings as Record<string, unknown>) || {}),
            pilotStatus: 'active',
            publishingPaused: false,
            activatedAt: new Date().toISOString(),
          },
        },
      });

      await tx.inviteCode.update({
        where: { id: invite.id },
        data: {
          status: 'USED',
          usedById: createdUser.id,
          usedAt: new Date(),
          usedCount: { increment: 1 },
        },
      });

      return createdUser;
    });

    const accessToken = await sign(
      { sub: user.id, email: user.email, role: user.role },
      c.env.JWT_SECRET,
      'HS256'
    );
    const refreshToken = await createRefreshToken(user.id, c.env.JWT_SECRET);
    
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    
    return c.json({ 
      data: withNativeRefreshToken({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, workspaceId: workspace.id },
        accessToken 
      }, refreshToken, c.req.header(NATIVE_CLIENT_HEADER)),
      message: 'Pilot registration successful'
    }, 201);
  });

  app.post('/login', zValidator('json', loginSchema), async (c: any) => {
    const body = c.req.valid('json');
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });
    
    if (!user || !user.isActive) {
      throw new HTTPException(401, { message: 'Invalid credentials' });
    }
    
    // Verify password
    const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
    
    if (!passwordValid) {
      throw new HTTPException(401, { message: 'Invalid credentials' });
    }
    
    const accessToken = await sign(
      { sub: user.id, email: user.email, role: user.role },
      c.env.JWT_SECRET,
      'HS256'
    );
    const refreshToken = await createRefreshToken(user.id, c.env.JWT_SECRET);
    
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: body.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24,
      path: '/',
    });
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    return c.json({ 
      data: withNativeRefreshToken({
        user: { id: user.id, email: user.email, name: user.name },
        accessToken 
      }, refreshToken, c.req.header(NATIVE_CLIENT_HEADER)),
      message: 'Login successful' 
    });
  });

  app.post('/logout', async (c: any) => {
    deleteCookie(c, 'refreshToken', { path: '/' });
    return c.json({ success: true, message: 'Logged out' });
  });

  app.post('/refresh', zValidator('json', refreshSchema), async (c: any) => {
    const { refreshToken: bodyRefreshToken } = c.req.valid('json');
    const refreshToken = bodyRefreshToken || getCookie(c, 'refreshToken');
    if (!refreshToken) throw new HTTPException(401, { message: 'Refresh token is required' });
    
    try {
      const payload = await verify(refreshToken, c.env.JWT_SECRET, 'HS256');
      if (payload.type !== 'refresh') {
        throw new HTTPException(401, { message: 'Invalid token type' });
      }
      
      const user = await prisma.user.findUnique({
        where: { id: payload.sub as string },
      });
      
      if (!user) {
        throw new HTTPException(401, { message: 'User not found' });
      }
      
      const accessToken = await sign(
        { sub: user.id, email: user.email, role: user.role },
        c.env.JWT_SECRET,
        'HS256'
      );
      const newRefreshToken = await createRefreshToken(user.id, c.env.JWT_SECRET);
      
      setCookie(c, 'refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
      
      return c.json({ 
        data: withNativeRefreshToken({
          user: { id: user.id, email: user.email, name: user.name },
          accessToken 
        }, newRefreshToken, c.req.header(NATIVE_CLIENT_HEADER))
      });
    } catch {
      throw new HTTPException(401, { message: 'Invalid refresh token' });
    }
  });

  app.post('/change-password', zValidator('json', changePasswordSchema), async (c: any) => {
    const body = c.req.valid('json');
    const user = c.get('user');
    
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    
    if (!dbUser) {
      throw new HTTPException(404, { message: 'User not found' });
    }
    
    const passwordValid = await bcrypt.compare(body.currentPassword, dbUser.passwordHash);
    
    if (!passwordValid) {
      throw new HTTPException(401, { message: 'Current password is incorrect' });
    }
    
    const newPasswordHash = await bcrypt.hash(body.newPassword, 12);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });
    
    return c.json({ success: true, message: 'Password changed' });
  });

  app.post('/forgot-password', zValidator('json', forgotPasswordSchema), async () => {
    throw new HTTPException(503, { message: 'Password recovery is not configured. Contact the private pilot administrator for access recovery.' });
  });

  app.post('/reset-password', zValidator('json', resetPasswordSchema), async () => {
    throw new HTTPException(503, { message: 'Password reset is not configured because no verified recovery token service is available.' });
  });

  app.get('/me', async (c: any) => {
    const user = c.get('user');
    
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        timezone: true,
        locale: true,
        createdAt: true,
        lastLoginAt: true,
        role: true,
        workspaces: {
          select: {
            role: true,
            workspace: {
              select: { id: true, name: true, slug: true, plan: true, settings: true },
            },
          },
        },
      },
    });
    
    if (!fullUser) {
      throw new HTTPException(404, { message: 'User not found' });
    }
    
    return c.json({ data: fullUser });
  });

  app.post('/verify-email', async () => {
    throw new HTTPException(503, { message: 'Email verification is not configured because no verified email-delivery service is available.' });
  });

  app.post('/verify-email/confirm', async () => {
    throw new HTTPException(503, { message: 'Email confirmation is not configured because no verified token service is available.' });
  });

  return app;
}
