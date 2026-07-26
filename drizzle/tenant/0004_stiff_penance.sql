ALTER TABLE "outlet_settings" ADD COLUMN "timezone_override" varchar(50);--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "currency_override" varchar(10);--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "date_format_override" varchar(20);--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "time_format_override" varchar(10);--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "allow_selling_below_cost_override" boolean;--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "allow_negative_stock_override" boolean;--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "require_customer_override" boolean;--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "auto_generate_order_number_override" boolean;--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "order_numbering_format_override" varchar(50);--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "rounding_method_override" varchar(20);--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "decimal_precision_override" integer;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "code" varchar(20);--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "email" varchar(100);--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "timezone" varchar(50) DEFAULT 'Asia/Jakarta';--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "currency" varchar(10) DEFAULT 'IDR';--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "date_format" varchar(20) DEFAULT 'DD/MM/YYYY';--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "time_format" varchar(10) DEFAULT 'HH:mm';--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "allow_selling_below_cost" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "allow_negative_stock" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "require_customer" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "auto_generate_order_number" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "order_numbering_format" varchar(50) DEFAULT '{OUTLET}-{YYYYMMDD}-{SEQ}';--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "rounding_method" varchar(20) DEFAULT 'nearest_100';--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "decimal_precision" integer DEFAULT 0;--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_code_unique" ON "outlets" USING btree ("code");