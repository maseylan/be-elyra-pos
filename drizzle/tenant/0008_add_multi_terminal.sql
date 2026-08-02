-- Migration 0008: Add multi_terminal and terminals settings + terminal_name in cashier_sessions

ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "multi_terminal" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "terminals" jsonb;

ALTER TABLE "outlet_settings"
  ADD COLUMN IF NOT EXISTS "multi_terminal_override" boolean,
  ADD COLUMN IF NOT EXISTS "terminals_override" jsonb;

ALTER TABLE "cashier_sessions"
  ADD COLUMN IF NOT EXISTS "terminal_name" varchar(50);
