CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "refresh_tokens_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash");
