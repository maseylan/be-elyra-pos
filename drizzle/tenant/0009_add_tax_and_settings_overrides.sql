ALTER TABLE "outlet_settings" ADD COLUMN "default_tax_rate_override" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "tax_type_override" varchar(10);
