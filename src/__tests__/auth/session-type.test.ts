import { describe, it, expect, vi } from 'vitest';
import { requireSessionType } from 
'../../middlewares/require-session-type.middleware';
import { createMockExpress } from '../helpers/mocks';

describe('Session type isolation', () => {
  it('access token owner-billing DITOLAK saat dipakai hit endpoint operasional (requireSessionType tenant-operational)', () => {
    const { req, res, next } = createMockExpress();
    req.auth = {
      sessionType: 'owner-billing',
      role: 'owner',
      tenantId: 'tenant_123',
      email: 'owner@test.com',
    };

    const middleware = requireSessionType('tenant-operational');
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Session type') }),
    );
  });

  it('access token tenant-operational DITOLAK saat dipakai hit endpoint billing (requireSessionType owner-billing)', () => {
    const { req, res, next } = createMockExpress();
    req.auth = {
      sessionType: 'tenant-operational',
      role: 'owner',
      userId: 'user-1',
      tenantId: 'tenant_123',
    };

    const middleware = requireSessionType('owner-billing');
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('access token yang sesuai tipe diizinkan melewati middleware', () => {
    const { req, res, next } = createMockExpress();
    req.auth = {
      sessionType: 'tenant-operational',
      role: 'cashier',
      userId: 'user-1',
      tenantId: 'tenant_123',
    };

    const middleware = requireSessionType('tenant-operational');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('billing endpoint menerima owner-billing token', () => {
    const { req, res, next } = createMockExpress();
    req.auth = {
      sessionType: 'owner-billing',
      role: 'owner',
      tenantId: 'tenant_123',
      email: 'owner@test.com',
    };

    const middleware = requireSessionType('owner-billing');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
