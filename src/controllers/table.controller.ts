import { Request, Response } from 'express';
import { z } from 'zod';
import * as tableService from '../services/table.service';

const createSchema = z.object({
  floorPlanId: z.string().uuid(),
  number: z.string().min(1).max(10),
  capacity: z.number().int().min(1).max(50).optional(),
  shape: z.enum(['circle', 'rectangle', 'square']).optional(),
  posX: z.number().int().min(0).optional(),
  posY: z.number().int().min(0).optional(),
  width: z.number().int().min(40).max(400).optional(),
  height: z.number().int().min(40).max(400).optional(),
});

const updateSchema = z.object({
  number: z.string().min(1).max(10).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  shape: z.enum(['circle', 'rectangle', 'square']).optional(),
  posX: z.number().int().min(0).optional(),
  posY: z.number().int().min(0).optional(),
  width: z.number().int().min(40).max(400).optional(),
  height: z.number().int().min(40).max(400).optional(),
  status: z.enum(['Empty', 'Occupied', 'Reserved']).optional(),
});

const statusSchema = z.object({
  status: z.enum(['Empty', 'Occupied', 'Reserved']),
});

const paramSchema = z.object({ id: z.string().uuid() });

const bulkPositionsSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    posX: z.number().int().min(0),
    posY: z.number().int().min(0),
  })).min(1),
});

export const listTables = async (req: Request, res: Response) => {
  const floorPlanId = req.query.floorPlanId as string;
  if (!floorPlanId) return res.status(400).json({ error: 'floorPlanId query required' });
  try {
    const tables = await tableService.listTables(floorPlanId);
    res.json(tables);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list tables', detail: error?.message });
  }
};

export const createTable = async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const table = await tableService.createTable(parsed.data);
    res.status(201).json(table);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create table', detail: error?.message });
  }
};

export const updateTable = async (req: Request, res: Response) => {
  const [params, body] = await Promise.all([
    paramSchema.safeParseAsync(req.params),
    updateSchema.safeParseAsync(req.body),
  ]);
  if (!params.success) return res.status(400).json({ error: 'Invalid id' });
  if (!body.success) return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  try {
    const table = await tableService.updateTable(params.data.id, body.data);
    res.json(table);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update table', detail: error?.message });
  }
};

export const deleteTable = async (req: Request, res: Response) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: 'Invalid id' });
  try {
    await tableService.deleteTable(params.data.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete table', detail: error?.message });
  }
};

export const updateTableStatus = async (req: Request, res: Response) => {
  const [params, body] = await Promise.all([
    paramSchema.safeParseAsync(req.params),
    statusSchema.safeParseAsync(req.body),
  ]);
  if (!params.success) return res.status(400).json({ error: 'Invalid id' });
  if (!body.success) return res.status(400).json({ error: 'Invalid status' });
  try {
    const table = await tableService.updateTableStatus(params.data.id, body.data.status);
    res.json(table);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update table status', detail: error?.message });
  }
};

export const bulkUpdatePositions = async (req: Request, res: Response) => {
  const parsed = bulkPositionsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    await tableService.bulkUpdatePositions(parsed.data.updates);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to bulk update positions', detail: error?.message });
  }
};
