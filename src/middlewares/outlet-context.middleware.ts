import { Request, Response, NextFunction } from 'express';
import { getAccessibleOutlets } from '../services/user-outlet.service';

export const resolveOutletContext = async (req: Request, res: Response, next: NextFunction) => {
  const candidates = [req.header('X-Outlet-Id'), req.params.outletId, req.query.outletId, req.body?.outletId]
    .filter((value): value is string => typeof value === 'string' && value !== '' && value !== 'all');
  const outletId = candidates[0];

  if (!outletId) {
    return res.status(400).json({ error: 'Outlet context required' });
  }
  if (candidates.some((candidate) => candidate !== outletId)) {
    return res.status(400).json({ error: 'Conflicting outlet context' });
  }

  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (user.role === 'owner' || user.role === 'superadmin' || user.role === 'admin') {
    req.outletId = outletId;
  } else {
    const accessible = await getAccessibleOutlets(user.id || user.userId);

    if (accessible !== 'all' && !accessible.includes(outletId)) {
      return res.status(403).json({ error: 'No access to this outlet' });
    }

    req.outletId = outletId;
  }

  next();
};

export const resolveOptionalOutletContext = async (req: Request, res: Response, next: NextFunction) => {
  const candidates = [req.header('X-Outlet-Id'), req.params.outletId, req.query.outletId, req.body?.outletId]
    .filter((value): value is string => typeof value === 'string' && value !== '' && value !== 'all');
  const outletId = candidates[0];

  if (!outletId) {
    req.outletId = undefined;
    return next();
  }

  if (candidates.some((candidate) => candidate !== outletId)) {
    return res.status(400).json({ error: 'Conflicting outlet context' });
  }

  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (user.role === 'owner' || user.role === 'superadmin' || user.role === 'admin') {
    req.outletId = outletId;
  } else {
    const accessible = await getAccessibleOutlets(user.id || user.userId);

    if (accessible !== 'all' && !accessible.includes(outletId)) {
      return res.status(403).json({ error: 'No access to this outlet' });
    }

    req.outletId = outletId;
  }

  next();
};

