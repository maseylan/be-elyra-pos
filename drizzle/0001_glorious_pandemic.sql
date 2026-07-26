DELETE FROM "tenants";--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "password_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "owner_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "whatsapp_number" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_type" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_start" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_end" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_email_unique" UNIQUE("email");