import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import { eq } from 'drizzle-orm';

export async function resolveEffectiveSettings(outletId: string) {
  return withTenantDb(async (tx) => {
    const [tenantDefault] = await tx.select().from(schema.tenantSettings).where(eq(schema.tenantSettings.id, 'default'));
    const [override] = await tx.select().from(schema.outletSettings).where(eq(schema.outletSettings.outletId, outletId));
    const [outlet] = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, outletId)).limit(1);

    // Build the rawOverrides map: only fields that have actual override values
    const rawOverrides: Record<string, any> = {};
    if (override) {
      const overrideMap: Record<string, string> = {
        storeNameOverride: 'storeName',
        storeAddressOverride: 'storeAddress',
        storePhoneOverride: 'storePhone',
        receiptFooterOverride: 'receiptFooter',
        defaultTaxRateOverride: 'defaultTaxRate',
        taxTypeOverride: 'taxType',
        timezoneOverride: 'timezone',
        currencyOverride: 'currency',
        dateFormatOverride: 'dateFormat',
        timeFormatOverride: 'timeFormat',
        allowSellingBelowCostOverride: 'allowSellingBelowCost',
        allowNegativeStockOverride: 'allowNegativeStock',
        requireCustomerOverride: 'requireCustomer',
        autoGenerateOrderNumberOverride: 'autoGenerateOrderNumber',
        orderNumberingFormatOverride: 'orderNumberingFormat',
        roundingMethodOverride: 'roundingMethod',
        decimalPrecisionOverride: 'decimalPrecision',
        orderSequenceResetOverride: 'orderSequenceReset',
        paymentMethodsOverride: 'paymentMethods',
        activeFloorPlanIds: 'activeFloorPlanIds',
        promotionTaxModeOverride: 'promotionTaxMode',
      };

      for (const [col, key] of Object.entries(overrideMap)) {
        const val = (override as any)[col as keyof typeof override];
        if (val !== null && val !== undefined) {
          rawOverrides[key] = val;
        }
      }
    }

    return {
      rawOverrides,

      storeName: override?.storeNameOverride ?? tenantDefault?.storeName ?? outlet?.name,
      storeAddress: override?.storeAddressOverride ?? tenantDefault?.storeAddress ?? outlet?.address,
      storePhone: override?.storePhoneOverride ?? tenantDefault?.storePhone ?? outlet?.phone,
      receiptFooter: override?.receiptFooterOverride ?? tenantDefault?.receiptFooter,

      timezone: override?.timezoneOverride ?? tenantDefault?.timezone ?? 'Asia/Jakarta',
      currency: override?.currencyOverride ?? tenantDefault?.currency ?? 'IDR',
      dateFormat: override?.dateFormatOverride ?? tenantDefault?.dateFormat ?? 'DD/MM/YYYY',
      timeFormat: override?.timeFormatOverride ?? tenantDefault?.timeFormat ?? 'HH:mm',

      defaultTaxRate: override?.defaultTaxRateOverride ?? tenantDefault?.defaultTaxRate ?? '0',
      taxType: override?.taxTypeOverride ?? tenantDefault?.taxType ?? 'none',

      allowSellingBelowCost: override?.allowSellingBelowCostOverride ?? tenantDefault?.allowSellingBelowCost ?? false,
      allowNegativeStock: override?.allowNegativeStockOverride ?? tenantDefault?.allowNegativeStock ?? false,
      requireCustomer: override?.requireCustomerOverride ?? tenantDefault?.requireCustomer ?? false,
      autoGenerateOrderNumber: override?.autoGenerateOrderNumberOverride ?? tenantDefault?.autoGenerateOrderNumber ?? true,
      orderNumberingFormat: override?.orderNumberingFormatOverride ?? tenantDefault?.orderNumberingFormat ?? '{OUTLET}-{YYYYMMDD}-{SEQ}',
      roundingMethod: override?.roundingMethodOverride ?? tenantDefault?.roundingMethod ?? 'nearest_100',
      decimalPrecision: override?.decimalPrecisionOverride ?? tenantDefault?.decimalPrecision ?? 0,
      orderSequenceReset: override?.orderSequenceResetOverride ?? tenantDefault?.orderSequenceReset ?? 'daily',

      paymentMethods: override?.paymentMethodsOverride ?? tenantDefault?.paymentMethods ?? null,

      activeFloorPlanIds: override?.activeFloorPlanIds ?? null,

      promotionTaxMode: override?.promotionTaxModeOverride ?? tenantDefault?.promotionTaxMode ?? 'after_tax',
    };
  });
}

export async function updateOutletSettings(outletId: string, data: Record<string, any>) {
  return withTenantDb(async (tx) => {
    const existing = await tx.select().from(schema.outletSettings).where(eq(schema.outletSettings.outletId, outletId));

    if (existing.length === 0) {
      const [inserted] = await tx.insert(schema.outletSettings).values({
        outletId,
        ...data,
      }).returning();
      return inserted;
    }

    const [updated] = await tx.update(schema.outletSettings).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(schema.outletSettings.outletId, outletId)).returning();
    return updated;
  });
}
