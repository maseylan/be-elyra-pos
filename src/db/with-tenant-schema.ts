import { sql } from 'drizzle-orm';
import { tenantDbPool as dbPool, tenantPool } from './poolManager';
import { getCurrentTenant } from '../contexts/tenant-context';
import { HttpError } from '../utils/errors';

const initializedTenantSchemas = new Set<string>();

async function ensureTenantSchema(schemaName: string) {
  if (initializedTenantSchemas.has(schemaName)) return;
  try {
    await tenantPool.query(`
      CREATE SCHEMA IF NOT EXISTS "${schemaName}";
      SET search_path TO "${schemaName}", public;
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

      ALTER TABLE cashier_sessions ADD COLUMN IF NOT EXISTS settings_snapshot jsonb;
    `);
    initializedTenantSchemas.add(schemaName);
  } catch (err) {
    console.error(`Auto-migration for tenant ${schemaName} failed:`, err);
    throw err;
  }
}


export async function withTenantSchema<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const { schemaName, status } = getCurrentTenant(); // throws kalau kosong

  if (status === 'expired') {
    throw new HttpError(402, 'Your subscription has ended. Please make payment to continue.');
  }

  // Sanitize schema name secara ketat
  if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error('Invalid schema name format');
  }

  await ensureTenantSchema(schemaName);

  return dbPool.transaction(async (tx) => {
    // Gunakan SET LOCAL agar berlaku hanya untuk transaksi ini (aman untuk connection pooling)
    await tx.execute(sql`SET LOCAL search_path TO ${sql.identifier(schemaName)}`);
    return fn(tx);
  });
}
