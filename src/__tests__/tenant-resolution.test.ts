import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getCurrentTenant, tenantContext } from '../contexts/tenant-context';
import { publicDb } from '../db/poolManager';
import { tenants } from '../db/schema';
import redisClient from '../config/redis';

vi.unmock('../contexts/tenant-context');

// Mock dependencies
vi.mock('../config/redis', () => ({
  default: {
    get: vi.fn(),
    setEx: vi.fn(() => Promise.resolve('OK')),
  }
}));

vi.mock('../db/poolManager', () => ({
  publicDb: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((cond) => {
          return [{
            id: 'tenant_mock',
            applicationStatus: 'provisioned'
          }];
        })
      }))
    })),
    transaction: vi.fn(async (cb) => {
      return cb({
        execute: vi.fn()
      });
    })
  },
  adminPool: {
    connect: vi.fn(() => Promise.resolve({ query: vi.fn(), release: vi.fn() })),
  },
}));

// Mock auth middleware to pass freely for the test
vi.mock('../middlewares/auth.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => next(),
  requireOwner: (req: any, res: any, next: any) => next(),
  requireRole: (roles: any) => (req: any, res: any, next: any) => next(),
  requireSuperadmin: (req: any, res: any, next: any) => next(),
  requireLoyaltyAccess: (req: any, res: any, next: any) => next(),
  authorizeTenantAccess: (req: any, res: any, next: any) => next(),
}));

// Mock require-session-type middleware
vi.mock('../middlewares/require-session-type.middleware', () => ({
  requireSessionType: () => (req: any, res: any, next: any) => next(),
}));

describe('Tenant Resolution Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows access to public route without tenant context', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects access to protected route with invalid host', async () => {
    // Attempting to hit an API route without a subdomain
    const res = await request(app).get('/api/products').set('Host', 'elyrapos.my.id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Tenant not found');
  });

  it('rejects access to protected route with reserved subdomain', async () => {
    const res = await request(app).get('/api/products').set('Host', 'api.elyrapos.my.id');
    expect(res.status).toBe(404);
  });

  it('tetap mengasosiasikan tenant context yang benar di bawah concurrent request', async () => {
    // Override redis mock for this specific test
    vi.mocked(redisClient.get).mockImplementation((key) => {
      if (key === 'tenant:resolve:tenanta') {
        return Promise.resolve(JSON.stringify({ tenantId: 'tenant_a', status: 'provisioned' }));
      }
      if (key === 'tenant:resolve:tenantb') {
        return Promise.resolve(JSON.stringify({ tenantId: 'tenant_b', status: 'provisioned' }));
      }
      return Promise.resolve(null);
    });

    const [resA, resB] = await Promise.all([
      request(app).get('/api/products').set('Host', 'tenanta.elyrapos.my.id'),
      request(app).get('/api/products').set('Host', 'tenantb.elyrapos.my.id'),
    ]);

    expect(resA.status).toBe(200);
    expect(resA.body.data).toContainEqual(expect.objectContaining({ name: 'Produk A Only' }));
    expect(resA.body.data).not.toContainEqual(expect.objectContaining({ name: 'Produk B Only' }));

    expect(resB.status).toBe(200);
    expect(resB.body.data).toContainEqual(expect.objectContaining({ name: 'Produk B Only' }));
    expect(resB.body.data).not.toContainEqual(expect.objectContaining({ name: 'Produk A Only' }));
  });

  it('throws an error if getCurrentTenant is called outside context', () => {
    tenantContext.run(undefined as any, () => {
      expect(() => getCurrentTenant()).toThrow(/Tenant context is missing/);
    });
  });
});
