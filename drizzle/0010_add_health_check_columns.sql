ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_health_check_status text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_health_check_at timestamp;
