import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq, and, sql, or, isNull, inArray } from 'drizzle-orm';
import crypto from 'crypto';

export function resolveEffectivePrice(
  product: { sellPrice: string | number },
  outletProduct: { sellPriceOverride: string | number | null } | null
): number {
  const base = typeof product.sellPrice === 'string' ? parseFloat(product.sellPrice) : product.sellPrice;
  if (!outletProduct?.sellPriceOverride) return base;
  const override = typeof outletProduct.sellPriceOverride === 'string'
    ? parseFloat(outletProduct.sellPriceOverride)
    : outletProduct.sellPriceOverride;
  return override;
}

export async function listProductsForOutlet(outletId: string, params?: { page?: number; limit?: number; categoryId?: string; includeImages?: boolean; status?: string }) {
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const offset = (page - 1) * limit;
  const st = (params?.status || 'ACTIVE').toUpperCase();

  return withTenantSchema(async (tx) => {
    const outletFilter = or(
      eq(schema.outletProducts.isAvailable, true),
      and(isNull(schema.outletProducts.isAvailable), eq(schema.products.isGlobal, true))
    );

    const conditions: any[] = [outletFilter];

    if (st === 'ARCHIVED') {
      conditions.push(eq(schema.products.isActive, false));
    } else if (st === 'ACTIVE') {
      conditions.push(eq(schema.products.isActive, true));
    }

    if (params?.categoryId) {
      conditions.push(eq(schema.products.categoryId, params.categoryId));
    }

    let query = tx
      .select()
      .from(schema.products)
      .leftJoin(
        schema.outletProducts,
        and(
          eq(schema.outletProducts.productId, schema.products.id),
          eq(schema.outletProducts.outletId, outletId),
          isNull(schema.outletProducts.variantId)
        )
      )
      .leftJoin(
        schema.categories,
        eq(schema.categories.id, schema.products.categoryId)
      )
      .where(and(...conditions));

    const rows = await query.limit(limit).offset(offset);

    let countQuery = tx
      .select({ count: sql<number>`cast(count(${schema.products.id}) as int)` })
      .from(schema.products)
      .leftJoin(
        schema.outletProducts,
        and(
          eq(schema.outletProducts.productId, schema.products.id),
          eq(schema.outletProducts.outletId, outletId),
          isNull(schema.outletProducts.variantId)
        )
      )
      .where(and(...conditions));
    const [{ count }] = await countQuery;

    const includeImages = params?.includeImages !== false;

    // Resolve total variant stock for products with variants
    const variantProductIds = rows
      .filter(({ products: p }: any) => p.hasVariants)
      .map(({ products: p }: any) => p.id);

    let variantStockMap: Record<string, number> = {};
    if (variantProductIds.length > 0) {
      const variantStocks = await tx
        .select({
          productId: schema.outletProducts.productId,
          totalStock: sql<number>`COALESCE(SUM(${schema.outletProducts.stock}), 0)`,
        })
        .from(schema.outletProducts)
        .where(
          and(
            eq(schema.outletProducts.outletId, outletId),
            inArray(schema.outletProducts.productId, variantProductIds)
          )
        )
        .groupBy(schema.outletProducts.productId);

      variantStocks.forEach((vs: any) => {
        variantStockMap[vs.productId] = Number(vs.totalStock || 0);
      });
    }

    const data = rows.map(({ products: product, outlet_products: op, categories: cat }: any) => {
      const effectiveStock = product.hasVariants
        ? (variantStockMap[product.id] ?? 0)
        : (op?.stock ?? product.stock ?? 0);

      const entry: any = {
        ...product,
        id: product.id,
        name: product.name,
        sku: product.sku,
        costPrice: parseFloat(product.costPrice),
        sellPrice: resolveEffectivePrice(product, op),
        stock: effectiveStock,
        isAvailable: true,
        taxRate: product.taxRate ? parseFloat(product.taxRate) : undefined,
        categoryName: cat?.name || null,
      };
      if (!includeImages) delete entry.imageUrl;
      return entry;
    });

    return { data, total: count };
  });
}

export async function decrementStock(tx: any, params: {
  outletId: string;
  productId: string;
  quantity: number;
  referenceId?: string;
  createdBy?: string;
}) {
  const [current] = await tx.select().from(schema.outletProducts)
    .where(and(eq(schema.outletProducts.outletId, params.outletId), eq(schema.outletProducts.productId, params.productId)));

  const newStock = (current?.stock ?? 0) - params.quantity;

  await tx.update(schema.outletProducts)
    .set({ stock: newStock, updatedAt: new Date() })
    .where(and(eq(schema.outletProducts.outletId, params.outletId), eq(schema.outletProducts.productId, params.productId)));

  await tx.insert(schema.stockMovements).values({
    id: crypto.randomUUID(),
    outletId: params.outletId,
    productId: params.productId,
    type: 'sale',
    quantityChange: -params.quantity,
    stockAfter: newStock,
    referenceId: params.referenceId,
    createdBy: params.createdBy,
  });
}
