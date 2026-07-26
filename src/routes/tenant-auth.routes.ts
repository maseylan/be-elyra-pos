import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { publicDb } from '../db/poolManager';
import { tenants } from '../db/schema';
import { withTenantSchema } from '../db/with-tenant-schema';
import * as tenantSchema from '../db/tenant_schema';
import { signAccessToken, generateRefreshToken, hashToken, rotateRefreshToken } from '../services/token.service';
import { checkLoginLockout, recordFailedLogin, resetLoginAttempts, getLoginScope } from '../services/login-lockout.service';
import { getCurrentTenant } from '../contexts/tenant-context';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

const passwordLoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password harus diisi'),
});

const pinLoginSchema = z.object({
  userId: z.string().min(1),
  pin: z.string().min(1),
});

function setRefreshCookie(res: Response, plainToken: string) {
  res.cookie('refreshToken', plainToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { tenantId } = getCurrentTenant();

    // Determine if password or PIN login
    const isPinLogin = 'userId' in req.body && 'pin' in req.body && !('password' in req.body);

    if (!isPinLogin) {
      return await handlePasswordLogin(req, res, tenantId);
    } else {
      return await handlePinLogin(req, res, tenantId);
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal', details: error.issues });
    }
    if (error.statusCode === 429) {
      return res.status(429).json({ error: error.message });
    }
    console.error('Tenant login error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

async function handlePasswordLogin(req: Request, res: Response, tenantId: string) {
  const { email, password } = passwordLoginSchema.parse(req.body);
  const scope = getLoginScope('tenant-operational', tenantId);

  await checkLoginLockout(scope, email);

  const users = await withTenantSchema(async (tx) => {
    return tx.select().from(tenantSchema.users).where(
      and(
        eq(tenantSchema.users.email, email),
        eq(tenantSchema.users.isActive, true),
      ),
    );
  });

  const user = users[0];
  if (!user || !user.passwordHash) {
    await recordFailedLogin(scope, email);
    return res.status(401).json({ error: 'Email atau password salah' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    await recordFailedLogin(scope, email);
    return res.status(401).json({ error: 'Email atau password salah' });
  }

  await resetLoginAttempts(scope, email);

  const { plain, hash } = generateRefreshToken();
  await withTenantSchema(async (tx) => {
    await tx
      .insert(tenantSchema.refreshTokens)
      .values({
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoUpdate({
        target: tenantSchema.refreshTokens.userId,
        set: {
          tokenHash: hash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
  });

  const accessToken = signAccessToken({
    sessionType: 'tenant-operational',
    role: user.role,
    userId: user.id,
    tenantId,
    name: user.name,
  });

  // Fetch tenant info for the response
  const [tenantRecord] = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));

  setRefreshCookie(res, plain);
  res.json({
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      sessionType: 'tenant-operational',
    },
    tenant: tenantRecord ? {
      id: tenantRecord.id,
      name: tenantRecord.name,
      subdomain: tenantRecord.subdomain,
      subscriptionType: tenantRecord.subscriptionType,
    } : undefined,
  });
}

async function handlePinLogin(req: Request, res: Response, tenantId: string) {
  const { userId, pin } = pinLoginSchema.parse(req.body);
  const scope = `tenant-pin:${tenantId}`;

  await checkLoginLockout(scope, userId);

  const users = await withTenantSchema(async (tx) => {
    return tx.select().from(tenantSchema.users).where(
      and(
        eq(tenantSchema.users.id, userId),
        eq(tenantSchema.users.isActive, true),
      ),
    );
  });

  const user = users[0];
  if (!user || !user.pinHash) {
    await recordFailedLogin(scope, userId, true);
    return res.status(401).json({ error: 'PIN salah' });
  }

  const isPinValid = await bcrypt.compare(pin, user.pinHash);
  if (!isPinValid) {
    await recordFailedLogin(scope, userId, true);
    return res.status(401).json({ error: 'PIN salah' });
  }

  await resetLoginAttempts(scope, userId);

  const { plain, hash } = generateRefreshToken();
  await withTenantSchema(async (tx) => {
    await tx
      .insert(tenantSchema.refreshTokens)
      .values({
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoUpdate({
        target: tenantSchema.refreshTokens.userId,
        set: {
          tokenHash: hash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
  });

  const accessToken = signAccessToken({
    sessionType: 'tenant-operational',
    role: user.role,
    userId: user.id,
    tenantId,
    name: user.name,
  });

  setRefreshCookie(res, plain);
  res.json({
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      sessionType: 'tenant-operational',
    },
  });
}

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const incomingToken = req.cookies?.refreshToken;
    if (!incomingToken) {
      return res.status(401).json({ error: 'Refresh token tidak ditemukan' });
    }

    const { tenantId } = getCurrentTenant();
    const incomingHash = hashToken(incomingToken);

    const result = await withTenantSchema(async (tx) => {
      const [existing] = await tx
        .select()
        .from(tenantSchema.refreshTokens)
        .where(eq(tenantSchema.refreshTokens.tokenHash, incomingHash))
        .for('update');

      if (!existing || existing.expiresAt < new Date()) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      const { plain, hash } = generateRefreshToken();
      await tx
        .update(tenantSchema.refreshTokens)
        .set({
          tokenHash: hash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .where(eq(tenantSchema.refreshTokens.id, existing.id));

      // Fetch user to get current role/name for fresh access token
      const [user] = await tx
        .select({ role: tenantSchema.users.role, name: tenantSchema.users.name })
        .from(tenantSchema.users)
        .where(eq(tenantSchema.users.id, existing.userId));

      const accessToken = signAccessToken({
        sessionType: 'tenant-operational',
        role: user?.role || 'cashier',
        userId: existing.userId,
        tenantId,
        name: user?.name,
      });

      return { accessToken, refreshTokenPlain: plain };
    });

    setRefreshCookie(res, result.refreshTokenPlain);
    res.json({ accessToken: result.accessToken });
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: error.message });
    }
    console.error('Tenant refresh error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const incomingToken = req.cookies?.refreshToken;
    if (incomingToken) {
      const hashed = hashToken(incomingToken);
      await withTenantSchema(async (tx) => {
        await tx.delete(tenantSchema.refreshTokens).where(eq(tenantSchema.refreshTokens.tokenHash, hashed));
      });
    }
    clearRefreshCookie(res);
    res.json({ message: 'Logout berhasil' });
  } catch (error) {
    console.error('Tenant logout error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

export default router;
