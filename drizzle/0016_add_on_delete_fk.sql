-- Add explicit onDelete behavior to existing foreign keys in tenant schema
ALTER TABLE "orders" DROP CONSTRAINT "orders_outlet_id_outlets_id_fk",
  ADD CONSTRAINT "orders_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT;
ALTER TABLE "orders" DROP CONSTRAINT "orders_cashier_id_users_id_fk",
  ADD CONSTRAINT "orders_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_orders_id_fk",
  ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fk",
  ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;
