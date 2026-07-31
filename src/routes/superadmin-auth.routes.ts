import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { publicDb } from '../db/poolManager';
import { superAdmins, superadminRefreshTokens } from '../db/schema';
import { signAccessToken, generateRefreshToken, hashToken, rotateRefreshToken } from '../services/token.service';
import { checkLoginLockout, recordFailedLogin, resetLoginAttempts } from '../services/login-lockout.service';
import { HttpError } from '../utils/errors';
const router = Router();

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password harus diisi'),
});

function setRefreshCookie(res: Response, plainToken: string) {
  res.cookie('superadminRefreshToken', plainToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie('superadminRefreshToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth/refresh',
  });
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const scope = 'superadmin';

    await checkLoginLockout(scope, email);

    const [admin] = await publicDb.select().from(superAdmins).where(eq(superAdmins.email, email));
    if (!admin) {
      await recordFailedLogin(scope, email);
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      await recordFailedLogin(scope, email);
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    if (!admin.emailVerified) {
      return res.status(403).json({ error: 'Email belum diverifikasi. Silakan cek email Anda.' });
    }

    await resetLoginAttempts(scope, email);

    const { plain, hash } = generateRefreshToken();
    await publicDb
      .insert(superadminRefreshTokens)
      .values({
        superAdminId: admin.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoUpdate({
        target: superadminRefreshTokens.superAdminId,
        set: {
          tokenHash: hash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

    const accessToken = signAccessToken({
      sessionType: 'superadmin',
      role: 'superadmin',
      superAdminId: admin.id,
      email: admin.email,
    });

    setRefreshCookie(res, plain);
    res.json({
      accessToken,
      user: { id: admin.id, role: 'superadmin', sessionType: 'superadmin', email: admin.email },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal', details: error.issues });
    }
    if (error.statusCode === 429) {
      return res.status(429).json({ error: error.message });
    }
    console.error('Superadmin login error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const incomingToken = req.cookies?.superadminRefreshToken;
    if (!incomingToken) {
      return res.status(401).json({ error: 'Refresh token tidak ditemukan' });
    }

    const result = await rotateRefreshToken(
      incomingToken,
      superadminRefreshTokens,
      publicDb,
      (existing) => ({
        sessionType: 'superadmin' as const,
        role: 'superadmin' as const,
        superAdminId: existing.superAdminId,
      }),
    );

    setRefreshCookie(res, result.refreshTokenPlain);
    res.json({ accessToken: result.accessToken });
  } catch (error: any) {
    if (error instanceof HttpError) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: error.message });
    }
    console.error('Superadmin refresh error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const incomingToken = req.cookies?.superadminRefreshToken;
    if (incomingToken) {
      const hashed = hashToken(incomingToken);
      await publicDb.delete(superadminRefreshTokens).where(eq(superadminRefreshTokens.tokenHash, hashed));
    }
    clearRefreshCookie(res);
    res.json({ message: 'Logout berhasil' });
  } catch (error) {
    console.error('Superadmin logout error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

export default router;
