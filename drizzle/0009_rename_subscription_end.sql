ALTER TABLE tenants RENAME COLUMN subscription_end TO next_billing_cycle;
ALTER TABLE tenants ALTER COLUMN storage_gb TYPE numeric(5,1);
ALTER TABLE tenants ALTER COLUMN storage_gb SET DEFAULT 0.1;
UPDATE tenants SET storage_gb = 0.1 WHERE storage_gb = 1;
