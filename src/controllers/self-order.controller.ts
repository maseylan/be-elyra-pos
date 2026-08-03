import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../utils/errors';
import * as selfOrderService from '../services/self-order.service';

const createSelfOrderSchema = z.object({
  customerName: z.string().min(1, 'Nama pemesan wajib diisi'),
  customerPhone: z.string().nullable().optional(),
  tableNumber: z.string().nullable().optional(),
  paymentMethod: z.enum(['cashier', 'qris']),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().nonnegative(),
    variantId: z.string().nullable().optional(),
    variantName: z.string().nullable().optional(),
    selectedModifiers: z.array(z.object({
      id: z.string().optional(),
      name: z.string(),
      price: z.number().optional(),
    })).optional(),
    selectedAddOns: z.array(z.object({
      id: z.string().optional(),
      name: z.string(),
      price: z.number().optional(),
    })).optional(),
    notes: z.string().nullable().optional(),
  })).min(1, 'Minimal harus memilih 1 produk'),
  subtotal: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative(),
});

export const getSelfOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const outletId = Array.isArray(req.params.outletId) ? req.params.outletId[0] : req.params.outletId;
    const tableId = req.query.tableId as string | undefined;

    if (!outletId) {
      return res.status(400).json({ error: 'outletId parameter is required' });
    }

    const status = await selfOrderService.getSelfOrderStatus(outletId, tableId);
    return res.json({ data: status });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
};

export const getSelfOrderCatalog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const outletId = Array.isArray(req.params.outletId) ? req.params.outletId[0] : req.params.outletId;
    if (!outletId) {
      return res.status(400).json({ error: 'outletId parameter is required' });
    }

    const catalog = await selfOrderService.getSelfOrderCatalog(outletId);
    return res.json({ data: catalog });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
};

export const createSelfOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const outletId = Array.isArray(req.params.outletId) ? req.params.outletId[0] : req.params.outletId;
    if (!outletId) {
      return res.status(400).json({ error: 'outletId parameter is required' });
    }

    const parseResult = createSelfOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Data order tidak valid', details: parseResult.error.issues });
    }

    const order = await selfOrderService.createSelfOrder({
      outletId,
      ...parseResult.data,
    });

    return res.status(201).json({ message: 'Pesanan Self-Order berhasil dibuat', data: order });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
};

export const getPendingQROrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const outletId = req.outletId;
    if (!outletId) {
      return res.status(400).json({ error: 'outletId is required' });
    }

    const orders = await selfOrderService.getPendingQROrders(outletId);
    return res.json({ data: orders });
  } catch (error) {
    next(error);
  }
};

export const claimPendingQROrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    const outletId = req.outletId;
    const cashierId = req.auth?.userId || req.user?.userId || (req.user as any)?.id;
    const cashierName = req.auth?.name || (req.user as any)?.name || 'Kasir';

    if (!orderId || !outletId) {
      return res.status(400).json({ error: 'orderId and outletId are required' });
    }

    const claimedOrder = await selfOrderService.claimPendingQROrder(orderId, outletId, cashierId, cashierName);
    return res.json({ message: 'Pesanan berhasil diklaim', data: claimedOrder });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
};
