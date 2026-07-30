import { Request, Response, NextFunction } from 'express';
import * as modifierService from '../services/modifier.service';
import { asyncHandler } from '../utils/asyncHandler';

export const createModifierGroup = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params as any;
  const group = await modifierService.createModifierGroup(productId, req.body);
  res.status(201).json(group);
});

export const getModifierGroups = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params as any;
  const outletId = req.query.outletId as string | undefined;
  const groups = await modifierService.getModifierGroupsByProduct(productId, outletId);
  res.json(groups);
});

export const createModifier = asyncHandler(async (req: Request, res: Response) => {
  const { groupId } = req.params as any;
  const modifier = await modifierService.createModifier(groupId, req.body);
  res.status(201).json(modifier);
});

export const updateModifierGroup = asyncHandler(async (req: Request, res: Response) => {
  const { groupId } = req.params as any;
  const updated = await modifierService.updateModifierGroup(groupId, req.body);
  res.json(updated);
});

export const updateModifier = asyncHandler(async (req: Request, res: Response) => {
  const { modifierId } = req.params as any;
  const updated = await modifierService.updateModifier(modifierId, req.body);
  res.json(updated);
});

export const deleteModifier = asyncHandler(async (req: Request, res: Response) => {
  const { modifierId } = req.params as any;
  await modifierService.softDeleteModifier(modifierId);
  res.json({ message: 'Modifier deactivated successfully' });
});

export const updateOutletModifier = asyncHandler(async (req: Request, res: Response) => {
  const { outletId, modifierId } = req.params as any;
  const updated = await modifierService.upsertOutletModifier(outletId, modifierId, req.body);
  res.json(updated);
});
