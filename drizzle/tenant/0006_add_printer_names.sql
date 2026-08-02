-- Migration: Add printer_names column for one-to-many QZ Tray printers support

ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "printer_names" jsonb;

ALTER TABLE "outlet_settings"
  ADD COLUMN IF NOT EXISTS "printer_names_override" jsonb;
