import { Request, Response } from 'express';
import * as variantService from '../services/product-variant.service';

export async function createVariant(req: Request, res: Response) {
  try {
    const { productId } = req.params as any;
    const variant = await variantService.createVariant(productId, req.body);
    res.status(201).json(variant);
  } catch (err: any) {
    console.error(`Error creating variant for product ${req.params.productId}:`, err);
    res.status(400).json({ error: err.message || 'Failed to create variant' });
  }
}

export async function getVariants(req: Request, res: Response) {
  try {
    const { productId } = req.params as any;
    const outletId = req.query.outletId as string | undefined;
    const variants = await variantService.getVariantsByProduct(productId, outletId);
    res.json(variants);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to fetch variants' });
  }
}

export async function updateVariant(req: Request, res: Response) {
  try {
    const { variantId } = req.params as any;
    const updated = await variantService.updateVariant(variantId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update variant' });
  }
}

export async function deleteVariant(req: Request, res: Response) {
  try {
    const { variantId } = req.params as any;
    await variantService.softDeleteVariant(variantId);
    res.json({ message: 'Variant deactivated successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to delete variant' });
  }
}

export async function updateOutletVariant(req: Request, res: Response) {
  try {
    const { outletId, variantId } = req.params as any;
    const updated = await variantService.upsertOutletVariant(outletId, variantId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update outlet variant' });
  }
}
