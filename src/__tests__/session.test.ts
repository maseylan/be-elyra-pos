import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpError } from '../utils/errors';
import * as sessionService from '../services/session.service';

vi.mock('../db/with-tenant-schema', () => ({
  withTenantSchema: vi.fn(async (cb) => {
    // Pass mock tx
    return cb(mockTx);
  }),
}));

const mockTx: any = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

describe('Session Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw SessionConflictError on duplicate open session', async () => {
    mockTx.insert.mockImplementation(() => {
      const err: any = new Error('duplicate key');
      err.code = '23505';
      throw err;
    });

    await expect(
      sessionService.openSession({
        outletId: 'outlet-1',
        cashierId: 'cashier-1',
        cashierName: 'Kasir Test',
        startingCash: 100000,
      })
    ).rejects.toThrow(HttpError);
  });

  it('should calculate expected cash and difference on closeSession', async () => {
    const mockSession = {
      id: 'session-1',
      outletId: 'outlet-1',
      cashierId: 'cashier-1',
      startingCash: '100000',
      status: 'OPEN',
    };

    // Select open session
    mockTx.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([mockSession]),
        }),
      }),
    }));

    // Select completed orders
    mockTx.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => Promise.resolve([
          { paymentMethod: 'CASH', totalAmount: '50000' },
          { paymentMethod: 'QRIS', totalAmount: '75000' },
        ]),
      }),
    }));

    // Select refunded orders
    mockTx.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => Promise.resolve([
          { totalAmount: '10000' }
        ]),
      }),
    }));

    // Update cashier_sessions
    mockTx.update.mockImplementationOnce(() => ({
      set: (data: any) => {
        expect(data.status).toBe('CLOSED');
        expect(data.expectedCash).toBe('150000'); // 100k start + 50k cash sales
        expect(data.endingCash).toBe('150000');
        expect(data.cashDifference).toBe('0');
        expect(data.paymentBreakdown).toEqual({ CASH: 50000, QRIS: 75000 });
        expect(data.totalRefunds).toBe('10000');
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...mockSession, ...data }]),
          }),
        };
      },
    }));

    const result = await sessionService.closeSession({
      sessionId: 'session-1',
      endingCash: 150000,
      closedBy: 'cashier-1',
      closingNotes: 'Shift lancar',
    });

    expect(result.status).toBe('CLOSED');
  });
});
