import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as stockService from '../services/stock.service';

const movementsQuerySchema = z.object({
  outletId: z.string().length(36).optional(),
  productId: z.string().length(36).optional(),
  variantId: z.string().length(36).optional(),
  type: z.enum(['sale', 'restock', 'adjustment', 'waste', 'return', 'initial']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  excludeSales: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

const adjustStockSchema = z.object({
  productId: z.string().length(36),
  variantId: z.string().length(36).optional().nullable(),
  type: z.enum(['restock', 'stock_out', 'adjustment', 'waste', 'return']),
  quantity: z.number().int(),
  note: z.string().max(255).optional(),
  reason: z.string().max(255).optional(),
  userId: z.string().optional(),
  createdBy: z.string().optional(),
});

export const getStockMovements = async (req: Request, res: Response, next: NextFunction) => {
  const parsed = movementsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
  }
  try {
    const outletId = (req as any).outletId || parsed.data.outletId;
    const result = await stockService.listStockMovements({ ...parsed.data, outletId });
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
    const currentUser = (req as any).user;
    const createdBy = currentUser?.id || currentUser?.userId;

    const result = await stockService.adjustStock({
      outletId,
      productId: parsed.data.productId,
      variantId: parsed.data.variantId || undefined,
      type: parsed.data.type,
      quantity: parsed.data.quantity,
      note: parsed.data.note,
      reason: parsed.data.reason,
      createdBy,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getLowStockProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const outletId = req.outletId;
    const result = await stockService.getLowStockProducts(outletId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
