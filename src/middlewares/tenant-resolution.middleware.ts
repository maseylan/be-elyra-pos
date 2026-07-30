import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis';
import { publicDb as dbPool } from '../db/poolManager';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { tenantContext, TenantContextData } from '../contexts/tenant-context';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'elyrapos.my.id';
const RESERVED_SUBDOMAINS = new Set(['api', 'www', 'localhost']);

async function markExpiredAndReturn(res: Response, tenantId: string, cacheKey: string) {
  await dbPool.update(tenants)
    .set({ applicationStatus: 'expired' })
    .where(eq(tenants.id, tenantId))
    .catch(e => console.warn('Failed to mark tenant expired:', e));
  await redisClient.del(cacheKey).catch(e => console.warn('Failed to invalidate cache:', e));
  res.status(402).json({ error: 'Your subscription has ended. Please make payment to continue.' });
}

export const tenantResolutionMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const host = (req.hostname || '').toLowerCase();

  if (host === ROOT_DOMAIN || !host.endsWith(`.${ROOT_DOMAIN}`)) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const subdomain = host.slice(0, -(ROOT_DOMAIN.length + 1));

  if (RESERVED_SUBDOMAINS.has(subdomain) || subdomain.includes('.')) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  let tenantData: TenantContextData | null = null;
  const cacheKey = `tenant:resolve:${subdomain}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      tenantData = JSON.parse(cached);
    }
  } catch (err) {
    console.warn('Redis cache lookup failed, falling back to DB:', err);
  }

  if (tenantData) {
    if (!tenantData.isActive) {
      res.status(403).json({ error: 'Tenant has been deactivated.' });
      return;
    }
    if (tenantData.status === 'expired') {
      res.status(402).json({ error: 'Your subscription has ended. Please make payment to continue.' });
      return;
    }
    tenantContext.run(tenantData, () => next());
    return;
  }

  try {
    const records = await dbPool.select({
      id: tenants.id,
      applicationStatus: tenants.applicationStatus,
      subscriptionType: tenants.subscriptionType,
      nextBillingCycle: tenants.nextBillingCycle,
      isActive: tenants.isActive,
    }).from(tenants).where(eq(tenants.subdomain, subdomain));

    if (records.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const record = records[0];

    if (!record.isActive) {
      res.status(403).json({ error: 'Tenant has been deactivated.' });
      return;
    }

    if (record.applicationStatus === 'expired') {
      res.status(402).json({ error: 'Your subscription has ended. Please make payment to continue.' });
      return;
    }

    if (record.applicationStatus === 'provisioned' && record.nextBillingCycle) {
      const now = new Date();
      const end = new Date(record.nextBillingCycle);
      if (now >= end) {
        await markExpiredAndReturn(res, record.id, cacheKey);
        return;
      }
    }

    tenantData = {
      tenantId: record.id,
      status: record.applicationStatus,
      subscriptionType: record.subscriptionType || 'starter',
      nextBillingCycle: record.nextBillingCycle?.toISOString(),
      isActive: record.isActive,
    };

    redisClient.setEx(cacheKey, 300, JSON.stringify(tenantData)).catch(e =>
      console.warn('Failed to set Redis cache:', e)
    );

    tenantContext.run(tenantData, () => next());
  } catch (dbErr) {
    console.error('Database resolution error:', dbErr);
    res.status(500).json({ error: 'Internal server error' });
  }
};
