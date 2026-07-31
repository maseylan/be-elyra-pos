import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { publicDb } from '../db/poolManager';
import { tenants, ownerBillingRefreshTokens } from '../db/schema';
import { signAccessToken, generateRefreshToken, hashToken, rotateRefreshToken } from '../services/token.service';
import { checkLoginLockout, recordFailedLogin, resetLoginAttempts } from '../services/login-lockout.service';
import { HttpError } from '../utils/errors';
import { sendResetPassword } from '../services/email.service';
import { generateResetToken, verifyResetToken } from '../services/otp.service';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password harus diisi'),
});

function setRefreshCookie(res: Response, plainToken: string) {
  res.cookie('ownerRefreshToken', plainToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie('ownerRefreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const scope = 'owner-billing';

    await checkLoginLockout(scope, email);

    const [tenantRecord] = await publicDb.select().from(tenants).where(eq(tenants.email, email));
    if (!tenantRecord) {
      await recordFailedLogin(scope, email);
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const isPasswordValid = await bcrypt.compare(password, tenantRecord.passwordHash);
    if (!isPasswordValid) {
      await recordFailedLogin(scope, email);
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    if (!tenantRecord.isActive) {
      return res.status(403).json({ error: 'Akun telah dinonaktifkan' });
    }

    if (!tenantRecord.emailVerified) {
      return res.status(403).json({ error: 'Email belum diverifikasi. Silakan cek email Anda.' });
    }

    if (tenantRecord.nextBillingCycle && new Date() >= new Date(tenantRecord.nextBillingCycle) && tenantRecord.applicationStatus !== 'expired') {
      await publicDb.update(tenants)
        .set({ applicationStatus: 'expired' })
        .where(eq(tenants.id, tenantRecord.id))
        .catch(e => console.warn('Failed to mark tenant expired:', e));
    }

    await resetLoginAttempts(scope, email);

    const { plain, hash } = generateRefreshToken();
    await publicDb
      .insert(ownerBillingRefreshTokens)
      .values({
        tenantId: tenantRecord.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoUpdate({
        target: ownerBillingRefreshTokens.tenantId,
        set: {
          tokenHash: hash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

    const accessToken = signAccessToken({
      sessionType: 'owner-billing',
      role: 'owner',
      tenantId: tenantRecord.id,
      email: tenantRecord.email,
    });

    setRefreshCookie(res, plain);
    res.json({
      accessToken,
      user: { id: tenantRecord.id, role: 'owner', sessionType: 'owner-billing', email: tenantRecord.email },
      tenant: {
        id: tenantRecord.id,
        name: tenantRecord.name,
        subdomain: tenantRecord.subdomain,
        ownerName: tenantRecord.ownerName,
        subscriptionType: tenantRecord.subscriptionType,
        nextBillingCycle: tenantRecord.nextBillingCycle,
        applicationStatus: tenantRecord.applicationStatus,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal', details: error.issues });
    }
    if (error.statusCode === 429) {
      return res.status(429).json({ error: error.message });
    }
    console.error('Owner-billing login error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const incomingToken = req.cookies?.ownerRefreshToken;
    if (!incomingToken) {
      return res.status(401).json({ error: 'Refresh token tidak ditemukan' });
    }

    const result = await rotateRefreshToken(
      incomingToken,
      ownerBillingRefreshTokens,
      publicDb,
      (existing) => ({
        sessionType: 'owner-billing' as const,
        role: 'owner' as const,
        tenantId: existing.tenantId,
      }),
    );

    setRefreshCookie(res, result.refreshTokenPlain);
    res.json({ accessToken: result.accessToken });
  } catch (error: any) {
    if (error instanceof HttpError) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: error.message });
    }
    console.error('Owner-billing refresh error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const [tenantRecord] = await publicDb.select().from(tenants).where(eq(tenants.email, email));
    if (!tenantRecord || !tenantRecord.emailVerified) return res.json({ message: 'Link reset password telah dikirim ke email Anda.' });
    const token = await generateResetToken(email, 'owner-billing');
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}&type=owner`;
    sendResetPassword(email, resetLink).catch(e => console.warn('Reset password email failed:', e));
    res.json({ message: 'Link reset password telah dikirim ke email Anda.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validasi gagal', details: error.issues });
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, token, password } = z.object({ email: z.string().email(), token: z.string().min(1), password: z.string().min(6) }).parse(req.body);
    const valid = await verifyResetToken(email, token, 'owner-billing');
    if (!valid) return res.status(400).json({ error: 'Token tidak valid atau sudah kedaluwarsa' });
    const hash = await bcrypt.hash(password, 12);
    await publicDb.update(tenants).set({ passwordHash: hash }).where(eq(tenants.email, email));
    res.json({ message: 'Password berhasil direset' });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validasi gagal', details: error.issues });
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const incomingToken = req.cookies?.ownerRefreshToken;
    if (incomingToken) {
      const hashed = hashToken(incomingToken);
      await publicDb.delete(ownerBillingRefreshTokens).where(eq(ownerBillingRefreshTokens.tokenHash, hashed));
    }
    clearRefreshCookie(res);
    res.json({ message: 'Logout berhasil' });
  } catch (error) {
    console.error('Owner-billing logout error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
});

export default router;
