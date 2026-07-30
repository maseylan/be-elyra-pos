ALTER TABLE "invoices" ADD CONSTRAINT "invoices_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id");
ALTER TABLE "outgoing_mails" ADD CONSTRAINT "outgoing_mails_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
