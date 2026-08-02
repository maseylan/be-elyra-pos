import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { withTenantDb } from '../db/with-tenant-db';
import { cashierSessions, orders, cashMovements } from '../db/tenant_schema';
import { HttpError } from '../utils/errors';
import * as outletSettingsService from './outlet-settings.service';

export interface CreateCashMovementParams {
  outletId: string;
  sessionId: string;
  type: 'CASH_IN' | 'CASH_OUT';
  amount: number;
  reason: string;
  cashierId: string;
  cashierName: string;
}

export interface OpenSessionParams {
  outletId: string;
  cashierId: string;
  cashierName: string;
  startingCash: number;
  terminalName?: string;
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

export const getActiveSession = async (outletId: string, cashierId?: string, terminalName?: string) => {
  const effectiveSettings = await outletSettingsService.resolveEffectiveSettings(outletId);
  const isMultiTerminal = !!effectiveSettings?.multiTerminal;

  return withTenantDb(async (tx) => {
    const conditions = [
      eq(cashierSessions.outletId, outletId),
      eq(cashierSessions.status, 'OPEN'),
    ];

    if (isMultiTerminal && terminalName) {
      conditions.push(eq(cashierSessions.terminalName, terminalName));
    }

    const [session] = await tx
      .select()
      .from(cashierSessions)
      .where(and(...conditions))
      .orderBy(desc(cashierSessions.openedAt))
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

    // Query cash movements for the active session
    const movements = await tx
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.sessionId, session.id))
      .orderBy(desc(cashMovements.createdAt));

    let totalCashIn = 0;
    let totalCashOut = 0;
    for (const m of movements) {
      const amt = Number(m.amount || 0);
      if (m.type === 'CASH_IN') totalCashIn += amt;
      else if (m.type === 'CASH_OUT') totalCashOut += amt;
    }

    const startingCash = Number(session.startingCash || 0);
    const expectedCash = startingCash + totalCashSales + totalCashIn - totalCashOut;

    return {
      ...session,
      startingCash,
      realtimeSales: {
        paymentBreakdown,
        totalCashSales,
        totalCashIn,
        totalCashOut,
        totalSales,
        ordersCount: completedOrders.length,
        expectedCash,
        cashMovements: movements,
      },
    };
  });
};

export const createCashMovement = async (params: CreateCashMovementParams) => {
  return withTenantDb(async (tx) => {
    const [session] = await tx
      .select()
      .from(cashierSessions)
      .where(and(eq(cashierSessions.id, params.sessionId), eq(cashierSessions.status, 'OPEN')))
      .limit(1);

    if (!session) {
      throw new HttpError(404, 'Session shift aktif tidak ditemukan.');
    }

    const [movement] = await tx
      .insert(cashMovements)
      .values({
        outletId: params.outletId,
        sessionId: params.sessionId,
        type: params.type,
        amount: params.amount.toString(),
        reason: params.reason,
        cashierId: params.cashierId,
        cashierName: params.cashierName,
      })
      .returning();

    return movement;
  });
};

export const getCashMovements = async (sessionId: string) => {
  return withTenantDb(async (tx) => {
    return await tx
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.sessionId, sessionId))
      .orderBy(desc(cashMovements.createdAt));
  });
};

export const openSession = async (params: OpenSessionParams) => {
  let settingsSnapshot: Record<string, any> = {};
  try {
    settingsSnapshot = await outletSettingsService.resolveEffectiveSettings(params.outletId);
    const { rawOverrides: _, ...rest } = settingsSnapshot as any;
    settingsSnapshot = rest;
  } catch (e) {
    console.warn('Could not snapshot outlet settings on session open:', e);
  }

  const isMultiTerminal = !!settingsSnapshot?.multiTerminal;

  return withTenantDb(async (tx) => {
    // Check if an open session already exists for this outlet / terminal
    const existingConditions = [
      eq(cashierSessions.outletId, params.outletId),
      eq(cashierSessions.status, 'OPEN'),
    ];
    if (isMultiTerminal && params.terminalName) {
      existingConditions.push(eq(cashierSessions.terminalName, params.terminalName));
    }

    const existingOpen = await tx
      .select()
      .from(cashierSessions)
      .where(and(...existingConditions))
      .limit(1);

    if (existingOpen.length > 0) {
      if (isMultiTerminal) {
        throw new HttpError(409, `Terminal "${params.terminalName || 'ini'}" sudah memiliki shift aktif.`);
      } else {
        throw new HttpError(409, 'Outlet ini sudah memiliki shift aktif.');
      }
    }

    try {
      const [newSession] = await tx
        .insert(cashierSessions)
        .values({
          outletId: params.outletId,
          cashierId: params.cashierId,
          cashierName: params.cashierName,
          terminalName: params.terminalName || null,
          startingCash: params.startingCash.toString(),
          status: 'OPEN',
          notes: params.notes,
          settingsSnapshot,
        })
        .returning();

      return newSession;
    } catch (error: any) {
      if (error?.code === '23505' || error?.message?.includes('idx_one_open_session_per_cashier_outlet')) {
        throw new HttpError(409, 'Shift sudah aktif.');
      }
      throw error;
    }
  });
};

export const getTerminalStatus = async (outletId: string) => {
  const effectiveSettings = await outletSettingsService.resolveEffectiveSettings(outletId);
  const isMultiTerminal = !!effectiveSettings?.multiTerminal;
  const configuredTerminals: string[] = effectiveSettings?.terminals || [];

  return withTenantDb(async (tx) => {
    const activeSessions = await tx
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.outletId, outletId),
          eq(cashierSessions.status, 'OPEN')
        )
      );

    return {
      multiTerminal: isMultiTerminal,
      terminals: configuredTerminals,
      activeSessions,
    };
  });
};

async function computeCloseData(tx: any, sessionId: string) {
  const [session] = await tx
    .select()
    .from(cashierSessions)
    .where(and(eq(cashierSessions.id, sessionId), eq(cashierSessions.status, 'OPEN')))
    .for('update')
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

  const movements = await tx
    .select()
    .from(cashMovements)
    .where(eq(cashMovements.sessionId, session.id));

  let totalCashIn = 0;
  let totalCashOut = 0;
  for (const m of movements) {
    const amt = Number(m.amount || 0);
    if (m.type === 'CASH_IN') totalCashIn += amt;
    else if (m.type === 'CASH_OUT') totalCashOut += amt;
  }

  const startingCash = Number(session.startingCash || 0);
  return { session, completedOrders, refundedOrders, paymentBreakdown, totalCashSales, totalCashIn, totalCashOut, startingCash };
}

export const closeSession = async (params: CloseSessionParams) => {
  return withTenantDb(async (tx) => {
    const data = await computeCloseData(tx, params.sessionId);
    const expectedCash = data.startingCash + data.totalCashSales + data.totalCashIn - data.totalCashOut;
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
      .where(and(eq(cashierSessions.id, data.session.id), eq(cashierSessions.status, 'OPEN')))
      .returning();
    if (!updatedSession) throw new HttpError(409, 'Session was already closed by another request');
    return updatedSession;
  });
};

export const forceCloseSession = async (params: ForceCloseSessionParams) => {
  return withTenantDb(async (tx) => {
    const data = await computeCloseData(tx, params.sessionId);
    const expectedCash = data.startingCash + data.totalCashSales + data.totalCashIn - data.totalCashOut;
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
  return withTenantDb(async (tx) => {
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
