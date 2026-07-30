import { beforeAll, afterAll, vi } from 'vitest';

// Mock Redis client
vi.mock('../../config/redis', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    setEx: vi.fn().mockResolvedValue('OK'),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    ttl: vi.fn().mockResolvedValue(300),
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
  },
  connectRedis: vi.fn().mockResolvedValue(undefined),
}));

// Mock tenant context
vi.mock('../../contexts/tenant-context', () => ({
  getCurrentTenant: vi.fn().mockReturnValue({
    tenantId: 'tenant_test123',
    status: 'provisioned',
    subscriptionType: 'pro',
  }),
  tenantContext: {
    run: vi.fn((data: any, fn: () => void) => fn()),
    getStore: vi.fn().mockReturnValue({
      tenantId: 'tenant_test123',
      status: 'provisioned',
      subscriptionType: 'pro',
    }),
  },
}));

// Set JWT secret for tests
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';
