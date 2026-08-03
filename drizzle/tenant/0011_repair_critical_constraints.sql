-- 0011: repair critical constraints missing from 0000_consolidated.sql
-- PKs, FKs, unique idempotency_key, unique base-product rows, order_items.variant_id

--> statement-breakpoint
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id uuid;

--> statement-breakpoint
DELETE FROM public.order_items WHERE order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id);

--> statement-breakpoint
-- tenants from the pre-0011 era already have a PK on these tables; drop it (any name) before re-adding the canonical one.
-- CASCADE drops the legacy order_items→orders FK; 0011 re-creates it with ON DELETE CASCADE right below.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass::text AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'p'
      AND connamespace = 'public'::regnamespace
      AND conrelid::regclass::text IN ('orders', 'order_items', 'outlet_products')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I CASCADE', c.tbl, c.conname);
  END LOOP;
END $$;

--> statement-breakpoint
ALTER TABLE public.orders ADD CONSTRAINT orders_pk PRIMARY KEY (id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_pk PRIMARY KEY (id);
ALTER TABLE public.outlet_products ADD CONSTRAINT outlet_products_pk PRIMARY KEY (id);

--> statement-breakpoint
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

--> statement-breakpoint
-- dedupe orders by idempotency_key, keep the row with the smallest id (its order_items cascade along)
DELETE FROM public.orders o
USING public.orders o2
WHERE o.idempotency_key = o2.idempotency_key AND o.id > o2.id;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique ON public.orders (idempotency_key);

--> statement-breakpoint
-- dedupe base-product rows (variant_id IS NULL): merge stock into the kept row, drop the rest
WITH dupes AS (
    SELECT outlet_id, product_id,
           min(id::text)::uuid AS keep_id
    FROM public.outlet_products
    WHERE variant_id IS NULL
    GROUP BY outlet_id, product_id
    HAVING count(*) > 1
)
UPDATE public.outlet_products op
SET stock = (SELECT sum(op2.stock) FROM public.outlet_products op2
             WHERE op2.variant_id IS NULL AND op2.outlet_id = op.outlet_id AND op2.product_id = op.product_id)
FROM dupes
WHERE op.id = dupes.keep_id;

--> statement-breakpoint
DELETE FROM public.outlet_products op
USING public.outlet_products op2
WHERE op.variant_id IS NULL
  AND op2.variant_id IS NULL
  AND op.outlet_id = op2.outlet_id
  AND op.product_id = op2.product_id
  AND op.id > op2.id;

--> statement-breakpoint
-- Postgres unique indexes treat NULLs as distinct, so the existing outlet_products_unique
-- does not prevent duplicate base rows — add a partial index for that case.
CREATE UNIQUE INDEX IF NOT EXISTS outlet_products_unique_base ON public.outlet_products (outlet_id, product_id) WHERE variant_id IS NULL;

--> statement-breakpoint
-- one earn transaction per order (defense-in-depth behind the controller guard)
CREATE UNIQUE INDEX IF NOT EXISTS points_txn_earn_unique_order ON public.loyalty_points_transactions (order_id) WHERE type = 'earn' AND order_id IS NOT NULL;

--> statement-breakpoint
-- hot-path query indexes (audit #25)
CREATE INDEX IF NOT EXISTS orders_session_id_status_idx ON public.orders (session_id, status);
CREATE INDEX IF NOT EXISTS orders_outlet_created_idx ON public.orders (outlet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS cash_movements_session_created_idx ON public.cash_movements (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_outlet_created_idx ON public.stock_movements (outlet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS points_txn_member_program_idx ON public.loyalty_points_transactions (member_id, program_id, created_at DESC);
