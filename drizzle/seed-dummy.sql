-- Seed dummy data for tenant_1785251589717_u8m8r
-- Run: docker exec -i pos_postgres psql -U root -d tenant_1785251589717_u8m8r < drizzle/seed-dummy.sql

-- Clean existing data (CASCADE handles FK order automatically)
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '__drizzle_migrations')
  LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;

-- 1. Users
WITH u AS (
  INSERT INTO users (id, role, name, email, password_hash, is_active, is_all_outlets)
  VALUES
    ('a0000001-0000-0000-0000-000000000001', 'owner', 'Budi Santoso', 'budi@warung.id', '$2b$10$XlrlRnGigJIumRE.bpDrneRF0MdWjLQzObxI9r6E6udvevC48VuS.', true, true),
    ('a0000001-0000-0000-0000-000000000002', 'admin', 'Siti Rahmawati', 'siti@warung.id', '$2b$10$XlrlRnGigJIumRE.bpDrneRF0MdWjLQzObxI9r6E6udvevC48VuS.', true, true),
    ('a0000001-0000-0000-0000-000000000003', 'cashier', 'Ahmad Fauzi', null, '$2b$10$XlrlRnGigJIumRE.bpDrneRF0MdWjLQzObxI9r6E6udvevC48VuS.', true, false),
    ('a0000001-0000-0000-0000-000000000004', 'cashier', 'Dewi Lestari', null, '$2b$10$XlrlRnGigJIumRE.bpDrneRF0MdWjLQzObxI9r6E6udvevC48VuS.', true, false),
    ('a0000001-0000-0000-0000-000000000005', 'supervisor', 'Rudi Hartono', null, '$2b$10$XlrlRnGigJIumRE.bpDrneRF0MdWjLQzObxI9r6E6udvevC48VuS.', true, false)
  RETURNING id
)
SELECT count(*) AS users_created FROM u;

-- 2. Outlets
WITH o AS (
  INSERT INTO outlets (id, name, code, business_mode, is_active, address, phone)
  VALUES
    ('b0000001-0000-0000-0000-000000000001', 'Outlet Pusat', 'PST', 'retail', true, 'Jl. Merdeka No. 1, Jakarta', '021-12345678'),
    ('b0000001-0000-0000-0000-000000000002', 'Outlet Cabang', 'CBG', 'fnb', true, 'Jl. Sudirman No. 10, Bandung', '022-87654321'),
    ('b0000001-0000-0000-0000-000000000003', 'Outlet Ekspres', 'EXP', 'retail', false, 'Jl. Gatot Subroto No. 5, Surabaya', '031-55555555')
  RETURNING id
)
SELECT count(*) AS outlets_created FROM o;

-- 3. User-Outlet assignments
INSERT INTO user_outlets (user_id, outlet_id)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000002'),
  ('a0000001-0000-0000-0000-000000000005', 'b0000001-0000-0000-0000-000000000001');

-- 4. Tenant settings
INSERT INTO tenant_settings (id, store_name, store_address, store_phone, default_tax_rate, tax_type, timezone, currency, auto_generate_order_number)
VALUES ('default', 'Warung Sejahtera', 'Jl. Merdeka No. 1, Jakarta', '021-12345678', '11.00', 'inclusive', 'Asia/Jakarta', 'IDR', true);

-- 5. Outlet settings
INSERT INTO outlet_settings (outlet_id, store_name_override)
VALUES
  ('b0000001-0000-0000-0000-000000000001', 'Pusat - Warung Sejahtera'),
  ('b0000001-0000-0000-0000-000000000002', 'Cabang - Warung Sejahtera');

-- 6. Categories
INSERT INTO categories (id, name, description, is_active)
VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Makanan', 'Makanan ringan & berat', true),
  ('c0000001-0000-0000-0000-000000000002', 'Minuman', 'Minuman panas & dingin', true),
  ('c0000001-0000-0000-0000-000000000003', 'Snack', 'Cemilan & kudapan', true);

-- 7. Products
INSERT INTO products (id, sku, barcode, name, cost_price, sell_price, tax_type, track_stock, unit, category_id, type, is_global, has_variants, is_active)
VALUES
  ('d0000001-0000-0000-0000-000000000001', 'SKU-001', '8991001001001', 'Nasi Goreng Spesial', '15000', '25000', 'inclusive', true, 'porsi', 'c0000001-0000-0000-0000-000000000001', 'STOCK', true, false, true),
  ('d0000001-0000-0000-0000-000000000002', 'SKU-002', '8991001001002', 'Ayam Bakar Madu', '20000', '35000', 'inclusive', true, 'porsi', 'c0000001-0000-0000-0000-000000000001', 'STOCK', true, false, true),
  ('d0000001-0000-0000-0000-000000000003', 'SKU-003', '8991001001003', 'Es Teh Manis', '2000', '5000', 'inclusive', true, 'gelas', 'c0000001-0000-0000-0000-000000000002', 'STOCK', true, false, true),
  ('d0000001-0000-0000-0000-000000000004', 'SKU-004', '8991001001004', 'Kopi Susu Gula Aren', '8000', '18000', 'exclusive', true, 'cangkir', 'c0000001-0000-0000-0000-000000000002', 'STOCK', true, false, true),
  ('d0000001-0000-0000-0000-000000000005', 'SKU-005', '8991001001005', 'Mie Goreng Seafood', '18000', '28000', 'inclusive', true, 'porsi', 'c0000001-0000-0000-0000-000000000001', 'STOCK', true, false, true),
  ('d0000001-0000-0000-0000-000000000006', 'SKU-006', '8991001001006', 'Kentang Goreng', '8000', '15000', 'inclusive', true, 'porsi', 'c0000001-0000-0000-0000-000000000003', 'STOCK', true, false, true),
  ('d0000001-0000-0000-0000-000000000007', 'SKU-007', '8991001001007', 'Jus Alpukat', '5000', '12000', 'exclusive', true, 'gelas', 'c0000001-0000-0000-0000-000000000002', 'STOCK', true, true, true);

-- 8. Product Variants (for SKU-007 Jus Alpukat)
INSERT INTO product_variants (id, product_id, name, price, sku, is_default, is_active)
VALUES
  ('e0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000007', 'Regular', '12000', 'SKU-007-R', true, true),
  ('e0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000007', 'Large', '15000', 'SKU-007-L', false, true),
  ('e0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000007', 'Extra Topping', '18000', 'SKU-007-X', false, true);

-- 9. Outlet-Products (stock per outlet)
INSERT INTO outlet_products (outlet_id, product_id, variant_id, stock, sell_price_override, is_available)
VALUES
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', null, 50, null, true),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000002', null, 30, null, true),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000003', null, 100, null, true),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000004', null, 40, null, true),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000005', null, 25, null, true),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000006', null, 80, null, true),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000007', null, 35, null, true),
  ('b0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001', null, 20, '27000', true),
  ('b0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000003', null, 50, '6000', true),
  ('b0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000004', null, 15, null, true);

-- 10. Stock movements (initial stock)
INSERT INTO stock_movements (outlet_id, product_id, variant_id, type, quantity_change, stock_after, note)
VALUES
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', null, 'initial', 50, 50, 'Stock awal'),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000002', null, 'initial', 30, 30, 'Stock awal'),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000003', null, 'initial', 100, 100, 'Stock awal'),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000004', null, 'initial', 40, 40, 'Stock awal'),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000005', null, 'initial', 25, 25, 'Stock awal'),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000006', null, 'initial', 80, 80, 'Stock awal'),
  ('b0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000007', null, 'initial', 35, 35, 'Stock awal');

-- 11. Modifier Groups
INSERT INTO modifier_groups (id, product_id, name, selection_type, min_select, max_select, is_required)
VALUES
  ('f0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'Level Pedas', 'single', 1, 1, true),
  ('f0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001', 'Topping Tambahan', 'multiple', 0, 3, false),
  ('f0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000004', 'Ukuran', 'single', 1, 1, true);

-- 12. Modifiers
INSERT INTO modifiers (id, group_id, name, price_adjustment, is_active)
VALUES
  ('f0000002-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 'Tidak Pedas', '0', true),
  ('f0000002-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000001', 'Pedas Sedang', '0', true),
  ('f0000002-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000001', 'Pedas Banget', '0', true),
  ('f0000002-0000-0000-0000-000000000004', 'f0000001-0000-0000-0000-000000000002', 'Telur', '5000', true),
  ('f0000002-0000-0000-0000-000000000005', 'f0000001-0000-0000-0000-000000000002', 'Keju', '7000', true),
  ('f0000002-0000-0000-0000-000000000006', 'f0000001-0000-0000-0000-000000000002', 'Ayam Suwir', '10000', true),
  ('f0000002-0000-0000-0000-000000000007', 'f0000001-0000-0000-0000-000000000003', 'Small', '0', true),
  ('f0000002-0000-0000-0000-000000000008', 'f0000001-0000-0000-0000-000000000003', 'Medium', '0', true),
  ('f0000002-0000-0000-0000-000000000009', 'f0000001-0000-0000-0000-000000000003', 'Large', '3000', true);

-- 13. Outlet-Modifier overrides
INSERT INTO outlet_modifiers (outlet_id, modifier_id, is_available)
VALUES
  ('b0000001-0000-0000-0000-000000000001', 'f0000002-0000-0000-0000-000000000001', true),
  ('b0000001-0000-0000-0000-000000000001', 'f0000002-0000-0000-0000-000000000002', true),
  ('b0000001-0000-0000-0000-000000000001', 'f0000002-0000-0000-0000-000000000003', true),
  ('b0000001-0000-0000-0000-000000000001', 'f0000002-0000-0000-0000-000000000004', true),
  ('b0000001-0000-0000-0000-000000000002', 'f0000002-0000-0000-0000-000000000001', true),
  ('b0000001-0000-0000-0000-000000000002', 'f0000002-0000-0000-0000-000000000002', true);

-- 14. Add-ons (global)
INSERT INTO add_ons (id, name, price, is_active)
VALUES
  ('10000001-0000-0000-0000-000000000001', 'Es Batu', '1000', true),
  ('10000001-0000-0000-0000-000000000002', 'Susu Kental Manis', '2000', true),
  ('10000001-0000-0000-0000-000000000003', 'Extra Sirup', '3000', true);

-- 15. Product-AddOn mapping
INSERT INTO product_add_ons (product_id, add_on_id)
VALUES
  ('d0000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000001'),
  ('d0000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000002'),
  ('d0000001-0000-0000-0000-000000000004', '10000001-0000-0000-0000-000000000002');

-- 16. Outlet-AddOn overrides
INSERT INTO outlet_add_ons (outlet_id, add_on_id, price, is_available)
VALUES
  ('b0000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000001', null, true),
  ('b0000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000002', null, true),
  ('b0000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000001', '1500', true);

-- 17. Customers
INSERT INTO customers (id, name, phone, email)
VALUES
  ('20000001-0000-0000-0000-000000000001', 'Andi Pratama', '081234567890', 'andi@email.com'),
  ('20000001-0000-0000-0000-000000000002', 'Bunga Citra', '081298765432', null),
  ('20000001-0000-0000-0000-000000000003', 'Cahyo Nugroho', '087812345678', 'cahyo@email.com'),
  ('20000001-0000-0000-0000-000000000004', 'Dian Permata', '085611223344', 'dian@email.com'),
  ('20000001-0000-0000-0000-000000000005', 'Eko Prasetyo', '082155556666', null);

-- 18. Loyalty Programs
INSERT INTO loyalty_programs (id, name, description, points_per_unit, unit_amount, is_active)
VALUES
  ('30000001-0000-0000-0000-000000000001', 'Poin Belanja', 'Dapatkan poin dari setiap transaksi', 1, 1000, true),
  ('30000001-0000-0000-0000-000000000002', 'Member VIP', 'Program loyalitas untuk member VIP', 2, 1000, true);

-- 19. Outlet-LoyaltyProgram
INSERT INTO outlet_loyalty_programs (outlet_id, program_id, is_active)
VALUES
  ('b0000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001', true),
  ('b0000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000002', true),
  ('b0000001-0000-0000-0000-000000000002', '30000001-0000-0000-0000-000000000001', true);

-- 20. Loyalty Members
INSERT INTO loyalty_members (id, customer_id)
VALUES
  ('40000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000001'),
  ('40000001-0000-0000-0000-000000000002', '20000001-0000-0000-0000-000000000003'),
  ('40000001-0000-0000-0000-000000000003', '20000001-0000-0000-0000-000000000004'),
  ('40000001-0000-0000-0000-000000000004', '20000001-0000-0000-0000-000000000005');

-- 21. Member-Program enrollment
INSERT INTO loyalty_member_programs (member_id, program_id)
VALUES
  ('40000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001'),
  ('40000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000002'),
  ('40000001-0000-0000-0000-000000000002', '30000001-0000-0000-0000-000000000001');

-- 22. Loyalty Rewards
INSERT INTO loyalty_rewards (id, program_id, name, type, points_cost, value, stock, is_active)
VALUES
  ('50000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001', 'Voucher Rp 10.000', 'voucher', 100, '10000', null, true),
  ('50000001-0000-0000-0000-000000000002', '30000001-0000-0000-0000-000000000001', 'Nasi Goreng Gratis', 'product', 200, '25000', 10, true),
  ('50000001-0000-0000-0000-000000000003', '30000001-0000-0000-0000-000000000002', 'Diskon 20%', 'discount', 150, '20.00', null, true);

-- 23. Floor Plans
INSERT INTO floor_plans (id, outlet_id, name, width, height, is_active)
VALUES
  ('60000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'Lantai 1', 1200, 800, true),
  ('60000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000002', 'Ruangan Utama', 1000, 700, true);

-- 24. Tables
INSERT INTO tables (id, floor_plan_id, number, capacity, shape, pos_x, pos_y, status)
VALUES
  ('70000001-0000-0000-0000-000000000001', '60000001-0000-0000-0000-000000000001', 'T1', 4, 'circle', 100, 100, 'Empty'),
  ('70000001-0000-0000-0000-000000000002', '60000001-0000-0000-0000-000000000001', 'T2', 4, 'circle', 300, 100, 'Empty'),
  ('70000001-0000-0000-0000-000000000003', '60000001-0000-0000-0000-000000000001', 'T3', 6, 'rectangle', 100, 300, 'Empty'),
  ('70000001-0000-0000-0000-000000000004', '60000001-0000-0000-0000-000000000001', 'VIP', 8, 'rectangle', 500, 100, 'Empty'),
  ('70000001-0000-0000-0000-000000000005', '60000001-0000-0000-0000-000000000002', 'A1', 2, 'circle', 80, 80, 'Empty'),
  ('70000001-0000-0000-0000-000000000006', '60000001-0000-0000-0000-000000000002', 'A2', 2, 'circle', 200, 80, 'Empty'),
  ('70000001-0000-0000-0000-000000000007', '60000001-0000-0000-0000-000000000002', 'B1', 4, 'rectangle', 80, 250, 'Empty');

-- 25. Cashier Sessions
INSERT INTO cashier_sessions (id, outlet_id, cashier_id, cashier_name, status, opened_at, starting_cash)
VALUES
  ('80000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000003', 'Ahmad Fauzi', 'OPEN', now() - interval '4 hours', '500000'),
  ('80000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000003', 'Ahmad Fauzi', 'CLOSED', now() - interval '1 day', '500000'),
  ('80000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000004', 'Dewi Lestari', 'OPEN', now() - interval '2 hours', '300000');

-- 26. Orders
INSERT INTO orders (id, idempotency_key, outlet_id, session_id, subtotal, tax_amount, discount_amount, total_amount, payment_method, amount_paid, change_amount, status, cashier_id, cashier_name, order_number, member_id)
VALUES
  ('90000001-0000-0000-0000-000000000001', 'ord-001', 'b0000001-0000-0000-0000-000000000001', '80000001-0000-0000-0000-000000000002', '60000', '6600', '0', '66600', 'cash', '70000', '3400', 'completed', 'a0000001-0000-0000-0000-000000000003', 'Ahmad Fauzi', 'PST-20260728-001', null),
  ('90000001-0000-0000-0000-000000000002', 'ord-002', 'b0000001-0000-0000-0000-000000000001', '80000001-0000-0000-0000-000000000002', '35000', '3850', '5000', '33850', 'qris', '33850', '0', 'completed', 'a0000001-0000-0000-0000-000000000003', 'Ahmad Fauzi', 'PST-20260728-002', '40000001-0000-0000-0000-000000000001'),
  ('90000001-0000-0000-0000-000000000003', 'ord-003', 'b0000001-0000-0000-0000-000000000001', '80000001-0000-0000-0000-000000000001', '50000', '5500', '0', '55500', 'cash', '60000', '4500', 'completed', 'a0000001-0000-0000-0000-000000000003', 'Ahmad Fauzi', 'PST-20260728-003', null),
  ('90000001-0000-0000-0000-000000000004', 'ord-004', 'b0000001-0000-0000-0000-000000000002', '80000001-0000-0000-0000-000000000003', '18000', '0', '0', '18000', 'cash', '20000', '2000', 'completed', 'a0000001-0000-0000-0000-000000000004', 'Dewi Lestari', 'CBG-20260728-001', '40000001-0000-0000-0000-000000000002'),
  ('90000001-0000-0000-0000-000000000005', 'ord-005', 'b0000001-0000-0000-0000-000000000001', '80000001-0000-0000-0000-000000000001', '28000', '3080', '0', '31080', 'cash', '32000', '920', 'completed', 'a0000001-0000-0000-0000-000000000003', 'Ahmad Fauzi', 'PST-20260728-004', null);

-- 27. Order Items
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, subtotal, notes)
VALUES
  ('90000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'Nasi Goreng Spesial', 1, '25000', '25000', null),
  ('90000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000003', 'Es Teh Manis', 2, '5000', '10000', null),
  ('90000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000006', 'Kentang Goreng', 1, '15000', '15000', 'extra pedas'),
  ('90000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000002', 'Ayam Bakar Madu', 1, '35000', '35000', null),
  ('90000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000005', 'Mie Goreng Seafood', 1, '28000', '28000', null),
  ('90000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000004', 'Kopi Susu Gula Aren', 1, '18000', '18000', null),
  ('90000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000003', 'Es Teh Manis', 1, '5000', '5000', null),
  ('90000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000004', 'Kopi Susu Gula Aren', 1, '18000', '18000', null),
  ('90000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000005', 'Mie Goreng Seafood', 1, '28000', '28000', null);

-- 28. Loyalty Coupons
INSERT INTO loyalty_coupons (id, program_id, code, type, value, max_discount, usage_limit, used_count, is_active, is_single_use)
VALUES
  ('a0000002-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001', 'WELCOME10', 'discount_percent', '10.00', '20000', 100, 2, true, false),
  ('a0000002-0000-0000-0000-000000000002', '30000001-0000-0000-0000-000000000001', 'GRATISONGKLIR', 'product', '25000', null, 5, 1, true, true);

-- 29. Loyalty Coupon Usages
INSERT INTO loyalty_coupon_usages (coupon_id, order_id, member_id, discount_amount)
VALUES
  ('a0000002-0000-0000-0000-000000000001', '90000001-0000-0000-0000-000000000002', '40000001-0000-0000-0000-000000000001', '5000');

-- 30. Loyalty Points Transactions
INSERT INTO loyalty_points_transactions (member_id, program_id, order_id, outlet_id, points, type)
VALUES
  ('40000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001', '90000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001', 35, 'earn'),
  ('40000001-0000-0000-0000-000000000002', '30000001-0000-0000-0000-000000000001', '90000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000002', 18, 'earn');

-- 31. Loyalty Reward Redemptions
INSERT INTO loyalty_reward_redemptions (reward_id, member_id, order_id, program_id, points_cost, status, claimed_at)
VALUES
  ('50000001-0000-0000-0000-000000000001', '40000001-0000-0000-0000-000000000001', null, '30000001-0000-0000-0000-000000000001', 100, 'claimed', now());

-- 32. Promotion Programs
INSERT INTO promotion_programs (id, name, promotion_type, type, value, max_discount, min_purchase, is_active, code)
VALUES
  ('b0000002-0000-0000-0000-000000000001', 'Diskon Akhir Pekan', 'discount', 'percentage', '15.00', '30000', '50000', true, 'WEEKEND15'),
  ('b0000002-0000-0000-0000-000000000002', 'Beli 1 Gratis 1', 'bogof', 'bogof', '0', null, null, true, 'BOGOF1');

-- 33. Promotion Outlets
INSERT INTO promotion_outlets (promotion_id, outlet_id)
VALUES
  ('b0000002-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001'),
  ('b0000002-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001');

-- 34. Refresh Tokens
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES
  ('a0000001-0000-0000-0000-000000000001', '$2b$10$XlrlRnGigJIumRE.bpDrneRF0MdWjLQzObxI9r6E6udvevC48VuS.001', now() + interval '30 days');
