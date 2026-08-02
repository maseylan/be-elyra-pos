-- Migration: Add promotion_tax_mode columns for tenant_settings and outlet_settings
-- Existing tenants may not have this column if their database was provisioned
-- before promotion_tax_mode was added to the consolidated migration.

ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "promotion_tax_mode" varchar(10) DEFAULT 'after_tax';

ALTER TABLE "outlet_settings"
  ADD COLUMN IF NOT EXISTS "promotion_tax_mode_override" varchar(10);
