CREATE TABLE "floor_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"width" integer DEFAULT 1200,
	"height" integer DEFAULT 800,
	"grid_size" integer DEFAULT 40,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_plan_id" uuid NOT NULL,
	"number" varchar(10) NOT NULL,
	"capacity" integer DEFAULT 4,
	"shape" varchar(20) DEFAULT 'circle',
	"pos_x" integer DEFAULT 0,
	"pos_y" integer DEFAULT 0,
	"width" integer DEFAULT 80,
	"height" integer DEFAULT 80,
	"status" varchar(20) DEFAULT 'Empty' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_floor_plan_id_floor_plans_id_fk" FOREIGN KEY ("floor_plan_id") REFERENCES "floor_plans"("id") ON DELETE cascade ON UPDATE no action;
