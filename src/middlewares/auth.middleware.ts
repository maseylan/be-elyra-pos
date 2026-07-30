import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../services/token.service';
import { getCurrentTenant } from '../contexts/tenant-context';

export interface AuthUser {
  userId?: string;
  tenantId?: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  auth?: AccessTokenPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      auth?: AccessTokenPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.auth = decoded;
    req.user = {
      userId: decoded.userId || decoded.superAdminId,
      tenantId: decoded.tenantId,
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireOwner = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Requires owner privileges' });
  }
  next();
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

export const requireSuperadmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied: Superadmin only' });
  }
  next();
};

export const authorizeTenantAccess = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId: requestedTenantId } = getCurrentTenant();
    if (req.user?.tenantId !== requestedTenantId) {
      return res.status(403).json({ error: 'Forbidden: Cross-tenant access denied' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Server error during tenant authorization' });
  }
};

export const requireLoyaltyAccess = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subscriptionType } = getCurrentTenant();
    if (subscriptionType === 'starter') {
      return res.status(403).json({ error: 'Fitur Loyalty hanya tersedia untuk paket Pro dan Enterprise' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Server error checking subscription' });
  }
};
