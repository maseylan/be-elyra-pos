import { publicDb } from '../db/poolManager';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { ensureTenantSchemaProvisioned } from '../utils/migrateTenant';
import redisClient from '../config/redis';

export const registerTenant = async (data: any) => {
  const { name, subdomain, email, password, ownerName, whatsappNumber } = data;

  const existing = await publicDb.select().from(tenants).where(eq(tenants.subdomain, subdomain));
  if (existing.length > 0) {
    throw new Error('SUBDOMAIN_TAKEN');
  }

  const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const passwordHash = await bcrypt.hash(password, 10);

  await publicDb.insert(tenants).values({
    id: tenantId,
    name,
    subdomain,
    email,
    passwordHash,
    ownerName,
    whatsappNumber,
    isActive: true,
  });

  return { id: tenantId, name, subdomain };
};

export const provisionTenant = async (tenantId: string, plan: string) => {
  const subscriptionStart = new Date();
  const subscriptionEnd = new Date();
  subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

  await publicDb.update(tenants)
    .set({
      subscriptionType: plan,
      subscriptionStart,
      subscriptionEnd,
      applicationStatus: 'provisioned',
    })
    .where(eq(tenants.id, tenantId));

  try {
    const tenantRecord = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
    if (tenantRecord.length > 0) {
      await redisClient.del(`tenant:resolve:${tenantRecord[0].subdomain}`);
    }
  } catch (e) {
    console.error('Failed to invalidate Redis cache during provisioning', e);
  }

  return {
    tenantId,
    plan,
    subscriptionEnd
  };
};

export const resolveTenant = async (subdomain: string) => {
  const tenantRecords = await publicDb.select().from(tenants).where(eq(tenants.subdomain, subdomain));

  if (tenantRecords.length === 0) {
    throw new Error('TENANT_NOT_FOUND');
  }

  const tenant = tenantRecords[0];

  if (!tenant.isActive) {
    throw new Error('TENANT_DEACTIVATED');
  }

  if (tenant.applicationStatus === 'expired') {
    throw new Error('TENANT_EXPIRED');
  }

  if (tenant.applicationStatus !== 'provisioned') {
    throw new Error('TENANT_NOT_PROVISIONED');
  }

  if (tenant.subscriptionEnd) {
    const now = new Date();
    const end = new Date(tenant.subscriptionEnd);
    if (now >= end) {
      await publicDb.update(tenants)
        .set({ applicationStatus: 'expired' })
        .where(eq(tenants.id, tenant.id));
      await redisClient.del(`tenant:resolve:${tenant.subdomain}`).catch(() => {});
      throw new Error('TENANT_EXPIRED');
    }
  }

  return {
    id: tenant.id,
    name: tenant.name,
    subdomain: tenant.subdomain,
    subscriptionType: tenant.subscriptionType || 'starter',
    subscriptionEnd: tenant.subscriptionEnd?.toISOString(),
  };
};

export const setupDatabase = async (tenantId: string) => {
  await ensureTenantSchemaProvisioned(tenantId);
  return { applicationStatus: 'provisioned' };
};

export const getAllTenants = async () => {
  return await publicDb.select().from(tenants);
};
