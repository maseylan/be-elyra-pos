ALTER TABLE outlet_settings ADD COLUMN IF NOT EXISTS enable_self_order boolean DEFAULT false NOT NULL;
