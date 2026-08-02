-- Migration: Add printer_name column for QZ Tray support
-- printer_host/printer_port are kept for BE TCP Proxy (LAN printer)

ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "printer_name" varchar(200);

ALTER TABLE "outlet_settings"
  ADD COLUMN IF NOT EXISTS "printer_name_override" varchar(200);
