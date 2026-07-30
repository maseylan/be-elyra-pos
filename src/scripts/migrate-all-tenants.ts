import { publicDb } from '../db/poolManager';
import { tenants } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { ensureTenantSchemaProvisioned } from '../utils/migrateTenant';

async function migrateAllTenants() {
  console.log('Starting migration for all provisioned tenants...');

  const allTenants = await publicDb.select({
    id: tenants.id,
    name: tenants.name,
    subdomain: tenants.subdomain,
    schemaVersion: tenants.schemaVersion,
    applicationStatus: tenants.applicationStatus,
  }).from(tenants)
    .where(eq(tenants.applicationStatus, 'provisioned'))
    .orderBy(desc(tenants.createdAt));

  console.log(`Found ${allTenants.length} provisioned tenants`);

  let success = 0;
  let failed = 0;

  for (const tenant of allTenants) {
    try {
      console.log(`Migrating tenant ${tenant.name} (${tenant.id})...`);
      await ensureTenantSchemaProvisioned(tenant.id);

      await publicDb.update(tenants)
        .set({ schemaVersion: (tenant.schemaVersion || 0) + 1 })
        .where(eq(tenants.id, tenant.id));

      console.log(`  ✓ ${tenant.name} (${tenant.subdomain})`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${tenant.name} (${tenant.subdomain}):`, err);
      failed++;
    }
  }

  console.log(`\nDone. ${success} succeeded, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

migrateAllTenants().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
