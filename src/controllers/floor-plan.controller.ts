import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as floorPlanService from '../services/floor-plan.service';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  width: z.number().int().min(200).max(4000).optional(),
  height: z.number().int().min(200).max(4000).optional(),
  gridSize: z.number().int().min(10).max(100).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  width: z.number().int().min(200).max(4000).optional(),
  height: z.number().int().min(200).max(4000).optional(),
  gridSize: z.number().int().min(10).max(100).optional(),
});

const paramSchema = z.object({ id: z.string().uuid() });

export const listFloorPlans = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  const plans = await floorPlanService.listFloorPlans(outletId);
  res.json(plans);
});

export const getFloorPlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  const params = paramSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: 'Invalid id' });
  const plan = await floorPlanService.getFloorPlan(params.data.id, outletId);
  if (!plan) return res.status(404).json({ error: 'Floor plan not found' });
  res.json(plan);
});

export const createFloorPlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const plan = await floorPlanService.createFloorPlan(outletId, parsed.data);
  res.status(201).json(plan);
});

export const updateFloorPlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  const [params, body] = await Promise.all([
    paramSchema.safeParseAsync(req.params),
    updateSchema.safeParseAsync(req.body),
  ]);
  if (!params.success) return res.status(400).json({ error: 'Invalid id' });
  if (!body.success) return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  const plan = await floorPlanService.updateFloorPlan(params.data.id, outletId, body.data);
  res.json(plan);
});

export const deleteFloorPlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  const params = paramSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: 'Invalid id' });
  await floorPlanService.deleteFloorPlan(params.data.id, outletId);
  res.json({ success: true });
});
