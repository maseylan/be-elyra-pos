CREATE TABLE IF NOT EXISTS "superadmin_refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "super_admin_id" text NOT NULL REFERENCES "super_admins"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "superadmin_refresh_tokens_super_admin_id_unique" UNIQUE("super_admin_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_superadmin_refresh_tokens_token_hash" ON "superadmin_refresh_tokens" ("token_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owner_billing_refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "owner_billing_refresh_tokens_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_owner_billing_refresh_tokens_token_hash" ON "owner_billing_refresh_tokens" ("token_hash");
