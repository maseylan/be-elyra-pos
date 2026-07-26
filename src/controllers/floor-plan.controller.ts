import { Request, Response } from 'express';
import { z } from 'zod';
import * as floorPlanService from '../services/floor-plan.service';

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

export const listFloorPlans = async (req: Request, res: Response) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  try {
    const plans = await floorPlanService.listFloorPlans(outletId);
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list floor plans', detail: error?.message });
  }
};

export const getFloorPlan = async (req: Request, res: Response) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  const params = paramSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: 'Invalid id' });
  try {
    const plan = await floorPlanService.getFloorPlan(params.data.id, outletId);
    if (!plan) return res.status(404).json({ error: 'Floor plan not found' });
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get floor plan', detail: error?.message });
  }
};

export const createFloorPlan = async (req: Request, res: Response) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const plan = await floorPlanService.createFloorPlan(outletId, parsed.data);
    res.status(201).json(plan);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create floor plan', detail: error?.message });
  }
};

export const updateFloorPlan = async (req: Request, res: Response) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  const [params, body] = await Promise.all([
    paramSchema.safeParseAsync(req.params),
    updateSchema.safeParseAsync(req.body),
  ]);
  if (!params.success) return res.status(400).json({ error: 'Invalid id' });
  if (!body.success) return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  try {
    const plan = await floorPlanService.updateFloorPlan(params.data.id, outletId, body.data);
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update floor plan', detail: error?.message });
  }
};

export const deleteFloorPlan = async (req: Request, res: Response) => {
  const outletId = (req as any).outletId;
  if (!outletId) return res.status(400).json({ error: 'Outlet context required' });
  const params = paramSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: 'Invalid id' });
  try {
    await floorPlanService.deleteFloorPlan(params.data.id, outletId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete floor plan', detail: error?.message });
  }
};
