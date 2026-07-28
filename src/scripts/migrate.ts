import { publicDb } from '../db/poolManager';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';

async function runMigrations() {
  console.log('--- Starting Database Migrations for All Tenant Schemas ---');
  
  try {
    // Fetch all active tenants
    console.log('Fetching active tenants...');
    const activeTenants = await publicDb.select().from(tenants).where(eq(tenants.isActive, true));
    
    if (activeTenants.length === 0) {
      console.log('No active tenants found.');
    } else {
      console.log(`Found ${activeTenants.length} active tenants. Applying schema migrations...`);
      
      for (const tenant of activeTenants) {
        const rawId = tenant.id;
        const t = tenant as any;
        const schemaName = t.schemaName || (rawId.startsWith('tenant_') ? rawId : `tenant_${rawId.replace(/-/g, '_')}`);
        console.log(`[Tenant: ${tenant.id}] Target Schema Name: ${schemaName}`);
        
        const tenantPool = new Pool({
          connectionString: process.env.DATABASE_URL,
        });

        const client = await tenantPool.connect();
        
        try {
          await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
          await client.query(`SET search_path TO "${schemaName}", public`);

          await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants boolean DEFAULT false;

            CREATE TABLE IF NOT EXISTS product_variants (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
              name varchar(100) NOT NULL,
              price decimal(12,2) NOT NULL DEFAULT 0,
              sku varchar(64),
              is_default boolean NOT NULL DEFAULT false,
              is_active boolean NOT NULL DEFAULT true,
              created_at timestamp NOT NULL DEFAULT now()
            );

            ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS price decimal(12,2) NOT NULL DEFAULT 0;
            ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS sku varchar(64);
            ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
            ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

            ALTER TABLE outlet_products ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE;
            ALTER TABLE outlet_products DROP CONSTRAINT IF EXISTS outlet_products_unique;
            DROP INDEX IF EXISTS outlet_products_unique;
            CREATE UNIQUE INDEX IF NOT EXISTS outlet_products_unique ON outlet_products (outlet_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
            ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE;
            DROP TABLE IF EXISTS outlet_product_variants CASCADE;

            CREATE TABLE IF NOT EXISTS modifier_groups (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
              name varchar(100) NOT NULL,
              selection_type varchar(20) NOT NULL DEFAULT 'single',
              min_select integer NOT NULL DEFAULT 0,
              max_select integer,
              is_required boolean NOT NULL DEFAULT false,
              created_at timestamp NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS modifiers (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
              name varchar(100) NOT NULL,
              price_adjustment decimal(12,2) NOT NULL DEFAULT 0,
              is_active boolean NOT NULL DEFAULT true,
              created_at timestamp NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS outlet_modifiers (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
              modifier_id uuid NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
              price_adjustment decimal(12,2),
              is_available boolean NOT NULL DEFAULT true,
              updated_at timestamp NOT NULL DEFAULT now(),
              CONSTRAINT outlet_modifiers_unique UNIQUE (outlet_id, modifier_id)
            );

            CREATE TABLE IF NOT EXISTS add_ons (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              name varchar(100) NOT NULL,
              price decimal(12,2) NOT NULL DEFAULT 0,
              is_active boolean NOT NULL DEFAULT true,
              created_at timestamp NOT NULL DEFAULT now(),
              CONSTRAINT add_ons_name_unique UNIQUE (name)
            );

            CREATE TABLE IF NOT EXISTS product_add_ons (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
              add_on_id uuid NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
              created_at timestamp NOT NULL DEFAULT now(),
              CONSTRAINT product_add_ons_unique UNIQUE (product_id, add_on_id)
            );

            CREATE TABLE IF NOT EXISTS outlet_add_ons (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
              add_on_id uuid NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
              price decimal(12,2),
              stock integer,
              is_available boolean NOT NULL DEFAULT true,
              updated_at timestamp NOT NULL DEFAULT now(),
              CONSTRAINT outlet_add_ons_unique UNIQUE (outlet_id, add_on_id)
            );

            CREATE TABLE IF NOT EXISTS cashier_sessions (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
              cashier_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
              cashier_name varchar(100) NOT NULL,
              status varchar(20) NOT NULL DEFAULT 'OPEN',
              opened_at timestamp NOT NULL DEFAULT now(),
              closed_at timestamp,
              starting_cash decimal(12,2) NOT NULL DEFAULT 0,
              ending_cash decimal(12,2),
              expected_cash decimal(12,2),
              cash_difference decimal(12,2),
              payment_breakdown jsonb DEFAULT '{}'::jsonb,
              total_refunds decimal(12,2) DEFAULT 0,
              total_orders_count integer DEFAULT 0,
              closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
              force_closed_reason text,
              notes text,
              closing_notes text,
              created_at timestamp NOT NULL DEFAULT now(),
              updated_at timestamp NOT NULL DEFAULT now()
            );

            ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES cashier_sessions(id) ON DELETE RESTRICT;

            CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session_per_cashier_outlet
            ON cashier_sessions (outlet_id, cashier_id)
            WHERE status = 'OPEN';

            CREATE INDEX IF NOT EXISTS idx_cashier_sessions_outlet_status
            ON cashier_sessions (outlet_id, status);
          `);

          console.log(`[Tenant: ${tenant.id} (${schemaName})] Migration completed successfully.`);
        } catch (tenantError) {
          console.error(`[Tenant: ${tenant.id} (${schemaName})] Migration failed:`, tenantError);
        } finally {
          client.release();
          await tenantPool.end();
        }
      }
    }
    
    console.log('--- All Tenant Migrations Finished ---');
    process.exit(0);
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  }
}

runMigrations();
