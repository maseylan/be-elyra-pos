ALTER TABLE "order_items" ADD COLUMN "product_name" varchar(255);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_amount" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_paid" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "change_amount" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "table_number" varchar(10);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cashier_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cashier_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;