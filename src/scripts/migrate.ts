import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { publicDb } from '../db/poolManager';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as path from 'path';

async function runMigrations() {
  console.log('--- Starting Database Migrations ---');
  
  try {
    // 1. Migrate Public Schema (Tenant Registry, SuperAdmin)
    const drizzlePath = path.join(process.cwd(), 'drizzle');
    console.log('[Public Schema] Running migrations from', drizzlePath);
    await migrate(publicDb, { migrationsFolder: drizzlePath });
    console.log('[Public Schema] Migrations completed successfully.');

    // 2. Fetch all active tenants to migrate their schemas
    console.log('Fetching active tenants...');
    const activeTenants = await publicDb.select().from(tenants).where(eq(tenants.isActive, true));
    
    if (activeTenants.length === 0) {
      console.log('No active tenants found to migrate.');
    } else {
      console.log(`Found ${activeTenants.length} active tenants. Starting tenant migrations...`);
      
      // 3. Migrate each tenant's schema
      const { Pool } = require('pg');
      const { drizzle } = require('drizzle-orm/node-postgres');
      
      for (const tenant of activeTenants) {
        console.log(`[Tenant: ${tenant.id}] Running migrations for schema...`);
        
        const tenantMigrationPool = new Pool({
          connectionString: process.env.DATABASE_URL,
        });
        
        tenantMigrationPool.on('connect', (client: any) => {
          client.query(`SET search_path TO "${tenant.id}", public`);
        });
        
        const tenantDb = drizzle(tenantMigrationPool);
        
        try {
          // Make sure the schema exists
          await tenantMigrationPool.query(`CREATE SCHEMA IF NOT EXISTS "${tenant.id}"`);
          
          await migrate(tenantDb, { 
            migrationsFolder: path.join(process.cwd(), 'drizzle/tenant'),
            migrationsSchema: tenant.id
          });
          console.log(`[Tenant: ${tenant.id}] Migrations completed successfully.`);
        } catch (tenantError) {
          console.error(`[Tenant: ${tenant.id}] Migration failed:`, tenantError);
        } finally {
          await tenantMigrationPool.end();
        }
      }
    }
    
    console.log('--- Database Migrations Finished ---');
    process.exit(0);
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  }
}

runMigrations();
