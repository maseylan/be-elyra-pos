import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../utils/errors';
import * as sessionService from '../services/session.service';

const openSessionSchema = z.object({
  outletId: z.string().uuid(),
  startingCash: z.number().nonnegative(),
  notes: z.string().optional(),
});

const closeSessionSchema = z.object({
  sessionId: z.string().uuid(),
  endingCash: z.number().nonnegative(),
  closingNotes: z.string().optional(),
});

const forceCloseSessionSchema = z.object({
  reason: z.string().min(3, 'Alasan force close minimal 3 karakter'),
  endingCash: z.number().nonnegative().optional(),
  closingNotes: z.string().optional(),
});

export const getActiveSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const outletId = (req.query.outletId as string) || (req as any).user?.outletId;
    const cashierId = req.auth?.userId || req.user?.userId || (req.user as any)?.id;

    if (!outletId) {
      return res.status(400).json({ error: 'outletId parameter is required' });
    }

    const session = await sessionService.getActiveSession(outletId, cashierId);
    return res.json({ data: session });
  } catch (error) {
    next(error);
  }
};

export const openSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = openSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Data tidak valid', details: parseResult.error.issues });
    }

    const cashierId = req.auth?.userId || req.user?.userId || (req.user as any)?.id;
    const cashierName = req.auth?.name || (req.user as any)?.name || req.auth?.email || 'Kasir';

    const session = await sessionService.openSession({
      outletId: parseResult.data.outletId,
      cashierId,
      cashierName,
      startingCash: parseResult.data.startingCash,
      notes: parseResult.data.notes,
    });

    return res.status(201).json({ message: 'Shift berhasil dibuka', data: session });
  } catch (error: any) {
    if (error instanceof HttpError) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

export const closeSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = closeSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Data tidak valid', details: parseResult.error.issues });
    }

    const userId = (req as any).user?.id || (req as any).user?.userId;

    const session = await sessionService.closeSession({
      sessionId: parseResult.data.sessionId,
      endingCash: parseResult.data.endingCash,
      closingNotes: parseResult.data.closingNotes,
      closedBy: userId,
    });

    return res.json({ message: 'Shift berhasil ditutup', data: session });
  } catch (error: any) {
    if (error instanceof HttpError) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

export const forceCloseSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const parseResult = forceCloseSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Data tidak valid', details: parseResult.error.issues });
    }

    const supervisorId = (req as any).user?.id || (req as any).user?.userId;

    const session = await sessionService.forceCloseSession({
      sessionId,
      supervisorId,
      reason: parseResult.data.reason,
      endingCash: parseResult.data.endingCash,
      closingNotes: parseResult.data.closingNotes,
    });

    return res.json({ message: 'Shift berhasil ditutup paksa oleh Supervisor', data: session });
  } catch (error: any) {
    if (error instanceof HttpError) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
};

export const getSessionHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryOutlet = req.query.outletId as string | undefined;
    let targetOutletId: string | undefined = undefined;

    if (queryOutlet && queryOutlet !== '' && queryOutlet !== 'all') {
      targetOutletId = queryOutlet;
    } else if (!queryOutlet && (req as any).outletId && req.baseUrl.includes('/outlets/')) {
      targetOutletId = (req as any).outletId;
    }

    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      cashierId: req.query.cashierId as string,
      status: req.query.status as string,
    };

    const history = await sessionService.getSessionHistory(targetOutletId, filters);
    return res.json({ data: history });
  } catch (error) {
    next(error);
  }
};
