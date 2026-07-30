import { Request, Response } from 'express';
import { z } from 'zod';
import * as userService from '../services/user.service';
import * as userOutletService from '../services/user-outlet.service';
import { listOutlets, getOutletById } from '../services/outlet.service';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

export const getCashiers = asyncHandler(async (req, res) => {
  const cashiers = await userService.getCashiers();
  res.json(cashiers);
});

export const getAccounts = asyncHandler(async (req, res) => {
  const accounts = await userService.getAccounts();
  res.json(accounts);
});

const addAccountSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['admin', 'owner', 'cashier']),
  pin: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional()
});

export const addAccount = asyncHandler(async (req, res) => {
  try {
    const data = addAccountSchema.parse(req.body);
    const result = await userService.addAccount(data);
    res.status(201).json({ message: 'Account added successfully', id: result.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    if (error.message === 'PIN_REQUIRED') throw new HttpError(400, error.message);
    if (error.message === 'EMAIL_PASSWORD_REQUIRED') throw new HttpError(400, error.message);
    if (error.message?.startsWith('PACKAGE_LIMIT_REACHED')) throw new HttpError(403, error.message);
    throw error;
  }
});

const paramsSchema = z.object({
  accountId: z.string().min(1)
});

export const removeAccount = asyncHandler(async (req, res) => {
  const { accountId } = paramsSchema.parse(req.params);
  await userService.removeAccount(accountId);
  res.json({ message: 'Account removed successfully' });
});

const assignOutletsSchema = z.object({
  outletIds: z.array(z.string().uuid()).min(1),
});

const idParamSchema = z.object({
  id: z.string().uuid()
});

export const assignUserOutlets = asyncHandler(async (req, res) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  const parsed = assignOutletsSchema.safeParse(req.body);
  if (!parsedParams.success || !parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  await userOutletService.assignUserToOutlets(parsedParams.data.id, parsed.data.outletIds);
  res.json({ success: true });
});

export const getMyOutlets = asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (user?.role === 'owner' || user?.role === 'superadmin' || user?.role === 'admin') {
    const allOutlets = await listOutlets();
    return res.json(allOutlets);
  }

  const userId = user?.id || user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessible = await userOutletService.getAccessibleOutlets(userId);
  if (accessible === 'all') {
    const allOutlets = await listOutlets();
    return res.json(allOutlets);
  }

  if (accessible.length === 0) {
    return res.json([]);
  }
  const outlets = [];
  for (const id of accessible) {
    try {
      const o = await getOutletById(id);
      if (o.isActive) outlets.push(o);
    } catch (e) {}
  }
  res.json(outlets);
});
