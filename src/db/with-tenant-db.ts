import { drizzle } from 'drizzle-orm/node-postgres';
import { getCurrentTenant } from '../contexts/tenant-context';
import { tenantDbManager } from './tenant-connection';
import { HttpError } from '../utils/errors';

export async function withTenantDb<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const { tenantId, status } = getCurrentTenant();

  if (status === 'expired') {
    throw new HttpError(402, 'Your subscription has ended. Please make payment to continue.');
  }

  const pool = await tenantDbManager.getPool(tenantId);
  const db = drizzle(pool);

  return db.transaction(async (tx) => {
    return fn(tx);
  });
}
