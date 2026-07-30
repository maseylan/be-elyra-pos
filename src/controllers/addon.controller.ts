import { Request, Response, NextFunction } from 'express';
import * as addonService from '../services/addon.service';
import { asyncHandler } from '../utils/asyncHandler';

export const createAddOn = asyncHandler(async (req: Request, res: Response) => {
  const addOn = await addonService.createAddOn(req.body);
  res.status(201).json(addOn);
});

export const getAddOns = asyncHandler(async (req: Request, res: Response) => {
  const outletId = req.query.outletId as string | undefined;
  const productId = req.query.productId as string | undefined;

  if (productId) {
    const addOns = await addonService.getAddOnsForProduct(productId, outletId);
    return res.json(addOns);
  }

  const addOns = await addonService.getAddOns(outletId);
  res.json(addOns);
});

export const attachAddOn = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params as any;
  const { addOnId } = req.body;
  const link = await addonService.attachAddOnToProduct(productId, addOnId);
  res.status(201).json(link);
});

export const detachAddOn = asyncHandler(async (req: Request, res: Response) => {
  const { productId, addOnId } = req.params as any;
  await addonService.detachAddOnFromProduct(productId, addOnId);
  res.json({ message: 'Add-on detached successfully' });
});

export const updateOutletAddOn = asyncHandler(async (req: Request, res: Response) => {
  const { outletId, addOnId } = req.params as any;
  const updated = await addonService.upsertOutletAddOn(outletId, addOnId, req.body);
  res.json(updated);
});
