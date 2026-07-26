CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "phone" varchar(30) NOT NULL,
  "email" varchar(100),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_unique" ON "customers" ("phone");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_programs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "description" text,
  "points_per_unit" integer DEFAULT 1 NOT NULL,
  "unit_amount" integer DEFAULT 1000 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outlet_loyalty_programs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "outlet_id" uuid NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
  "program_id" uuid NOT NULL REFERENCES "loyalty_programs"("id") ON DELETE CASCADE,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "outlet_loyalty_programs_unique" ON "outlet_loyalty_programs" ("outlet_id", "program_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL UNIQUE REFERENCES "customers"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_member_programs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "member_id" uuid NOT NULL REFERENCES "loyalty_members"("id") ON DELETE CASCADE,
  "program_id" uuid NOT NULL REFERENCES "loyalty_programs"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_member_programs_unique" ON "loyalty_member_programs" ("member_id", "program_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_rewards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" uuid NOT NULL REFERENCES "loyalty_programs"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "description" text,
  "type" varchar(30) NOT NULL,
  "points_cost" integer NOT NULL,
  "value" numeric(12, 2) NOT NULL,
  "max_discount" numeric(12, 2),
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "stock" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_reward_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reward_id" uuid NOT NULL REFERENCES "loyalty_rewards"("id") ON DELETE CASCADE,
  "member_id" uuid NOT NULL REFERENCES "loyalty_members"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "program_id" uuid NOT NULL,
  "points_cost" integer NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "claimed_at" timestamp,
  "cancelled_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_coupons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" uuid REFERENCES "loyalty_programs"("id") ON DELETE SET NULL,
  "code" varchar(50) NOT NULL UNIQUE,
  "type" varchar(30) NOT NULL,
  "value" numeric(12, 2) NOT NULL,
  "max_discount" numeric(12, 2),
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "min_purchase" numeric(12, 2),
  "usage_limit" integer,
  "used_count" integer DEFAULT 0 NOT NULL,
  "valid_from" timestamp,
  "valid_until" timestamp,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_single_use" boolean DEFAULT false NOT NULL,
  "member_id" uuid REFERENCES "loyalty_members"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_coupon_usages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "coupon_id" uuid NOT NULL REFERENCES "loyalty_coupons"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "member_id" uuid REFERENCES "loyalty_members"("id") ON DELETE SET NULL,
  "discount_amount" numeric(12, 2) NOT NULL,
  "used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "member_id" uuid REFERENCES "loyalty_members"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "coupon_id" uuid REFERENCES "loyalty_coupons"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "redeemed_reward_id" uuid REFERENCES "loyalty_rewards"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_points_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "member_id" uuid NOT NULL REFERENCES "loyalty_members"("id") ON DELETE CASCADE,
  "program_id" uuid NOT NULL REFERENCES "loyalty_programs"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "outlet_id" uuid NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
  "points" integer NOT NULL,
  "type" varchar(10) NOT NULL,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
