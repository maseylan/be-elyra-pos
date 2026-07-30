ALTER TABLE "refresh_tokens" ADD COLUMN "previous_token_hash" text;
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_previous_hash" ON "refresh_tokens" ("previous_token_hash");
