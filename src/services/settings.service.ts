import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq } from 'drizzle-orm';

const DEFAULT_SETTINGS = {
  id: 'default',
  storeName: 'My Store',
  storeAddress: null,
  storePhone: null,
  defaultTaxRate: '0',
  taxType: 'none',
  receiptFooter: null,
  timezone: 'Asia/Jakarta',
  currency: 'IDR',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: 'HH:mm',
  allowSellingBelowCost: false,
  allowNegativeStock: false,
  requireCustomer: false,
  autoGenerateOrderNumber: true,
  orderNumberingFormat: '{OUTLET}-{YYYYMMDD}-{SEQ}',
  roundingMethod: 'nearest_100',
  decimalPrecision: 0,
  orderSequenceReset: 'daily',
  paymentMethods: null,
};

export const getTenantSettings = async () => {
  return await withTenantSchema(async (tx) => {
    const results = await tx.select().from(schema.tenantSettings).where(eq(schema.tenantSettings.id, 'default'));
    return results[0] || DEFAULT_SETTINGS;
  });
};

export const updateTenantSettings = async (data: any) => {
  return await withTenantSchema(async (tx) => {
    const existing = await tx.select().from(schema.tenantSettings).where(eq(schema.tenantSettings.id, 'default'));
    if (existing.length === 0) {
      const inserted = await tx.insert(schema.tenantSettings).values({
        id: 'default',
        ...data,
      }).returning();
      return inserted[0];
    } else {
      const updated = await tx.update(schema.tenantSettings).set({
        ...data,
        updatedAt: new Date(),
      }).where(eq(schema.tenantSettings.id, 'default')).returning();
      return updated[0];
    }
  });
};
