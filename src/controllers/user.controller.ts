import { Request, Response } from 'express';
import { z } from 'zod';
import * as userService from '../services/user.service';
import * as userOutletService from '../services/user-outlet.service';
import { listOutlets, getOutletById } from '../services/outlet.service';

export const getCashiers = async (req: Request, res: Response) => {
  try {
    const cashiers = await userService.getCashiers();
    res.json(cashiers);
  } catch (error: any) {
    console.error('Failed to fetch cashiers', error);
    res.status(500).json({ error: 'Failed to fetch cashiers' });
  }
};

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await userService.getAccounts();
    res.json(accounts);
  } catch (error: any) {
    console.error('Failed to fetch accounts', error);
    res.status(500).json({ error: 'Failed to fetch accounts', cause: error.cause?.message || String(error.cause) });
  }
};

const addAccountSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['admin', 'owner', 'cashier']),
  pin: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional()
});

export const addAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = addAccountSchema.parse(req.body);
    const result = await userService.addAccount(data);
    res.status(201).json({ message: 'Account added successfully', id: result.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validasi gagal', details: error.issues });
      return;
    }
    if (error.message === 'PIN_REQUIRED') {
      res.status(400).json({ error: 'PIN is required for cashiers' });
      return;
    }
    if (error.message === 'EMAIL_PASSWORD_REQUIRED') {
      res.status(400).json({ error: 'Email and Password are required for admins' });
      return;
    }
    if (error.message?.startsWith('PACKAGE_LIMIT_REACHED')) {
      const type = error.message.split(':')[1];
      const max = type === 'starter' ? 5 : 50;
      res.status(403).json({ error: `Package limit reached. ${type.toUpperCase()} package allows a maximum of ${max} registered accounts in total.` });
      return;
    }
    console.error('Failed to add account', error);
    res.status(500).json({ error: 'Failed to add account' });
  }
};

const paramsSchema = z.object({
  accountId: z.string().min(1)
});

export const removeAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = paramsSchema.parse(req.params);
    await userService.removeAccount(accountId);
    res.json({ message: 'Account removed successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validasi gagal', details: error.issues });
      return;
    }
    console.error('Failed to remove account', error);
    res.status(500).json({ error: 'Failed to remove account' });
  }
};

const assignOutletsSchema = z.object({
  outletIds: z.array(z.string().uuid()).min(1),
});

const idParamSchema = z.object({
  id: z.string().uuid()
});

export const assignUserOutlets = async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params); // { id: userId }
  const parsed = assignOutletsSchema.safeParse(req.body);
  if (!parsedParams.success || !parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  await userOutletService.assignUserToOutlets(parsedParams.data.id, parsed.data.outletIds);
  res.json({ success: true });
};

export const getMyOutlets = async (req: Request, res: Response) => {
  try {
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
    // If accessible is 'all', they can access all active outlets
    if (accessible === 'all') {
      const allOutlets = await listOutlets();
      return res.json(allOutlets);
    }
    
    // Otherwise fetch the specific outlets
    if (accessible.length === 0) {
      return res.json([]);
    }
    const outlets = [];
    for (const id of accessible) {
      try {
        const o = await getOutletById(id);
        if (o.isActive) outlets.push(o);
      } catch (e) {} // skip if not found or inactive
    }
    res.json(outlets);
  } catch (error) {
    console.error('Failed to fetch user outlets', error);
    res.status(500).json({ error: 'Failed to fetch user outlets' });
  }
};
