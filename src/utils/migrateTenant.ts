import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';
import * as schema from '../db/tenant_schema';
import { publicDb, adminPool } from '../db/poolManager';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { encryptDbUrl, decryptDbUrl } from './dbUrlEncryption';
import { tenantDbManager } from '../db/tenant-connection';
import fs from 'fs';

async function getTenantDbUrl(tenantId: string): Promise<string> {
  const [tenant] = await publicDb.select({
    databaseUrl: tenants.databaseUrl,
  }).from(tenants).where(eq(tenants.id, tenantId));

  let urlStr = tenant?.databaseUrl ? decryptDbUrl(tenant.databaseUrl) : null;

  if (!urlStr) {
    const defaultUrl = process.env.TENANT_DEFAULT_DB_URL || process.env.DATABASE_URL;
    if (!defaultUrl) throw new Error('TENANT_DEFAULT_DB_URL or DATABASE_URL must be set');
    const baseUrl = new URL(defaultUrl);
    baseUrl.pathname = `/${tenantId}`;
    urlStr = baseUrl.toString();
  }

  const isDocker = fs.existsSync('/.dockerenv');
  if (isDocker) {
    if (urlStr.includes('@localhost:5433') || urlStr.includes('@127.0.0.1:5433')) {
      urlStr = urlStr.replace(/@(localhost|127\.0\.0\.1):5433/, '@postgres:5432');
    }
  } else {
    if (urlStr.includes('@postgres:5432')) {
      urlStr = urlStr.replace('@postgres:5432', '@localhost:5433');
    }
  }

  return urlStr;
}

async function ensureTenantDatabase(tenantId: string) {
  const [tenant] = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  if (tenant.databaseUrl) return;

  const defaultUrl = process.env.TENANT_DEFAULT_DB_URL || process.env.DATABASE_URL;
  if (!defaultUrl) throw new Error('TENANT_DEFAULT_DB_URL or DATABASE_URL must be set');
  const baseUrl = new URL(defaultUrl);
  const dbName = tenantId;

  const adminClient = await adminPool.connect();
  try {
    const exists = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
    );
    if (exists.rowCount === 0) {
      // CREATE DATABASE cannot run inside a transaction
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database ${dbName} for tenant ${tenantId}`);
    }
  } finally {
    adminClient.release();
  }
}

export const ensureTenantSchemaProvisioned = async (tenantId: string) => {
  await ensureTenantDatabase(tenantId);

  const tenantDbUrl = await getTenantDbUrl(tenantId);
  const migrationClient = new Client({ connectionString: tenantDbUrl });

  try {
    await migrationClient.connect();

    const migrationDb = drizzle(migrationClient);

    // Run all pending migrations
    await migrate(migrationDb, {
      migrationsFolder: path.join(__dirname, '../../drizzle/tenant'),
    });

    // ponytail: seed wrapped in try/catch — schema drift between tenant_schema.ts
    // and migration SQL causes SELECT queries to fail on missing columns.
    // Remove these wrappers once drizzle tenant migrations are regenerated.
    try {
      const existingUsers = await migrationDb.select().from(schema.users);
      if (existingUsers.length === 0) {
        const tenantData = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
        if (tenantData.length > 0) {
          const owner = tenantData[0];
          await migrationDb.insert(schema.users).values({
            role: 'owner',
            name: owner.ownerName,
            email: owner.email,
            passwordHash: owner.passwordHash,
            isActive: true,
            isAllOutlets: true,
          });
          console.log(`Seeded owner account for tenant ${tenantId}`);
        }
      }
    } catch (e) {
      console.warn(`Seed owner skipped for ${tenantId}:`, (e as Error).message);
    }

    // Store encrypted DB URL + mark provisioned
    const fullUrl = await getTenantDbUrl(tenantId);
    await publicDb.update(tenants)
      .set({ applicationStatus: 'provisioned', databaseUrl: encryptDbUrl(fullUrl), schemaVersion: 1 })
      .where(eq(tenants.id, tenantId));

    // Invalidate cached tenant pool so next request picks up new schema
    await tenantDbManager.invalidate(tenantId);

    console.log(`Database provisioned for tenant: ${tenantId}`);
  } catch (error) {
    console.error(`Migration error for tenant ${tenantId}:`, error);
    throw error;
  } finally {
    await migrationClient.end();
  }
};
