import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { withTenantSchema } from '../db/with-tenant-schema';
import { cashierSessions, orders } from '../db/tenant_schema';
import { HttpError } from '../utils/errors';
import * as outletSettingsService from './outlet-settings.service';

export interface OpenSessionParams {
  outletId: string;
  cashierId: string;
  cashierName: string;
  startingCash: number;
  notes?: string;
}

export interface CloseSessionParams {
  sessionId: string;
  endingCash: number;
  closingNotes?: string;
  closedBy: string;
}

export interface ForceCloseSessionParams {
  sessionId: string;
  supervisorId: string;
  reason: string;
  endingCash?: number;
  closingNotes?: string;
}

export interface SessionHistoryFilters {
  startDate?: string;
  endDate?: string;
  cashierId?: string;
  status?: string;
}

export const getActiveSession = async (outletId: string, cashierId: string) => {
  return withTenantSchema(async (tx) => {
    const [session] = await tx
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.outletId, outletId),
          eq(cashierSessions.cashierId, cashierId),
          eq(cashierSessions.status, 'OPEN')
        )
      )
      .limit(1);

    if (!session) {
      return null;
    }

    // Realtime query for active shift sales
    const completedOrders = await tx
      .select({
        paymentMethod: orders.paymentMethod,
        totalAmount: orders.totalAmount,
      })
      .from(orders)
      .where(
        and(
          eq(orders.sessionId, session.id),
          sql`LOWER(${orders.status}) = 'completed'`
        )
      );

    const paymentBreakdown: Record<string, number> = {};
    let totalCashSales = 0;
    let totalSales = 0;

    for (const ord of completedOrders) {
      const pm = (ord.paymentMethod || 'CASH').toUpperCase();
      const amt = Number(ord.totalAmount || 0);
      paymentBreakdown[pm] = (paymentBreakdown[pm] || 0) + amt;
      totalSales += amt;
      if (pm === 'CASH') {
        totalCashSales += amt;
      }
    }

    const startingCash = Number(session.startingCash || 0);
    const expectedCash = startingCash + totalCashSales;

    return {
      ...session,
      startingCash,
      realtimeSales: {
        paymentBreakdown,
        totalCashSales,
        totalSales,
        ordersCount: completedOrders.length,
        expectedCash,
      },
    };
  });
};

export const openSession = async (params: OpenSessionParams) => {
  // Resolve & snapshot settings SEBELUM masuk withTenantSchema session,
  // karena resolveEffectiveSettings juga memanggil withTenantSchema sendiri.
  let settingsSnapshot: Record<string, any> = {};
  try {
    settingsSnapshot = await outletSettingsService.resolveEffectiveSettings(params.outletId);
    // Hilangkan rawOverrides dari snapshot (internal field, tidak perlu disimpan)
    const { rawOverrides: _, ...rest } = settingsSnapshot as any;
    settingsSnapshot = rest;
  } catch (e) {
    console.warn('Could not snapshot outlet settings on session open:', e);
  }

  return withTenantSchema(async (tx) => {
    try {
      const [newSession] = await tx
        .insert(cashierSessions)
        .values({
          outletId: params.outletId,
          cashierId: params.cashierId,
          cashierName: params.cashierName,
          startingCash: params.startingCash.toString(),
          status: 'OPEN',
          notes: params.notes,
          settingsSnapshot,
        })
        .returning();

      return newSession;
    } catch (error: any) {
      // Postgres unique constraint violation code
      if (error?.code === '23505' || error?.message?.includes('idx_one_open_session_per_cashier_outlet')) {
        throw new HttpError(409, 'Kasir ini sudah memiliki session Buka Shift yang aktif di outlet ini.');
      }
      throw error;
    }
  });
};

async function computeCloseData(tx: any, sessionId: string) {
  const [session] = await tx
    .select()
    .from(cashierSessions)
    .where(and(eq(cashierSessions.id, sessionId), eq(cashierSessions.status, 'OPEN')))
    .limit(1);

  if (!session) throw new HttpError(404, 'Session shift tidak ditemukan atau sudah ditutup');

  const completedOrders = await tx
    .select({ paymentMethod: orders.paymentMethod, totalAmount: orders.totalAmount })
    .from(orders)
    .where(and(eq(orders.sessionId, session.id), sql`LOWER(${orders.status}) = 'completed'`));

  const refundedOrders = await tx
    .select({ totalAmount: orders.totalAmount })
    .from(orders)
    .where(and(eq(orders.sessionId, session.id), sql`LOWER(${orders.status}) IN ('refunded', 'void')`));

  const paymentBreakdown: Record<string, number> = {};
  let totalCashSales = 0;
  for (const ord of completedOrders) {
    const pm = (ord.paymentMethod || 'CASH').toUpperCase();
    const amt = Number(ord.totalAmount || 0);
    paymentBreakdown[pm] = (paymentBreakdown[pm] || 0) + amt;
    if (pm === 'CASH') totalCashSales += amt;
  }

  const startingCash = Number(session.startingCash || 0);
  return { session, completedOrders, refundedOrders, paymentBreakdown, totalCashSales, startingCash };
}

export const closeSession = async (params: CloseSessionParams) => {
  return withTenantSchema(async (tx) => {
    const data = await computeCloseData(tx, params.sessionId);
    const expectedCash = data.startingCash + data.totalCashSales;
    const totalRefunds = data.refundedOrders.reduce((sum: number, r: any) => sum + Number(r.totalAmount || 0), 0);
    const endingCash = Number(params.endingCash);

    const [updatedSession] = await tx
      .update(cashierSessions)
      .set({
        status: 'CLOSED', closedAt: new Date(),
        endingCash: endingCash.toString(), expectedCash: expectedCash.toString(),
        cashDifference: (endingCash - expectedCash).toString(),
        paymentBreakdown: data.paymentBreakdown, totalRefunds: totalRefunds.toString(),
        totalOrdersCount: data.completedOrders.length,
        closedBy: params.closedBy, closingNotes: params.closingNotes, updatedAt: new Date(),
      })
      .where(eq(cashierSessions.id, data.session.id))
      .returning();
    return updatedSession;
  });
};

export const forceCloseSession = async (params: ForceCloseSessionParams) => {
  return withTenantSchema(async (tx) => {
    const data = await computeCloseData(tx, params.sessionId);
    const expectedCash = data.startingCash + data.totalCashSales;
    const totalRefunds = data.refundedOrders.reduce((sum: number, r: any) => sum + Number(r.totalAmount || 0), 0);
    const endingCash = params.endingCash != null ? Number(params.endingCash) : null;

    const [updatedSession] = await tx
      .update(cashierSessions)
      .set({
        status: 'CLOSED', closedAt: new Date(),
        endingCash: endingCash?.toString() ?? null, expectedCash: expectedCash.toString(),
        cashDifference: endingCash != null ? (endingCash - expectedCash).toString() : null,
        paymentBreakdown: data.paymentBreakdown, totalRefunds: totalRefunds.toString(),
        totalOrdersCount: data.completedOrders.length,
        closedBy: params.supervisorId, forceClosedReason: params.reason,
        closingNotes: params.closingNotes, updatedAt: new Date(),
      })
      .where(eq(cashierSessions.id, data.session.id))
      .returning();
    return updatedSession;
  });
};

export const getSessionHistory = async (outletId?: string, filters: SessionHistoryFilters = {}) => {
  return withTenantSchema(async (tx) => {
    const conditions = [];

    if (outletId) {
      conditions.push(eq(cashierSessions.outletId, outletId));
    }

    if (filters.cashierId) {
      conditions.push(eq(cashierSessions.cashierId, filters.cashierId));
    }

    if (filters.status) {
      conditions.push(eq(cashierSessions.status, filters.status));
    }

    if (filters.startDate) {
      conditions.push(gte(cashierSessions.openedAt, new Date(filters.startDate)));
    }

    if (filters.endDate) {
      conditions.push(lte(cashierSessions.openedAt, new Date(filters.endDate)));
    }

    const history = await tx
      .select()
      .from(cashierSessions)
      .where(and(...conditions))
      .orderBy(desc(cashierSessions.openedAt))
      .limit(100);

    return history;
  });
};
