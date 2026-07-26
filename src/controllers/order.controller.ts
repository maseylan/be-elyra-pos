import { Request, Response } from 'express';
import { z } from 'zod';
import * as orderService from '../services/order.service';

const createOrderSchema = z.object({
  idempotencyKey: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productName: z.string().optional(),
    quantity: z.number().int().min(1),
    price: z.number().min(0),
    subtotal: z.number().min(0),
    notes: z.string().optional(),
  })).min(1),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0),
  discountAmount: z.number().min(0),
  totalAmount: z.number().min(0),
  roundingAmount: z.number().default(0),
  paymentMethod: z.string().min(1),
  amountPaid: z.number().min(0),
  changeAmount: z.number().min(0),
  tableNumber: z.string().optional(),
  cashierId: z.string().uuid().optional(),
  cashierName: z.string().optional(),
  memberId: z.string().uuid().optional(),
  couponCode: z.string().optional(),
  redeemedRewardId: z.string().uuid().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  memberId: z.string().uuid().optional(),
});

const paramSchema = z.object({
  id: z.string().uuid(),
});

const summaryQuerySchema = z.object({
  period: z.enum(['today', '7days', '30days']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  tz: z.string().optional(),
});

const refundSchema = z.object({
  reason: z.string().min(1),
  refundedBy: z.string().optional(),
});

export const createOrder = async (req: Request, res: Response) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const outletId = (req as any).outletId;
  if (!outletId) {
    return res.status(400).json({ error: 'Outlet context required' });
  }

  try {
    const order = await orderService.createOrder(outletId, parsed.data);
    res.status(201).json(order);
  } catch (error: any) {
    if (error?.message?.includes('idempotency_key')) {
      return res.status(409).json({ error: 'Order with this idempotency key already exists' });
    }
    console.error('Failed to create order', error);
    res.status(500).json({ error: 'Failed to create order', detail: error?.message });
  }
};

export const listOrders = async (req: Request, res: Response) => {
  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: 'Invalid query', details: query.error.flatten() });
  }

  const outletId = (req as any).outletId;

  try {
    const result = await orderService.listOrders({ outletId, ...query.data });
    res.json(result);
  } catch (error: any) {
    console.error('Failed to list orders', error);
    res.status(500).json({ error: 'Failed to list orders', detail: error?.message });
  }
};

export const getOrder = async (req: Request, res: Response) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const outletId = (req as any).outletId;

  try {
    const order = await orderService.getOrderById(params.data.id, outletId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error: any) {
    console.error('Failed to get order', error);
    res.status(500).json({ error: 'Failed to get order', detail: error?.message });
  }
};

export const getOrderSummary = async (req: Request, res: Response) => {
  const query = summaryQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: 'Invalid query', details: query.error.flatten() });
  }

  const outletId = (req as any).outletId;

  try {
    const result = await orderService.getOrderSummary({ outletId, ...query.data });
    res.json(result);
  } catch (error: any) {
    console.error('Failed to get order summary', error);
    res.status(500).json({ error: 'Failed to get order summary', detail: error?.message });
  }
};

export const refundOrder = async (req: Request, res: Response) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const body = refundSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  }

  try {
    const order = await orderService.refundOrder(params.data.id, body.data.reason, body.data.refundedBy);
    res.json(order);
  } catch (error: any) {
    console.error('Failed to refund order', error);
    if (error?.message?.includes('not found')) return res.status(404).json({ error: error.message });
    if (error?.message?.includes('already refunded') || error?.message?.includes('Cannot refund')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to refund order', detail: error?.message });
  }
};
