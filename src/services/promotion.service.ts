import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq, desc, sql, and, lte, gte, inArray } from 'drizzle-orm';
import crypto from 'crypto';

export async function listPromotions(filters: { promotionType?: string; page?: number; limit?: number; outletId?: string }) {
  return withTenantSchema(async (tx) => {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];

    if (filters.promotionType) conditions.push(eq(schema.promotionPrograms.promotionType, filters.promotionType));

    if (filters.outletId) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${schema.promotionOutlets} WHERE ${schema.promotionOutlets.promotionId} = ${schema.promotionPrograms.id} AND ${schema.promotionOutlets.outletId} = ${filters.outletId})`
      );
    }

    const items = await tx
      .select()
      .from(schema.promotionPrograms)
      .where(and(...conditions))
      .orderBy(desc(schema.promotionPrograms.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await tx
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(schema.promotionPrograms)
      .where(and(...conditions));

    return { data: items, total: Number(count), page, limit };
  });
}

export async function getPromotionById(id: string) {
  return withTenantSchema(async (tx) => {
    const [promotion] = await tx
      .select()
      .from(schema.promotionPrograms)
      .where(eq(schema.promotionPrograms.id, id))
      .limit(1);

    if (!promotion) return null;

    const outlets = await tx
      .select({ outletId: schema.promotionOutlets.outletId })
      .from(schema.promotionOutlets)
      .where(eq(schema.promotionOutlets.promotionId, id));

    return { ...promotion, outletIds: outlets.map((o: { outletId: string }) => o.outletId) };
  });
}

export async function createPromotion(data: any) {
  return withTenantSchema(async (tx) => {
    const { outletIds, validFrom, validUntil, ...fields } = data;

    if (fields.code) {
      const [existing] = await tx
        .select()
        .from(schema.promotionPrograms)
        .where(eq(schema.promotionPrograms.code, fields.code))
        .limit(1);
      if (existing) throw new Error('Voucher code already exists');
    }

    const [promotion] = await tx.insert(schema.promotionPrograms).values({
      id: crypto.randomUUID(),
      ...fields,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    if (outletIds?.length) {
      await tx.insert(schema.promotionOutlets).values(
        outletIds.map((outletId: string) => ({
          id: crypto.randomUUID(),
          promotionId: promotion.id,
          outletId,
        }))
      );
    }

    return { ...promotion, outletIds: outletIds || [] };
  });
}

export async function updatePromotion(id: string, data: any) {
  return withTenantSchema(async (tx) => {
    const { outletIds, validFrom, validUntil, ...fields } = data;

    if (fields.code) {
      const [existing] = await tx
        .select()
        .from(schema.promotionPrograms)
        .where(and(
          eq(schema.promotionPrograms.code, fields.code),
          sql`${schema.promotionPrograms.id} != ${id}`
        ))
        .limit(1);
      if (existing) throw new Error('Voucher code already exists');
    }

    const [promotion] = await tx.update(schema.promotionPrograms)
      .set({
        ...fields,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.promotionPrograms.id, id))
      .returning();

    if (outletIds !== undefined) {
      await tx.delete(schema.promotionOutlets)
        .where(eq(schema.promotionOutlets.promotionId, id));

      if (outletIds.length) {
        await tx.insert(schema.promotionOutlets).values(
          outletIds.map((outletId: string) => ({
            id: crypto.randomUUID(),
            promotionId: id,
            outletId,
          }))
        );
      }
    }

    return { ...promotion, outletIds: outletIds || [] };
  });
}

export async function deletePromotion(id: string) {
  return withTenantSchema(async (tx) => {
    await tx.delete(schema.promotionOutlets)
      .where(eq(schema.promotionOutlets.promotionId, id));
    await tx.delete(schema.promotionPrograms)
      .where(eq(schema.promotionPrograms.id, id));
  });
}

export async function getActivePromotions(outletId: string) {
  return withTenantSchema(async (tx) => {
    const now = new Date();

    const promotions = await tx
      .select()
      .from(schema.promotionPrograms)
      .innerJoin(schema.promotionOutlets, eq(schema.promotionOutlets.promotionId, schema.promotionPrograms.id))
      .where(and(
        eq(schema.promotionPrograms.isActive, true),
        eq(schema.promotionOutlets.outletId, outletId),
        sql`(${schema.promotionPrograms.validFrom} IS NULL OR ${schema.promotionPrograms.validFrom} <= ${now})`,
        sql`(${schema.promotionPrograms.validUntil} IS NULL OR ${schema.promotionPrograms.validUntil} >= ${now})`,
      ))
      .orderBy(desc(schema.promotionPrograms.createdAt));

    const discounts: Record<string, any[]> = {};
    const totalDiscounts: any[] = [];
    const buyXGetY: Record<string, any[]> = {};

    for (const p of promotions) {
      const promo = p.promotion_programs;
      if (promo.type === 'discount_product' && promo.productId) {
        if (!discounts[promo.productId]) discounts[promo.productId] = [];
        discounts[promo.productId].push(promo);
      } else if (promo.type === 'discount_total') {
        totalDiscounts.push(promo);
      } else if (promo.type === 'buy_x_get_y' && promo.productId) {
        if (!buyXGetY[promo.productId]) buyXGetY[promo.productId] = [];
        buyXGetY[promo.productId].push(promo);
      }
    }

    return { discounts, totalDiscounts, buyXGetY };
  });
}