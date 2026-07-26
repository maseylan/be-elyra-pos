CREATE TABLE "promotion_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"promotion_type" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"max_discount" numeric(12, 2),
	"product_id" uuid,
	"min_purchase" numeric(12, 2),
	"valid_from" timestamp,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"buy_qty" integer,
	"get_qty" integer,
	"code" varchar(50),
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promotion_programs" ADD CONSTRAINT "promotion_programs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_programs" ADD CONSTRAINT "promotion_programs_code_unique" UNIQUE("code");--> statement-breakpoint
ALTER TABLE "promotion_outlets" ADD CONSTRAINT "promotion_outlets_promotion_id_promotion_programs_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "promotion_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_outlets" ADD CONSTRAINT "promotion_outlets_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_outlets_unique" ON "promotion_outlets" USING btree ("promotion_id","outlet_id");