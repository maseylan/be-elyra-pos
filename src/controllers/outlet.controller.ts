import { Request, Response } from 'express';
import { z } from 'zod';
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

export const createOutlet = async (req: Request, res: Response) => {
  const parsed = createOutletSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  try {
    const outlet = await outletService.createOutlet(parsed.data);
    res.status(201).json(outlet);
  } catch (error: any) {
    console.error('Failed to create outlet', error);
    res.status(500).json({ error: 'Failed to create outlet', detail: error?.message });
  }
};

export const getOutlet = async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid outlet id' });
  }
  try {
    const outlet = await outletService.getOutletById(parsedParams.data.id);
    res.json(outlet);
  } catch (error) {
    if (error instanceof outletService.OutletNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to fetch outlet', error);
    res.status(500).json({ error: 'Failed to fetch outlet', detail: (error as any)?.message });
  }
};

export const listOutlets = async (req: Request, res: Response) => {
  try {
    const outlets = await outletService.listOutlets();
    res.json(outlets);
  } catch (error: any) {
    console.error('Failed to fetch outlets', error);
    res.status(500).json({ error: 'Failed to fetch outlets', detail: error?.message });
  }
};

export const updateOutlet = async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid outlet id' });
  }

  const parsed = updateOutletSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  try {
    const outlet = await outletService.updateOutlet(parsedParams.data.id, parsed.data);
    res.json(outlet);
  } catch (error) {
    if (error instanceof outletService.OutletNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to update outlet', error);
    res.status(500).json({ error: 'Failed to update outlet', detail: (error as any)?.message });
  }
};

export const deactivateOutlet = async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid outlet id' });
  }
  try {
    await outletService.deactivateOutlet(parsedParams.data.id);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof outletService.OutletNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to deactivate outlet', error);
    res.status(500).json({ error: 'Failed to deactivate outlet', detail: (error as any)?.message });
  }
};
