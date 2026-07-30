ALTER TABLE "superadmin_refresh_tokens" ADD COLUMN "previous_token_hash" text;
ALTER TABLE "owner_billing_refresh_tokens" ADD COLUMN "previous_token_hash" text;
CREATE INDEX IF NOT EXISTS "idx_superadmin_refresh_tokens_previous_hash" ON "superadmin_refresh_tokens" ("previous_token_hash");
CREATE INDEX IF NOT EXISTS "idx_owner_billing_refresh_tokens_previous_hash" ON "owner_billing_refresh_tokens" ("previous_token_hash");
