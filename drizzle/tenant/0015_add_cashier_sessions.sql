CREATE TABLE IF NOT EXISTS cashier_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  cashier_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cashier_name varchar(100) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  opened_at timestamp NOT NULL DEFAULT now(),
  closed_at timestamp,
  starting_cash decimal(12,2) NOT NULL DEFAULT 0,
  ending_cash decimal(12,2),
  expected_cash decimal(12,2),
  cash_difference decimal(12,2),
  payment_breakdown jsonb DEFAULT '{}'::jsonb,
  total_refunds decimal(12,2) DEFAULT 0,
  total_orders_count integer DEFAULT 0,
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  force_closed_reason text,
  notes text,
  closing_notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES cashier_sessions(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session_per_cashier_outlet
ON cashier_sessions (outlet_id, cashier_id)
WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_cashier_sessions_outlet_status
ON cashier_sessions (outlet_id, status);
