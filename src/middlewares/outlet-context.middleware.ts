import { Request, Response, NextFunction } from 'express';
import { getAccessibleOutlets } from '../services/user-outlet.service';

export const resolveOutletContext = async (req: Request, res: Response, next: NextFunction) => {
  const outletId = req.header('X-Outlet-Id');

  if (!outletId) {
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

  next();
};
