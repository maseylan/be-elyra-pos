ALTER TABLE "tenant_stats"
  ADD COLUMN IF NOT EXISTS "total_products" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_orders" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_customers" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_users" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_outlets" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "db_size_bytes" bigint NOT NULL DEFAULT 0;
