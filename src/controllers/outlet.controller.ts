import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';
import * as outletService from '../services/outlet.service';

const createOutletSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().optional(),
  phone: z.string().max(30).optional(),
  businessMode: z.enum(['retail', 'fnb']).default('retail'),
  isCustomConfig: z.boolean().default(false),
});

const updateOutletSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(20).optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().max(100).optional().nullable(),
  logoUrl: z.string().optional().nullable(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const createOutlet = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsed = createOutletSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const outlet = await outletService.createOutlet(parsed.data);
  res.status(201).json(outlet);
});

export const getOutlet = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid outlet id' });
  }
  const outlet = await outletService.getOutletById(parsedParams.data.id);
  res.json(outlet);
});

export const listOutlets = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const outlets = await outletService.listOutlets();
  res.json(outlets);
});

export const updateOutlet = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid outlet id' });
  }

  const parsed = updateOutletSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const outlet = await outletService.updateOutlet(parsedParams.data.id, parsed.data);
  res.json(outlet);
});

export const deactivateOutlet = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid outlet id' });
  }
  await outletService.deactivateOutlet(parsedParams.data.id);
  res.json({ success: true });
});
