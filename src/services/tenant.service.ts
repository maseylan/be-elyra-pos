import { publicDb, adminPool } from '../db/poolManager';
import { tenants, tenantStats } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { ensureTenantSchemaProvisioned } from '../utils/migrateTenant';
import redisClient, { clearRedisCache } from '../config/redis';
import { tenantDbManager } from '../db/tenant-connection';
import { Pool, Client } from 'pg';
import { decryptDbUrl } from '../utils/dbUrlEncryption';

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
    emailVerified: false,
    subscriptionType: 'starter',
    storageGb: '0.1',
  });

  return { id: tenantId, name, subdomain, email };
};

export const provisionTenant = async (tenantId: string, plan: string) => {
  const subscriptionStart = new Date();
  const nextBillingCycle = new Date();
  nextBillingCycle.setMonth(nextBillingCycle.getMonth() + 1);

  await publicDb.update(tenants)
    .set({
      subscriptionType: plan,
      subscriptionStart,
      nextBillingCycle,
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
    nextBillingCycle
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

  if (tenant.nextBillingCycle) {
    const now = new Date();
    const end = new Date(tenant.nextBillingCycle);
    if (now >= end) {
      await publicDb.update(tenants)
        .set({ applicationStatus: 'expired' })
        .where(eq(tenants.id, tenant.id));
      await redisClient.del(`tenant:resolve:${tenant.subdomain}`).catch(e => console.warn('[tenant.service] cache del failed:', e));
      throw new Error('TENANT_EXPIRED');
    }
  }

  return {
    id: tenant.id,
    name: tenant.name,
    subdomain: tenant.subdomain,
    subscriptionType: tenant.subscriptionType || 'starter',
    nextBillingCycle: tenant.nextBillingCycle?.toISOString(),
    schemaVersion: tenant.schemaVersion ?? 0,
    updatedAt: tenant.updatedAt,
    isActive: tenant.isActive,
  };
};

export const setupDatabase = async (tenantId: string) => {
  await ensureTenantSchemaProvisioned(tenantId);
  return { applicationStatus: 'provisioned' };
};

export const getAllTenants = async () => {
  const rows = await publicDb.select().from(tenants);
  return rows.map(t => ({
    ...t,
    passwordHash: undefined,
    databaseUrl: t.databaseUrl ? maskDbUrl(decryptDbUrl(t.databaseUrl)) : null,
    lastHealthCheckAt: t.lastHealthCheckAt?.toISOString() ?? null,
  }));
};

export const getTenantById = async (tenantId: string) => {
  const records = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (records.length === 0) {
    throw new Error('TENANT_NOT_FOUND');
  }
  const t = records[0];
  return {
    ...t,
    passwordHash: undefined,
    databaseUrl: t.databaseUrl ? maskDbUrl(decryptDbUrl(t.databaseUrl)) : null,
  };
};

export const toggleTenantStatus = async (tenantId: string, isActive: boolean) => {
  const records = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (records.length === 0) {
    throw new Error('TENANT_NOT_FOUND');
  }

  await publicDb.update(tenants)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  try {
    await redisClient.del(`tenant:resolve:${records[0].subdomain}`);
  } catch (e) {
    console.error('Failed to invalidate Redis cache', e);
  }

  return { id: tenantId, isActive };
};

function maskDbUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//****@${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return '(invalid URL)';
  }
}

export const getTenantDbInfo = async (tenantId: string) => {
  const [tenant] = await publicDb.select({
    databaseUrl: tenants.databaseUrl,
    schemaVersion: tenants.schemaVersion,
    connectionPoolSize: tenants.connectionPoolSize,
  }).from(tenants).where(eq(tenants.id, tenantId));

  if (!tenant) throw new Error('TENANT_NOT_FOUND');

  let connectionString: string;
  if (tenant.databaseUrl) {
    connectionString = decryptDbUrl(tenant.databaseUrl);
  } else {
    const defaultUrl = process.env.TENANT_DEFAULT_DB_URL || process.env.DATABASE_URL;
    if (!defaultUrl) throw new Error('No default DB URL configured');
    const baseUrl = new URL(defaultUrl);
    baseUrl.pathname = `/${tenantId}`;
    connectionString = baseUrl.toString();
  }

  let dbName = '';
  try { dbName = new URL(connectionString).pathname.replace(/^\//, ''); } catch {}

  return {
    maskedUrl: maskDbUrl(connectionString),
    dbName,
    schemaVersion: tenant.schemaVersion ?? 0,
    connectionPoolSize: tenant.connectionPoolSize ?? 1,
  };
};

export const checkTenantDbConnection = async (tenantId: string) => {
  const [tenant] = await publicDb.select({
    databaseUrl: tenants.databaseUrl,
  }).from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new Error('TENANT_NOT_FOUND');
  if (!tenant.databaseUrl) {
    await publicDb.update(tenants).set({ applicationStatus: 'pending' }).where(eq(tenants.id, tenantId));
    return { status: 'no_db' };
  }

  const connectionString = decryptDbUrl(tenant.databaseUrl);
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latency = Date.now() - start;
    await publicDb.update(tenants).set({ applicationStatus: 'provisioned' }).where(eq(tenants.id, tenantId));
    return { status: 'healthy', latency };
  } catch (err: any) {
    await publicDb.update(tenants).set({ applicationStatus: 'error' }).where(eq(tenants.id, tenantId));
    return { status: 'unhealthy', error: err.message };
  } finally {
    await pool.end().catch(e => console.warn('[tenant.service] pool.end failed:', e));
  }
};

async function withTenantDb<T>(tenantId: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const [tenant] = await publicDb.select({
    databaseUrl: tenants.databaseUrl,
  }).from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new Error('TENANT_NOT_FOUND');

  let connectionString: string;
  if (tenant.databaseUrl) {
    connectionString = decryptDbUrl(tenant.databaseUrl);
  } else {
    const defaultUrl = process.env.TENANT_DEFAULT_DB_URL || process.env.DATABASE_URL;
    if (!defaultUrl) throw new Error('No default DB URL configured');
    const baseUrl = new URL(defaultUrl);
    baseUrl.pathname = `/${tenantId}`;
    connectionString = baseUrl.toString();
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(e => console.warn('[tenant.service] client.end failed:', e));
  }
}

export const getTenantSystemInfo = async (tenantId: string) => {
  const [tenant] = await publicDb.select({
    id: tenants.id,
    databaseUrl: tenants.databaseUrl,
    schemaVersion: tenants.schemaVersion,
    connectionPoolSize: tenants.connectionPoolSize,
  }).from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new Error('TENANT_NOT_FOUND');

  let stats = { userCount: 0, productCount: 0, outletCount: 0, orderCount: 0, customerCount: 0 };
  let storageBytes = 0;
  let dbConnected = false;

  try {
    await withTenantDb(tenantId, async (client) => {
      const [userR, productR, outletR, orderR, customerR] = await Promise.all([
        client.query('SELECT COUNT(*)::int as c FROM users'),
        client.query('SELECT COUNT(*)::int as c FROM products'),
        client.query('SELECT COUNT(*)::int as c FROM outlets'),
        client.query('SELECT COUNT(*)::int as c FROM orders'),
        client.query('SELECT COUNT(*)::int as c FROM customers'),
      ]);
      stats = {
        userCount: userR.rows[0]?.c ?? 0,
        productCount: productR.rows[0]?.c ?? 0,
        outletCount: outletR.rows[0]?.c ?? 0,
        orderCount: orderR.rows[0]?.c ?? 0,
        customerCount: customerR.rows[0]?.c ?? 0,
      };

      const sizeR = await client.query("SELECT pg_database_size(current_database())::bigint as bytes");
      storageBytes = sizeR.rows[0]?.bytes ?? 0;
      dbConnected = true;
    });
  } catch (e) {
    dbConnected = false;
  }

  let redisOk = false;
  try {
    await redisClient.ping();
    redisOk = true;
  } catch {}

  const fmt = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  let apiRequestCount = 0;
  try {
    const redisCount = await redisClient.get(`platform:api_request_count:${tenantId}`);
    apiRequestCount = redisCount ? parseInt(redisCount, 10) : 0;
  } catch {}

  try {
    await publicDb.insert(tenantStats).values({
      tenantId,
      totalProducts: stats.productCount,
      totalOrders: stats.orderCount,
      totalCustomers: stats.customerCount,
      totalUsers: stats.userCount,
      totalOutlets: stats.outletCount,
      dbSizeBytes: storageBytes,
      apiRequestCount,
    }).onConflictDoUpdate({ target: tenantStats.tenantId, set: {
      totalProducts: stats.productCount,
      totalOrders: stats.orderCount,
      totalCustomers: stats.customerCount,
      totalUsers: stats.userCount,
      totalOutlets: stats.outletCount,
      dbSizeBytes: storageBytes,
      apiRequestCount,
    }});
  } catch {}

  let tenantStatsData = { apiRequestCount: 0, uploadedFilesCount: 0, fileStorageBytes: 0, lastBackupAt: null as string | null };
  try {
    const [row] = await publicDb.select({
      apiRequestCount: tenantStats.apiRequestCount,
      uploadedFilesCount: tenantStats.uploadedFilesCount,
      fileStorageBytes: tenantStats.fileStorageBytes,
      lastBackupAt: tenantStats.lastBackupAt,
    }).from(tenantStats).where(eq(tenantStats.tenantId, tenantId));
    if (row) {
      tenantStatsData = {
        apiRequestCount: row.apiRequestCount ?? 0,
        uploadedFilesCount: row.uploadedFilesCount ?? 0,
        fileStorageBytes: row.fileStorageBytes ?? 0,
        lastBackupAt: row.lastBackupAt ? row.lastBackupAt.toISOString() : null,
      };
    }
  } catch {}

  return {
    dbConnected,
    redisConnected: redisOk,
    storageBytes,
    storageFormatted: fmt(storageBytes),
    schemaVersion: tenant.schemaVersion ?? 0,
    connectionPoolSize: tenant.connectionPoolSize ?? 1,
    stats,
    tenantStats: tenantStatsData,
  };
};

export const platformHealthCheck = async () => {
  const allTenants = await publicDb.select({
    id: tenants.id,
    name: tenants.name,
    databaseUrl: tenants.databaseUrl,
  }).from(tenants);

  const results = await Promise.allSettled(
    allTenants.map(async t => {
      const health = await checkTenantDbConnection(t.id);
      return { tenantId: t.id, name: t.name, ...health };
    })
  );

  const checks = results.map(r =>
    r.status === 'fulfilled' ? r.value : { tenantId: 'unknown', name: 'unknown', status: 'error', error: r.reason?.message }
  );

  const healthy = checks.filter(c => c.status === 'healthy').length;
  const noDb = checks.filter(c => c.status === 'no_db').length;
  const unhealthy = checks.filter(c => c.status !== 'healthy' && c.status !== 'no_db').length;

  // persist results
  const now = new Date();
  for (const c of checks) {
    if (c.tenantId && c.tenantId !== 'unknown') {
      try {
        await publicDb.update(tenants)
          .set({ lastHealthCheckStatus: c.status, lastHealthCheckAt: now })
          .where(eq(tenants.id, c.tenantId));
      } catch { /* skip */ }
    }
  }

  return { total: checks.length, healthy, noDb, unhealthy, checks };
};

export const clearPlatformCache = async () => {
  await clearRedisCache();
  return { message: 'Platform cache cleared successfully' };
};

export const getPlatformStats = async () => {
  const allTenants = await publicDb.select({
    id: tenants.id,
    databaseUrl: tenants.databaseUrl,
  }).from(tenants).where(eq(tenants.isActive, true));

  let totalDbSize = 0;
  let totalProducts = 0;
  let totalOrders = 0;
  let totalCustomers = 0;
  let totalUsers = 0;
  let totalOutlets = 0;
  let failedTenants = 0;

  const results = await Promise.allSettled(
    allTenants.map((t, i) =>
      withTenantDb(t.id, async (client) => {
        const [sizeR, prodR, orderR, custR, userR, outletR] = await Promise.all([
          client.query("SELECT COALESCE(pg_database_size(current_database()), 0)::bigint as bytes"),
          client.query("SELECT COUNT(*)::int as c FROM products"),
          client.query("SELECT COUNT(*)::int as c FROM orders"),
          client.query("SELECT COUNT(*)::int as c FROM customers"),
          client.query("SELECT COUNT(*)::int as c FROM users"),
          client.query("SELECT COUNT(*)::int as c FROM outlets"),
        ]);
        return {
          dbSize: Number(sizeR.rows[0]?.bytes ?? 0),
          products: prodR.rows[0]?.c ?? 0,
          orders: orderR.rows[0]?.c ?? 0,
          customers: custR.rows[0]?.c ?? 0,
          users: userR.rows[0]?.c ?? 0,
          outlets: outletR.rows[0]?.c ?? 0,
        };
      }).then((s) => ({ tenantId: allTenants[i].id, ...s }))
    )
  );

  const upsertValues: { tenantId: string; totalProducts: number; totalOrders: number; totalCustomers: number; totalUsers: number; totalOutlets: number; dbSizeBytes: number }[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      const s = r.value;
      totalDbSize += s.dbSize;
      totalProducts += s.products;
      totalOrders += s.orders;
      totalCustomers += s.customers;
      totalUsers += s.users;
      totalOutlets += s.outlets;
      upsertValues.push({ tenantId: s.tenantId, totalProducts: s.products, totalOrders: s.orders, totalCustomers: s.customers, totalUsers: s.users, totalOutlets: s.outlets, dbSizeBytes: s.dbSize });
    } else {
      failedTenants++;
    }
  }

  for (const v of upsertValues) {
    let apiCount = 0;
    try {
      const r = await redisClient.get(`platform:api_request_count:${v.tenantId}`);
      apiCount = r ? parseInt(r, 10) : 0;
    } catch {}
    try {
      await publicDb.insert(tenantStats).values({ ...v, apiRequestCount: apiCount }).onConflictDoUpdate({
        target: tenantStats.tenantId,
        set: { ...v, apiRequestCount: apiCount },
      });
    } catch {}
  }

  let apiRequestCount = 0;
  let uploadedFilesCount = 0;
  let fileStorageBytes = 0;
  let lastBackupAt: string | null = null;

  try {
    const redisCount = await redisClient.get('platform:api_request_count');
    apiRequestCount = redisCount ? parseInt(redisCount, 10) : 0;
  } catch {}

  try {
    const statsRows = await publicDb.select({
      uploadedFilesCount: tenantStats.uploadedFilesCount,
      fileStorageBytes: tenantStats.fileStorageBytes,
      lastBackupAt: tenantStats.lastBackupAt,
    }).from(tenantStats);
    for (const row of statsRows) {
      uploadedFilesCount += row.uploadedFilesCount ?? 0;
      fileStorageBytes += row.fileStorageBytes ?? 0;
      if (row.lastBackupAt && (!lastBackupAt || row.lastBackupAt.toISOString() > lastBackupAt)) {
        lastBackupAt = row.lastBackupAt.toISOString();
      }
    }
  } catch {}

  const fmtBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  return {
    tenantCount: allTenants.length,
    failedTenants,
    totalDbSize,
    totalDbSizeFormatted: fmtBytes(totalDbSize),
    totalProducts,
    totalOrders,
    totalCustomers,
    totalUsers,
    totalOutlets,
    apiRequestCount,
    uploadedFilesCount,
    fileStorageBytes,
    fileStorageBytesFormatted: fmtBytes(fileStorageBytes),
    totalStorageBytes: totalDbSize + fileStorageBytes,
    totalStorageFormatted: fmtBytes(totalDbSize + fileStorageBytes),
    lastBackupAt,
  };
};

export const updateTenantPlan = async (tenantId: string, plan: string) => {
  const records = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (records.length === 0) {
    throw new Error('TENANT_NOT_FOUND');
  }

  const subscriptionStart = new Date();
  const nextBillingCycle = new Date();
  nextBillingCycle.setMonth(nextBillingCycle.getMonth() + 1);

  await publicDb.update(tenants)
    .set({
      subscriptionType: plan,
      subscriptionStart,
      nextBillingCycle,
      applicationStatus: 'provisioned',
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  try {
    await redisClient.del(`tenant:resolve:${records[0].subdomain}`);
  } catch (e) {
    console.error('Failed to invalidate Redis cache', e);
  }

  return { id: tenantId, plan, nextBillingCycle };
};

