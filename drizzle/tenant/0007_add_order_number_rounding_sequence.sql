ALTER TABLE "orders" ADD COLUMN "order_number" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rounding_amount" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "order_sequence_reset_override" varchar(10);--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "order_sequence_reset" varchar(10) DEFAULT 'daily';