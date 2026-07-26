CREATE TYPE "stock_movement_type" AS ENUM('sale', 'restock', 'adjustment', 'waste', 'return', 'initial');--> statement-breakpoint
CREATE TYPE "tax_type" AS ENUM('inclusive', 'exclusive', 'none');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric NOT NULL,
	"subtotal" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"outlet_id" uuid NOT NULL,
	"total_amount" numeric NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "outlet_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"sell_price_override" numeric(12, 2),
	"low_stock_threshold" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"store_name_override" varchar(100),
	"store_address_override" text,
	"store_phone_override" varchar(30),
	"receipt_footer_override" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "outlet_settings_outlet_id_unique" UNIQUE("outlet_id")
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"address" text,
	"phone" varchar(30),
	"business_mode" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"price_adjustment" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stock" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(64) NOT NULL,
	"barcode" varchar(64),
	"name" varchar(255) NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sell_price" numeric(12, 2) NOT NULL,
	"tax_type" "tax_type" DEFAULT 'none' NOT NULL,
	"tax_rate" numeric(5, 2),
	"track_stock" boolean DEFAULT true NOT NULL,
	"unit" varchar(32) DEFAULT 'pcs' NOT NULL,
	"low_stock_threshold" integer,
	"allow_negative_stock" boolean DEFAULT false NOT NULL,
	"category_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantity_change" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"reference_id" uuid,
	"note" varchar(255),
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"store_name" varchar(100) NOT NULL,
	"store_address" text,
	"store_phone" varchar(30),
	"default_tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_type" "tax_type" DEFAULT 'none',
	"receipt_footer" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"password_hash" text,
	"pin_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_all_outlets" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_products" ADD CONSTRAINT "outlet_products_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_products" ADD CONSTRAINT "outlet_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD CONSTRAINT "outlet_settings_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_outlets" ADD CONSTRAINT "user_outlets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_outlets" ADD CONSTRAINT "user_outlets_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_products_unique" ON "outlet_products" USING btree ("outlet_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_unique" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "products_barcode_unique" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "user_outlets_unique" ON "user_outlets" USING btree ("user_id","outlet_id");