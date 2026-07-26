import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as stockService from '../services/stock.service';

const movementsQuerySchema = z.object({
  outletId: z.string().length(36).optional(),
  productId: z.string().length(36).optional(),
  type: z.enum(['sale', 'restock', 'adjustment', 'waste', 'return', 'initial']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

const adjustStockSchema = z.object({
  productId: z.string().length(36),
  type: z.enum(['restock', 'adjustment', 'waste', 'return']),
  quantity: z.number().int().min(1),
  note: z.string().max(255).optional(),
});

export const getStockMovements = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = movementsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
  }
  try {
    const outletId = (req as any).outletId;
    const result = await stockService.listStockMovements({ ...parsed.data, outletId: parsed.data.outletId || outletId });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = adjustStockSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  try {
    const outletId = (req as any).outletId;
    if (!outletId) {
      return res.status(400).json({ error: 'Outlet context required for stock adjustment' });
    }
    const result = await stockService.adjustStock({
      outletId,
      productId: parsed.data.productId,
      type: parsed.data.type,
      quantity: parsed.data.quantity,
      note: parsed.data.note,
      createdBy: (req as any).user?.id || (req as any).user?.userId,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof stockService.StockError) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

export const getLowStockProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const outletId = req.query.outletId as string || (req as any).outletId;
    const result = await stockService.getLowStockProducts(outletId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
