ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "printer_host" varchar(100);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "printer_port" integer;
ALTER TABLE "outlet_settings" ADD COLUMN IF NOT EXISTS "printer_host_override" varchar(100);
ALTER TABLE "outlet_settings" ADD COLUMN IF NOT EXISTS "printer_port_override" integer;