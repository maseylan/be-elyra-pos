ALTER TABLE "outgoing_mails" ADD COLUMN "tenant_id" text;
ALTER TABLE "outgoing_mails" ADD COLUMN "tenant_name" text;
ALTER TABLE "outgoing_mails" ADD COLUMN "provider" text DEFAULT 'titan' NOT NULL;
ALTER TABLE "outgoing_mails" ADD COLUMN "email_type" text DEFAULT 'general' NOT NULL;
