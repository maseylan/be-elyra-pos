import { sql } from 'drizzle-orm';
import { tenantDbPool as dbPool } from './poolManager';
import { getCurrentTenant } from '../contexts/tenant-context';
import { PaymentRequiredError } from '../utils/errors';

export async function withTenantSchema<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const { schemaName, status } = getCurrentTenant(); // throws kalau kosong

  if (status === 'expired') {
    throw new PaymentRequiredError('Your subscription has ended. Please make payment to continue.');
  }

  // Sanitize schema name secara ketat
  if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error('Invalid schema name format');
  }

  return dbPool.transaction(async (tx) => {
    // Gunakan SET LOCAL agar berlaku hanya untuk transaksi ini (aman untuk connection pooling)
    await tx.execute(sql`SET LOCAL search_path TO ${sql.identifier(schemaName)}`);
    return fn(tx);
  });
}
