import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getCurrentTenant } from '../contexts/tenant-context';

export const getCashiers = async () => {
  return await withTenantDb(async (tx) => {
    return tx.select({
      id: schema.users.id,
      name: schema.users.name,
    }).from(schema.users).where(eq(schema.users.role, 'cashier'));
  });
};

export const getAccounts = async () => {
  return await withTenantDb(async (tx) => {
    return tx.select({
      id: schema.users.id,
      name: schema.users.name,
      role: schema.users.role,
      isActive: schema.users.isActive,
    }).from(schema.users);
  });
};

export const addAccount = async (data: any) => {
  const { name, role, pin, email, password } = data;
  const { tenantId, subscriptionType = 'starter' } = getCurrentTenant();

  const userId = `usr_${Date.now()}`;
  let pinHash = null;
  let passwordHash = null;

  if (role === 'cashier') {
    if (!pin) throw new Error('PIN_REQUIRED');
    pinHash = await bcrypt.hash(pin, 10);
  } else if (role === 'admin' || role === 'owner') {
    if (!password || !email) throw new Error('EMAIL_PASSWORD_REQUIRED');
    passwordHash = await bcrypt.hash(password, 10);
  }

  await withTenantDb(async (tx) => {
    const hashString = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    };
    const lockId = hashString(tenantId);
    
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);
    
    if (subscriptionType === 'starter' || subscriptionType === 'pro') {
      const result = await tx.select({ count: sql<number>`cast(count(*) as integer)` }).from(schema.users);
      const userCount = result[0].count;
      const maxLimit = subscriptionType === 'starter' ? 5 : 50;
      
      if (userCount >= maxLimit) {
        throw new Error(`PACKAGE_LIMIT_REACHED:${subscriptionType}`);
      }
    }

    await tx.insert(schema.users).values({
      id: userId,
      name,
      role,
      email: email || null,
      passwordHash: passwordHash,
      pinHash: pinHash,
      isActive: true,
    });
  });

  return { id: userId };
};

export const removeAccount = async (accountId: string) => {
  await withTenantDb(async (tx) => {
    await tx.delete(schema.users).where(eq(schema.users.id, accountId));
  });
  return { success: true };
};
