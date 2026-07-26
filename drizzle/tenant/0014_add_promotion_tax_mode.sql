ALTER TABLE "tenant_settings" ADD COLUMN "promotion_tax_mode" varchar(10) DEFAULT 'after_tax';--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "promotion_tax_mode_override" varchar(10);
