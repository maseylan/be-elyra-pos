import { Request, Response } from 'express';
import { z } from 'zod';
import * as promotionService from '../services/promotion.service';

const listQuerySchema = z.object({
  promotionType: z.enum(['discount', 'voucher']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  outletId: z.string().uuid().optional(),
});

const paramSchema = z.object({
  id: z.string().uuid(),
});

const promotionSchema = z.object({
  name: z.string().min(1),
  promotionType: z.enum(['discount', 'voucher']),
  type: z.enum(['discount_total', 'discount_product', 'buy_x_get_y']),
  value: z.coerce.number().min(0),
  maxDiscount: z.coerce.number().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  minPurchase: z.coerce.number().optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  buyQty: z.coerce.number().int().optional().nullable(),
  getQty: z.coerce.number().int().optional().nullable(),
  code: z.string().optional().nullable(),
  usageLimit: z.coerce.number().int().optional().nullable(),
  description: z.string().optional().nullable(),
  outletIds: z.array(z.string().uuid()).optional(),
});

const outletIdsSchema = z.object({
  outletIds: z.array(z.string().uuid()),
});

export const listPromotions = async (req: Request, res: Response) => {
  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: 'Invalid query', details: query.error.flatten() });
  }

  try {
    const result = await promotionService.listPromotions(query.data);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to list promotions', error);
    res.status(500).json({ error: 'Failed to list promotions', detail: error?.message });
  }
};

export const getPromotion = async (req: Request, res: Response) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid promotion id' });
  }

  try {
    const promotion = await promotionService.getPromotionById(params.data.id);
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    res.json(promotion);
  } catch (error: any) {
    console.error('Failed to get promotion', error);
    res.status(500).json({ error: 'Failed to get promotion', detail: error?.message });
  }
};

export const createPromotion = async (req: Request, res: Response) => {
  const body = promotionSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  }

  try {
    const promotion = await promotionService.createPromotion(body.data);
    res.status(201).json(promotion);
  } catch (error: any) {
    if (error?.message?.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Failed to create promotion', error);
    res.status(500).json({ error: 'Failed to create promotion', detail: error?.message });
  }
};

export const updatePromotion = async (req: Request, res: Response) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid promotion id' });
  }

  const body = promotionSchema.partial().safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  }

  try {
    const promotion = await promotionService.updatePromotion(params.data.id, body.data);
    res.json(promotion);
  } catch (error: any) {
    if (error?.message?.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Failed to update promotion', error);
    res.status(500).json({ error: 'Failed to update promotion', detail: error?.message });
  }
};

export const deletePromotion = async (req: Request, res: Response) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid promotion id' });
  }

  try {
    await promotionService.deletePromotion(params.data.id);
    res.json({ message: 'Promotion deleted' });
  } catch (error: any) {
    console.error('Failed to delete promotion', error);
    res.status(500).json({ error: 'Failed to delete promotion', detail: error?.message });
  }
};

export const getActivePromotions = async (req: Request, res: Response) => {
  const outletId = (req as any).outletId || req.query.outletId as string;
  if (!outletId) {
    return res.status(400).json({ error: 'Outlet context required' });
  }

  try {
    const result = await promotionService.getActivePromotions(outletId);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to get active promotions', error);
    res.status(500).json({ error: 'Failed to get active promotions', detail: error?.message });
  }
};

export const updatePromotionOutlets = async (req: Request, res: Response) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid promotion id' });
  }

  const body = outletIdsSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  }

  try {
    const promotion = await promotionService.updatePromotion(params.data.id, { outletIds: body.data.outletIds });
    res.json(promotion);
  } catch (error: any) {
    console.error('Failed to update promotion outlets', error);
    res.status(500).json({ error: 'Failed to update promotion outlets', detail: error?.message });
  }
};