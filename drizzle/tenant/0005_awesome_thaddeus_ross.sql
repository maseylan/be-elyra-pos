ALTER TABLE "outlet_settings" ADD COLUMN "payment_methods_override" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "payment_methods" jsonb;