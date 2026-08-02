CREATE TABLE IF NOT EXISTS "cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"cashier_id" uuid NOT NULL,
	"cashier_name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
