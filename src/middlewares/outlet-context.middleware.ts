import { Request, Response, NextFunction } from 'express';
import { getAccessibleOutlets } from '../services/user-outlet.service';
import { tenantContext } from '../contexts/tenant-context';

export const resolveOutletContext = async (req: Request, res: Response, next: NextFunction) => {
  const outletId = req.header('X-Outlet-Id');
  
  if (!outletId) {
    // If optional, we just pass through without outlet context
    return next();
  }

  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (user.role === 'owner' || user.role === 'superadmin' || user.role === 'admin') {
    (req as any).outletId = outletId;
  } else {
    const accessible = await getAccessibleOutlets(user.id || user.userId);
    
    if (accessible !== 'all' && !accessible.includes(outletId)) {
      return res.status(403).json({ error: 'No access to this outlet' });
    }

    (req as any).outletId = outletId;
  }
  
  // The tenantContext should already be running from tenantMiddleware.ts,
  // but if we need to modify the context, we should do it properly.
  // Wait, tenantMiddleware.ts already calls `tenantContext.run`.
  // If we want to add outletId to the existing context without breaking it, 
  // we might have to wrap `next()` again or just mutate the store if possible.
  // Since AsyncLocalStorage store is typically immutable for the current scope,
  // wrapping `next()` in a new run() that inherits the previous context is standard.
  const currentStore = tenantContext.getStore();
  if (currentStore) {
    tenantContext.run({ ...currentStore, outletId }, () => next());
  } else {
    next();
  }
};
