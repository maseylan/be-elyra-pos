CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"email" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_coupon_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"member_id" uuid,
	"discount_amount" numeric(12, 2) NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid,
	"code" varchar(50) NOT NULL,
	"type" varchar(30) NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"max_discount" numeric(12, 2),
	"product_id" uuid,
	"min_purchase" numeric(12, 2),
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_single_use" boolean DEFAULT false NOT NULL,
	"member_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "loyalty_member_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_members_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "loyalty_points_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"order_id" uuid,
	"outlet_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"type" varchar(10) NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"points_per_unit" integer DEFAULT 1 NOT NULL,
	"unit_amount" integer DEFAULT 1000 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_reward_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reward_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"order_id" uuid,
	"program_id" uuid NOT NULL,
	"points_cost" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"claimed_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"type" varchar(30) NOT NULL,
	"points_cost" integer NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"max_discount" numeric(12, 2),
	"product_id" uuid,
	"stock" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_loyalty_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "redeemed_reward_id" uuid;--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "default_tax_rate_override" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "tax_type_override" varchar(10);--> statement-breakpoint
ALTER TABLE "outlet_settings" ADD COLUMN "active_floor_plan_ids" jsonb;--> statement-breakpoint
ALTER TABLE "loyalty_coupon_usages" ADD CONSTRAINT "loyalty_coupon_usages_coupon_id_loyalty_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."loyalty_coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_coupon_usages" ADD CONSTRAINT "loyalty_coupon_usages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_coupon_usages" ADD CONSTRAINT "loyalty_coupon_usages_member_id_loyalty_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."loyalty_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_coupons" ADD CONSTRAINT "loyalty_coupons_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_coupons" ADD CONSTRAINT "loyalty_coupons_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_coupons" ADD CONSTRAINT "loyalty_coupons_member_id_loyalty_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."loyalty_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_member_programs" ADD CONSTRAINT "loyalty_member_programs_member_id_loyalty_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."loyalty_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_member_programs" ADD CONSTRAINT "loyalty_member_programs_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_members" ADD CONSTRAINT "loyalty_members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_points_transactions" ADD CONSTRAINT "loyalty_points_transactions_member_id_loyalty_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."loyalty_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_points_transactions" ADD CONSTRAINT "loyalty_points_transactions_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_points_transactions" ADD CONSTRAINT "loyalty_points_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_points_transactions" ADD CONSTRAINT "loyalty_points_transactions_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_reward_id_loyalty_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_member_id_loyalty_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."loyalty_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward_redemptions" ADD CONSTRAINT "loyalty_reward_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_loyalty_programs" ADD CONSTRAINT "outlet_loyalty_programs_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_loyalty_programs" ADD CONSTRAINT "outlet_loyalty_programs_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_unique" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_member_programs_unique" ON "loyalty_member_programs" USING btree ("member_id","program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlet_loyalty_programs_unique" ON "outlet_loyalty_programs" USING btree ("outlet_id","program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_user_id_unique" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_member_id_loyalty_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."loyalty_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_loyalty_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."loyalty_coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_redeemed_reward_id_loyalty_rewards_id_fk" FOREIGN KEY ("redeemed_reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE set null ON UPDATE no action;