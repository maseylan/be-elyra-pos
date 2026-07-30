import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis';
import { getCurrentTenant } from '../contexts/tenant-context';

export async function trackApiRequest(req: Request, _res: Response, next: NextFunction) {
  try {
    await redisClient.incr('platform:api_request_count');
  } catch (e) { console.warn('[apiTracker] Redis incr failed:', e); }
  next();
}

export async function trackPerTenantRequest(req: Request, _res: Response, next: NextFunction) {
  try {
    const tenant = getCurrentTenant();
    if (tenant?.tenantId) {
      await redisClient.incr(`platform:api_request_count:${tenant.tenantId}`);
    }
  } catch (e) { console.warn('[apiTracker] Redis tenent incr failed:', e); }
  next();
}
