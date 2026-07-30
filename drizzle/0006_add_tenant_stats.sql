CREATE TABLE IF NOT EXISTS "tenant_stats" (
  "tenant_id" text PRIMARY KEY REFERENCES "tenants"("id") ON DELETE CASCADE,
  "api_request_count" bigint NOT NULL DEFAULT 0,
  "last_backup_at" timestamp with time zone,
  "uploaded_files_count" integer NOT NULL DEFAULT 0,
  "file_storage_bytes" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Initialize tenant_stats for all existing tenants
INSERT INTO "tenant_stats" ("tenant_id")
SELECT "id" FROM "tenants"
ON CONFLICT ("tenant_id") DO NOTHING;
