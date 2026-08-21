import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { sign, verify } from 'hono/jwt';
import { setCookie, deleteCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import type { Variables } from '../index.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  company: z.string().max(200).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().default(false),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
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

export function createAuthRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.post('/register', zValidator('json', registerSchema), async (c: any) => {
    const body = c.req.valid('json');
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });
    
    if (existingUser) {
      throw new HTTPException(409, { message: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(body.password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: hashedPassword,
        name: body.name,
      },
    });
    
    // Create default workspace for user
    const workspace = await prisma.workspace.create({
      data: {
        name: `${user.name || user.email}'s Workspace`,
        slug: `${user.email.split('@')[0]}-${Date.now()}`,
        ownerId: user.id,
      },
    });
    
    // Add user as owner of workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'owner',
        joinedAt: new Date(),
      },
    });
    
    const accessToken = await sign(
      { sub: user.id, email: user.email, role: 'owner' },
      c.env.JWT_SECRET,
      'HS256'
    );
    const refreshToken = await sign(
      { sub: user.id, type: 'refresh' },
      c.env.JWT_SECRET,
      'HS256',
      60 * 60 * 24 * 30
    );
    
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    
    return c.json({ 
      data: { 
        user: { id: user.id, email: user.email, name: user.name },
        accessToken 
      },
      message: 'Registration successful'
    }, 201);
  });

  app.post('/login', zValidator('json', loginSchema), async (c: any) => {
    const body = c.req.valid('json');
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });
    
    if (!user) {
      throw new HTTPException(401, { message: 'Invalid credentials' });
    }
    
    // Verify password
    const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
    
    if (!passwordValid) {
      throw new HTTPException(401, { message: 'Invalid credentials' });
    }
    
    // Get user's workspace membership
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true, role: true },
    });
    
    const accessToken = await sign(
      { sub: user.id, email: user.email, role: membership?.role || 'viewer' },
      c.env.JWT_SECRET,
      'HS256'
    );
    const refreshToken = await sign(
      { sub: user.id, type: 'refresh' },
      c.env.JWT_SECRET,
      'HS256',
      60 * 60 * 24 * 30
    );
    
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
      data: { 
        user: { id: user.id, email: user.email, name: user.name },
        accessToken 
      }, 
      message: 'Login successful' 
    });
  });

  app.post('/logout', async (c: any) => {
    deleteCookie(c, 'refreshToken', { path: '/' });
    return c.json({ success: true, message: 'Logged out' });
  });

  app.post('/refresh', zValidator('json', refreshSchema), async (c: any) => {
    const { refreshToken } = c.req.valid('json');
    
    try {
      const payload = await verify(refreshToken, c.env.JWT_SECRET);
      if (payload.type !== 'refresh') {
        throw new HTTPException(401, { message: 'Invalid token type' });
      }
      
      const user = await prisma.user.findUnique({
        where: { id: payload.sub as string },
      });
      
      if (!user) {
        throw new HTTPException(401, { message: 'User not found' });
      }
      
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId: user.id },
        select: { role: true },
      });
      
      const accessToken = await sign(
        { sub: user.id, email: user.email, role: membership?.role || 'viewer' },
        c.env.JWT_SECRET,
        'HS256'
      );
      const newRefreshToken = await sign(
        { sub: user.id, type: 'refresh' },
        c.env.JWT_SECRET,
        'HS256',
        60 * 60 * 24 * 30
      );
      
      setCookie(c, 'refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
      
      return c.json({ 
        data: { 
          user: { id: user.id, email: user.email, name: user.name },
          accessToken 
        } 
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

  app.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c: any) => {
    const body = c.req.valid('json');
    
    // TODO: Generate reset token, send email
    // For security, always return success even if email doesn't exist
    return c.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  });

  app.post('/reset-password', zValidator('json', resetPasswordSchema), async (c: any) => {
    const body = c.req.valid('json');
    
    // TODO: Verify token, hash new password, update
    return c.json({ success: true, message: 'Password reset successful' });
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
        workspaces: {
          include: {
            workspace: {
              select: { id: true, name: true, slug: true, plan: true },
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

  app.post('/verify-email', async (c: any) => {
    const user = c.get('user');
    
    // TODO: Send verification email
    return c.json({ success: true, message: 'Verification email sent' });
  });

  app.post('/verify-email/confirm', async (c: any) => {
    // TODO: Verify token from email
    return c.json({ success: true, message: 'Email verified' });
  });

  return app;
}