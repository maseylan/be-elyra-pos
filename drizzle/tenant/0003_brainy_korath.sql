CREATE TYPE "product_type" AS ENUM('STOCK', 'NON_STOCK', 'SERVICES');--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "track_stock" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "track_stock" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "allow_negative_stock" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "allow_negative_stock" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "type" "product_type" DEFAULT 'STOCK' NOT NULL;