import { Request, Response, NextFunction } from 'express';
import * as variantService from '../services/product-variant.service';
import { asyncHandler } from '../utils/asyncHandler';

export const createVariant = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params as any;
  const variant = await variantService.createVariant(productId, req.body);
  res.status(201).json(variant);
});

export const getVariants = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params as any;
  const outletId = req.query.outletId as string | undefined;
  const variants = await variantService.getVariantsByProduct(productId, outletId);
  res.json(variants);
});

export const updateVariant = asyncHandler(async (req: Request, res: Response) => {
  const { variantId } = req.params as any;
  const updated = await variantService.updateVariant(variantId, req.body);
  res.json(updated);
});

export const deleteVariant = asyncHandler(async (req: Request, res: Response) => {
  const { variantId } = req.params as any;
  await variantService.softDeleteVariant(variantId);
  res.json({ message: 'Variant deactivated successfully' });
});

export const updateOutletVariant = asyncHandler(async (req: Request, res: Response) => {
  const { outletId, variantId } = req.params as any;
  const updated = await variantService.upsertOutletVariant(outletId, variantId, req.body);
  res.json(updated);
});
