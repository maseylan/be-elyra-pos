import { Request, Response } from 'express';
import * as modifierService from '../services/modifier.service';

export async function createModifierGroup(req: Request, res: Response) {
  try {
    const { productId } = req.params as any;
    const group = await modifierService.createModifierGroup(productId, req.body);
    res.status(201).json(group);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create modifier group' });
  }
}

export async function getModifierGroups(req: Request, res: Response) {
  try {
    const { productId } = req.params as any;
    const outletId = req.query.outletId as string | undefined;
    const groups = await modifierService.getModifierGroupsByProduct(productId, outletId);
    res.json(groups);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to fetch modifier groups' });
  }
}

export async function createModifier(req: Request, res: Response) {
  try {
    const { groupId } = req.params as any;
    const modifier = await modifierService.createModifier(groupId, req.body);
    res.status(201).json(modifier);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create modifier' });
  }
}

export async function updateModifierGroup(req: Request, res: Response) {
  try {
    const { groupId } = req.params as any;
    const updated = await modifierService.updateModifierGroup(groupId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update modifier group' });
  }
}

export async function updateModifier(req: Request, res: Response) {
  try {
    const { modifierId } = req.params as any;
    const updated = await modifierService.updateModifier(modifierId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update modifier' });
  }
}

export async function deleteModifier(req: Request, res: Response) {
  try {
    const { modifierId } = req.params as any;
    await modifierService.softDeleteModifier(modifierId);
    res.json({ message: 'Modifier deactivated successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to delete modifier' });
  }
}

export async function updateOutletModifier(req: Request, res: Response) {
  try {
    const { outletId, modifierId } = req.params as any;
    const updated = await modifierService.upsertOutletModifier(outletId, modifierId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update outlet modifier' });
  }
}
