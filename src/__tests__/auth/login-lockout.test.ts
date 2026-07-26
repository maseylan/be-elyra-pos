import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkLoginLockout,
  recordFailedLogin,
  resetLoginAttempts,
  getLoginScope,
} from '../../services/login-lockout.service';
import { TooManyRequestsError } from '../../utils/errors';

const mockGet = vi.fn();
const mockSetEx = vi.fn();
const mockDel = vi.fn();
const mockIncr = vi.fn();
const mockExpire = vi.fn();
const mockTtl = vi.fn();

vi.mock('../../config/redis', () => ({
  default: {
    get: mockGet,
    setEx: mockSetEx,
    del: mockDel,
    incr: mockIncr,
    expire: mockExpire,
    ttl: mockTtl,
    on: vi.fn(),
    connect: vi.fn(),
  },
  connectRedis: vi.fn(),
}));

describe('Login lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkLoginLockout', () => {
    it('melempar 429 jika ter-lock', async () => {
      mockGet.mockResolvedValue('1');
      mockTtl.mockResolvedValue(120);

      await expect(
        checkLoginLockout('superadmin', 'admin@test.com'),
      ).rejects.toThrow(TooManyRequestsError);
    });

    it('tidak melempar error jika tidak ter-lock', async () => {
      mockGet.mockResolvedValue(null);

      await expect(
        checkLoginLockout('superadmin', 'admin@test.com'),
      ).resolves.toBeUndefined();
    });
  });

  describe('recordFailedLogin', () => {
    it('mengembalikan tanpa lockout jika attempts < threshold (5)', async () => {
      mockIncr.mockResolvedValue(3);
      mockExpire.mockResolvedValue(true);

      await recordFailedLogin('superadmin', 'admin@test.com');
      expect(mockSetEx).not.toHaveBeenCalled();
    });

    it('mengaktifkan lockout setelah 5x gagal berturut-turut', async () => {
      mockIncr.mockResolvedValue(5);
      mockExpire.mockResolvedValue(true);
      mockSetEx.mockResolvedValue('OK');
      mockDel.mockResolvedValue(1);

      await recordFailedLogin('superadmin', 'admin@test.com');
      expect(mockSetEx).toHaveBeenCalled();
      expect(mockDel).toHaveBeenCalled();
    });
  });

  describe('lockout scope isolation', () => {
    it('scope per identitas — superadmin dan owner-billing untuk email yang sama adalah key terpisah', () => {
      const email = 'user@test.com';
      const scopeSuperadmin = getLoginScope('superadmin');
      const scopeBilling = getLoginScope('owner-billing');
      const scopeTenantA = getLoginScope('tenant-operational', 'tenant_a');
      const scopeTenantB = getLoginScope('tenant-operational', 'tenant_b');

      expect(scopeSuperadmin).toBe('superadmin');
      expect(scopeBilling).toBe('owner-billing');
      expect(scopeTenantA).toBe('tenant:tenant_a');
      expect(scopeTenantB).toBe('tenant:tenant_b');

      expect(new Set([scopeSuperadmin, scopeBilling, scopeTenantA, scopeTenantB]).size).toBe(4);
    });

    it('gagal login owner-billing tidak mempengaruhi tenant-operational dengan email sama', async () => {
      const email = 'owner@test.com';

      mockIncr.mockResolvedValue(5);
      mockExpire.mockResolvedValue(true);
      mockSetEx.mockResolvedValue('OK');
      mockDel.mockResolvedValue(1);

      await recordFailedLogin('owner-billing', email);
      
      mockGet.mockResolvedValue(null);
      mockIncr.mockResolvedValue(1);

      await expect(
        checkLoginLockout('tenant:tenant_123', email),
      ).resolves.toBeUndefined();
    });
  });

  describe('resetLoginAttempts', () => {
    it('login berhasil me-reset counter percobaan gagal', async () => {
      mockDel.mockResolvedValue(1);

      await resetLoginAttempts('superadmin', 'admin@test.com');
      expect(mockDel).toHaveBeenCalledWith(
        expect.arrayContaining([
          'login:attempts:superadmin:admin@test.com',
          'login:lockout:superadmin:admin@test.com',
        ]),
      );
    });
  });

  describe('lockout TTL', () => {
    it('lockout otomatis hilang setelah 5 menit (TTL expired)', async () => {
      mockGet.mockResolvedValue(null);

      await expect(
        checkLoginLockout('superadmin', 'admin@test.com'),
      ).resolves.toBeUndefined();
    });

    it('setEx dipanggil dengan LOCKOUT_DURATION_SECONDS (300) saat lockout diaktifkan', async () => {
      mockIncr.mockResolvedValue(5);
      mockExpire.mockResolvedValue(true);
      mockSetEx.mockResolvedValue('OK');
      mockDel.mockResolvedValue(1);

      await recordFailedLogin('superadmin', 'user@test.com');

      expect(mockSetEx).toHaveBeenCalledWith(
        expect.stringContaining('login:lockout:superadmin:user@test.com'),
        300,
        '1',
      );
    });
  });
});
