import { vi } from 'vitest';

export interface MockTx {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  [key: string]: any;
}

export interface MockDb extends MockTx {
  transaction: ReturnType<typeof vi.fn>;
  mockTx: MockTx;
}

export function createMockDb(): MockDb {
  const mockTx: MockTx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          for: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  };

  const transaction = vi.fn(async (fn: (tx: MockTx) => any) => fn(mockTx));

  return { transaction, ...mockTx, mockTx } as any;
}

export function mockTxSelect(tx: MockTx, records: any[]) {
  tx.select.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        for: vi.fn(() => Promise.resolve(records)),
      })),
    })),
  });
}

export function createMockExpress() {
  return {
    req: {
      headers: {},
      cookies: {},
      body: {},
      params: {},
      query: {},
      auth: undefined,
      user: undefined,
    } as any,
    res: {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    } as any,
    next: vi.fn(),
  };
}
