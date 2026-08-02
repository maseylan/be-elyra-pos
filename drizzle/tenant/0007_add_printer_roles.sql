-- Migration: Add printer_roles column for printer roles (receipt, kitchen, bar)

ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "printer_roles" jsonb;

ALTER TABLE "outlet_settings"
  ADD COLUMN IF NOT EXISTS "printer_roles_override" jsonb;
