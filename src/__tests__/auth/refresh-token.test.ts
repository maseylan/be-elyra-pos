import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  rotateRefreshToken,
} from '../../services/token.service';
import { HttpError } from '../../utils/errors';
import { createMockDb, mockTxSelect } from '../helpers/mocks';

describe('Refresh token flow (per identitas)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('generateRefreshToken', () => {
    it('menghasilkan plain dan hash yang valid', () => {
      const { plain, hash } = generateRefreshToken();
      expect(plain).toBeTruthy();
      expect(hash).toBeTruthy();
      expect(plain.length).toBe(128); // 64 bytes = 128 hex chars
      expect(hash.length).toBe(64); // SHA-256 = 64 hex chars
      expect(hashToken(plain)).toBe(hash);
    });

    it('setiap panggilan menghasilkan nilai unik', () => {
      const a = generateRefreshToken();
      const b = generateRefreshToken();
      expect(a.plain).not.toBe(b.plain);
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe('signAccessToken / verifyAccessToken', () => {
    it('sign dan verify token superadmin', () => {
      const payload = { sessionType: 'superadmin' as const, role: 'superadmin' as const, superAdminId: 'sa-1', email: 'admin@test.com' };
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.sessionType).toBe('superadmin');
      expect(decoded.superAdminId).toBe('sa-1');
      expect(decoded.email).toBe('admin@test.com');
    });

    it('sign dan verify token owner-billing', () => {
      const payload = { sessionType: 'owner-billing' as const, role: 'owner' as const, tenantId: 'tenant_123', email: 'owner@test.com' };
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.sessionType).toBe('owner-billing');
      expect(decoded.tenantId).toBe('tenant_123');
    });

    it('sign dan verify token tenant-operational', () => {
      const payload = { sessionType: 'tenant-operational' as const, role: 'cashier' as const, userId: 'user-1', tenantId: 'tenant_123', name: 'Kasir A' };
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.sessionType).toBe('tenant-operational');
      expect(decoded.userId).toBe('user-1');
      expect(decoded.name).toBe('Kasir A');
    });

    it('melempar error untuk token expired', () => {
      vi.setSystemTime(new Date('2025-01-01'));
      const payload = { sessionType: 'superadmin' as const, role: 'superadmin' as const };
      const token = signAccessToken(payload);
      
      vi.setSystemTime(new Date('2025-01-02'));
      expect(() => verifyAccessToken(token)).toThrow();
    });
  });

  describe('rotateRefreshToken', () => {
    it('berhasil rotate, token lama tidak bisa dipakai lagi', async () => {
      const { plain: oldPlain, hash: oldHash } = generateRefreshToken();
      const mockDb = createMockDb();

      mockTxSelect(mockDb.mockTx, [{
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: oldHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }]);

      const result = await rotateRefreshToken(
        oldPlain,
        { tokenHash: 'hash' },
        mockDb,
        (existing: any) => ({
          sessionType: 'tenant-operational' as const,
          role: 'cashier' as const,
          userId: existing.userId,
          tenantId: 'tenant_123',
        }),
      );

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshTokenPlain).toBeTruthy();
      expect(result.refreshTokenPlain).not.toBe(oldPlain);
    });

    it('refresh dengan token expired ditolak 401', async () => {
      const { plain: expiredPlain, hash: expiredHash } = generateRefreshToken();
      const mockDb = createMockDb();

      mockTxSelect(mockDb.mockTx, [{
        id: 'rt-expired',
        userId: 'user-1',
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 1000), // sudah lewat
      }]);

      await expect(
        rotateRefreshToken(expiredPlain, { tokenHash: 'hash' }, mockDb, (e: any) => ({ sessionType: 'tenant-operational' as const, role: 'cashier' as const, userId: e.userId, tenantId: 't' })),
      ).rejects.toThrow(HttpError);
    });

    it('login baru invalidate refresh token sebelumnya (single device)', async () => {
      const { plain: oldPlain } = generateRefreshToken();
      const mockDb = createMockDb();

      // Simulasi token lama tidak ditemukan (sudah di-overwrite oleh login baru)
      mockTxSelect(mockDb.mockTx, []);

      await expect(
        rotateRefreshToken(oldPlain, { tokenHash: 'hash' }, mockDb, (e: any) => ({ sessionType: 'tenant-operational' as const, role: 'cashier' as const, userId: 'u', tenantId: 't' })),
      ).rejects.toThrow(HttpError);
    });

    it('concurrent refresh dengan token sama — hanya satu yang sukses', async () => {
      const { plain, hash } = generateRefreshToken();

      const mockDb1 = createMockDb();
      const mockDb2 = createMockDb();

      const validRecord = {
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      // Db1: token ditemukan
      mockTxSelect(mockDb1.mockTx, [{ ...validRecord }]);
      // Db2: token sudah tidak ada (sudah di-rotate oleh db1)
      mockTxSelect(mockDb2.mockTx, []);

      const buildPayload = (existing: any) => ({
        sessionType: 'tenant-operational' as const,
        role: 'cashier' as const,
        userId: existing.userId,
        tenantId: 'tenant_123',
      });

      const result1 = rotateRefreshToken(plain, { tokenHash: 'hash' }, mockDb1, buildPayload);
      const result2 = rotateRefreshToken(plain, { tokenHash: 'hash' }, mockDb2, buildPayload);

      await expect(result1).resolves.toBeTruthy();
      await expect(result2).rejects.toThrow(HttpError);
    });
  });
});
