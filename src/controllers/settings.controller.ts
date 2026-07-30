import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as settingsService from '../services/settings.service';
import * as outletSettingsService from '../services/outlet-settings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

const settingsSchema = z.object({
  storeName: z.string().min(1).max(100),
  storeAddress: z.string().optional().nullable(),
  storePhone: z.string().optional().nullable(),
  defaultTaxRate: z.coerce.string().optional().nullable(),
  taxType: z.enum(['inclusive', 'exclusive', 'none']).optional().nullable(),
  receiptFooter: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  dateFormat: z.string().optional().nullable(),
  timeFormat: z.string().optional().nullable(),
  allowSellingBelowCost: z.boolean().optional().nullable(),
  allowNegativeStock: z.boolean().optional().nullable(),
  requireCustomer: z.boolean().optional().nullable(),
  autoGenerateOrderNumber: z.boolean().optional().nullable(),
  orderNumberingFormat: z.string().optional().nullable(),
  roundingMethod: z.string().optional().nullable(),
  decimalPrecision: z.coerce.number().int().optional().nullable(),
  promotionTaxMode: z.enum(['before_tax', 'after_tax']).optional().nullable(),
  paymentMethods: z.array(z.object({
    name: z.string(),
    feeType: z.enum(['none', 'fixed', 'percentage']),
    feeValue: z.number().optional().default(0),
    isDefault: z.boolean().optional().default(false),
  })).optional().nullable(),
});

const outletSettingsSchema = z.object({
  storeNameOverride: z.string().optional().nullable(),
  storeAddressOverride: z.string().optional().nullable(),
  storePhoneOverride: z.string().optional().nullable(),
  receiptFooterOverride: z.string().optional().nullable(),
  defaultTaxRateOverride: z.coerce.string().optional().nullable(),
  taxTypeOverride: z.string().optional().nullable(),
  timezoneOverride: z.string().optional().nullable(),
  currencyOverride: z.string().optional().nullable(),
  dateFormatOverride: z.string().optional().nullable(),
  timeFormatOverride: z.string().optional().nullable(),
  allowSellingBelowCostOverride: z.boolean().optional().nullable(),
  allowNegativeStockOverride: z.boolean().optional().nullable(),
  requireCustomerOverride: z.boolean().optional().nullable(),
  autoGenerateOrderNumberOverride: z.boolean().optional().nullable(),
  orderNumberingFormatOverride: z.string().optional().nullable(),
  roundingMethodOverride: z.string().optional().nullable(),
  decimalPrecisionOverride: z.coerce.number().int().optional().nullable(),
  orderSequenceResetOverride: z.string().optional().nullable(),
  promotionTaxModeOverride: z.string().optional().nullable(),
  paymentMethodsOverride: z.array(z.object({
    name: z.string(),
    feeType: z.enum(['none', 'fixed', 'percentage']),
    feeValue: z.number().optional().default(0),
    isDefault: z.boolean().optional().default(false),
  })).optional().nullable(),
  activeFloorPlanIds: z.array(z.string().uuid()).optional().nullable(),
});

const outletIdParamSchema = z.object({
  outletId: z.string().uuid(),
});

export const getSettings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const settings = await settingsService.getTenantSettings();
  res.json(settings);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const settings = await settingsService.updateTenantSettings(parsed.data);
  res.json(settings);
});

export const getOutletSettings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsedParams = outletIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid outlet id' });
  }

  const settings = await outletSettingsService.resolveEffectiveSettings(parsedParams.data.outletId);
  res.json(settings);
});

export const updateOutletSettings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsedParams = outletIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid outlet id' });
  }

  const parsed = outletSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const settings = await outletSettingsService.updateOutletSettings(parsedParams.data.outletId, parsed.data);
  res.json(settings);
});
