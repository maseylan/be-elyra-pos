import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '../utils/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-123';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

export type SessionType = 'superadmin' | 'owner-billing' | 'tenant-operational';

export interface AccessTokenPayload {
  sessionType: SessionType;
  role: string;
  email?: string;
  // superadmin
  superAdminId?: string;
  // owner-billing
  tenantId?: string;
  // tenant-operational
  userId?: string;
  name?: string;
}

export function generateRefreshToken(): { plain: string; hash: string } {
  const plain = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  return { plain, hash };
}

export function hashToken(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
}

export async function rotateRefreshToken(
  incomingPlainToken: string,
  table: any,
  db: any,
  buildPayload: (record: any) => AccessTokenPayload,
): Promise<{ accessToken: string; refreshTokenPlain: string }> {
  const incomingHash = hashToken(incomingPlainToken);

  return db.transaction(async (tx: any) => {
    const [existing] = await tx
      .select()
      .from(table)
      .where(eq(table.tokenHash, incomingHash))
      .for('update');

    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const { plain, hash } = generateRefreshToken();
    await tx
      .update(table)
      .set({
        tokenHash: hash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      })
      .where(eq(table.id, existing.id));

    const accessToken = signAccessToken(buildPayload(existing));
    return { accessToken, refreshTokenPlain: plain };
  });
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}
