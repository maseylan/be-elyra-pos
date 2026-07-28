import { Request, Response } from 'express';
import * as addonService from '../services/addon.service';

export async function createAddOn(req: Request, res: Response) {
  try {
    const addOn = await addonService.createAddOn(req.body);
    res.status(201).json(addOn);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create add-on' });
  }
}

export async function getAddOns(req: Request, res: Response) {
  try {
    const outletId = req.query.outletId as string | undefined;
    const productId = req.query.productId as string | undefined;

    if (productId) {
      const addOns = await addonService.getAddOnsForProduct(productId, outletId);
      return res.json(addOns);
    }

    const addOns = await addonService.getAddOns(outletId);
    res.json(addOns);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to fetch add-ons' });
  }
}

export async function attachAddOn(req: Request, res: Response) {
  try {
    const { productId } = req.params as any;
    const { addOnId } = req.body;
    const link = await addonService.attachAddOnToProduct(productId, addOnId);
    res.status(201).json(link);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to attach add-on' });
  }
}

export async function detachAddOn(req: Request, res: Response) {
  try {
    const { productId, addOnId } = req.params as any;
    await addonService.detachAddOnFromProduct(productId, addOnId);
    res.json({ message: 'Add-on detached successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to detach add-on' });
  }
}

export async function updateOutletAddOn(req: Request, res: Response) {
  try {
    const { outletId, addOnId } = req.params as any;
    const updated = await addonService.upsertOutletAddOn(outletId, addOnId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update outlet add-on' });
  }
}
