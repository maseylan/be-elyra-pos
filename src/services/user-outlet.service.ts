import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function assignUserToOutlets(userId: string, outletIds: string[]) {
  return withTenantDb(async (tx) => {
    const rows = outletIds.map((outletId) => ({ id: crypto.randomUUID(), userId, outletId }));
    return tx.insert(schema.userOutlets).values(rows).onConflictDoNothing();
  });
}

export async function getAccessibleOutlets(userId: string): Promise<string[] | 'all'> {
  return withTenantDb(async (tx) => {
    const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId));
    if (user?.isAllOutlets) return 'all';
    const rows = await tx.select().from(schema.userOutlets).where(eq(schema.userOutlets.userId, userId));
    return rows.map((r: any) => r.outletId);
  });
}
