import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as settingsService from '../services/settings.service';
import * as outletSettingsService from '../services/outlet-settings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

const printerPortSchema = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
  z.number().int().min(1).max(65535).nullable().optional()
);

const settingsSchema = z.object({
  storeName: z.string().min(1).max(100),
  storeAddress: z.string().optional().nullable(),
  storePhone: z.string().optional().nullable(),
  defaultTaxRate: z.coerce.string().optional().nullable(),
  taxType: z.enum(['inclusive', 'exclusive', 'none']).optional().nullable(),
  receiptFooter: z.string().optional().nullable(),
  printerHost: z.string().max(100).optional().nullable(),
  printerPort: printerPortSchema,
  printerName: z.string().max(200).optional().nullable(),
  printerNames: z.array(z.string()).optional().nullable(),
  printerRoles: z.record(z.string(), z.enum(['receipt', 'kitchen', 'bar'])).optional().nullable(),
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
  orderSequenceReset: z.string().optional().nullable(),
  promotionTaxMode: z.enum(['before_tax', 'after_tax']).optional().nullable(),
  multiTerminal: z.boolean().optional().nullable(),
  terminals: z.array(z.string()).optional().nullable(),
  paymentMethods: z.array(z.object({
    name: z.string(),
    feeType: z.enum(['none', 'fixed', 'percentage']),
    feeValue: z.number().optional().default(0),
    isDefault: z.boolean().optional().default(false),
  })).optional().nullable(),
}).refine(
  (data) => !(data.multiTerminal === true && (!data.terminals || data.terminals.length === 0)),
  {
    message: 'Wajib mendaftarkan minimal 1 terminal saat mengaktifkan Multi-Terminal POS.',
    path: ['terminals'],
  }
);

const outletSettingsSchema = z.object({
  storeNameOverride: z.string().optional().nullable(),
  storeAddressOverride: z.string().optional().nullable(),
  storePhoneOverride: z.string().optional().nullable(),
  receiptFooterOverride: z.string().optional().nullable(),
  printerHostOverride: z.string().max(100).optional().nullable(),
  printerPortOverride: printerPortSchema,
  printerNameOverride: z.string().max(200).optional().nullable(),
  printerNamesOverride: z.array(z.string()).optional().nullable(),
  printerRolesOverride: z.record(z.string(), z.enum(['receipt', 'kitchen', 'bar'])).optional().nullable(),
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
  multiTerminalOverride: z.boolean().optional().nullable(),
  terminalsOverride: z.array(z.string()).optional().nullable(),
  paymentMethodsOverride: z.array(z.object({
    name: z.string(),
    feeType: z.enum(['none', 'fixed', 'percentage']),
    feeValue: z.number().optional().default(0),
    isDefault: z.boolean().optional().default(false),
  })).optional().nullable(),
  activeFloorPlanIds: z.array(z.string().uuid()).optional().nullable(),
  enableSelfOrderOverride: z.boolean().optional().nullable(),
}).refine(
  (data) => !(data.multiTerminalOverride === true && (!data.terminalsOverride || data.terminalsOverride.length === 0)),
  {
    message: 'Wajib mendaftarkan minimal 1 terminal saat mengaktifkan Multi-Terminal POS.',
    path: ['terminalsOverride'],
  }
);

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
