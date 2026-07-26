import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq, and, sql, desc, inArray, lte, gt, gte } from 'drizzle-orm';
import crypto from 'crypto';

export class StockError extends Error {
  constructor(message: string) { super(message); this.name = 'StockError'; }
}

export async function listStockMovements(filters: {
  outletId?: string;
  productId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;

  return withTenantSchema(async (tx) => {
    const conditions: any[] = [];

    if (filters.outletId) conditions.push(eq(schema.stockMovements.outletId, filters.outletId));
    if (filters.productId) conditions.push(eq(schema.stockMovements.productId, filters.productId));
    if (filters.type) conditions.push(eq(schema.stockMovements.type, filters.type as any));
    if (filters.startDate) conditions.push(gte(schema.stockMovements.createdAt, new Date(filters.startDate)));
    if (filters.endDate) conditions.push(lte(schema.stockMovements.createdAt, new Date(filters.endDate)));

    const rows = await tx
      .select({
        movement: schema.stockMovements,
        productName: schema.products.name,
        productSku: schema.products.sku,
        outletName: schema.outlets.name,
      })
      .from(schema.stockMovements)
      .leftJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
      .leftJoin(schema.outlets, eq(schema.outlets.id, schema.stockMovements.outletId))
      .where(and(...conditions))
      .orderBy(desc(schema.stockMovements.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await tx
      .select({ count: sql<number>`cast(count(${schema.stockMovements.id}) as int)` })
      .from(schema.stockMovements)
      .where(and(...conditions));

    const data = rows.map((r: any) => ({
      id: r.movement.id,
      outletId: r.movement.outletId,
      productId: r.movement.productId,
      outletName: r.outletName,
      productName: r.productName,
      productSku: r.productSku,
      type: r.movement.type,
      quantityChange: r.movement.quantityChange,
      stockAfter: r.movement.stockAfter,
      referenceId: r.movement.referenceId,
      note: r.movement.note,
      createdBy: r.movement.createdBy,
      createdAt: r.movement.createdAt,
    }));

    return { data, total: count, page, limit };
  });
}

export async function adjustStock(params: {
  outletId: string;
  productId: string;
  type: 'restock' | 'adjustment' | 'waste' | 'return';
  quantity: number;
  note?: string;
  createdBy?: string;
}) {
  return withTenantSchema(async (tx) => {
    const [product] = await tx
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, params.productId));

    if (!product) throw new StockError('Product not found');
    if (product.type !== 'STOCK') throw new StockError('Product is not a stock-tracked item');

    const [outletProduct] = await tx
      .select()
      .from(schema.outletProducts)
      .where(
        and(
          eq(schema.outletProducts.outletId, params.outletId),
          eq(schema.outletProducts.productId, params.productId)
        )
      );

    if (!outletProduct) throw new StockError('Product is not available at this outlet');

    let quantityChange: number;
    switch (params.type) {
      case 'restock':
      case 'return':
        quantityChange = Math.abs(params.quantity);
        break;
      case 'waste':
        quantityChange = -Math.abs(params.quantity);
        break;
      case 'adjustment':
        quantityChange = params.quantity;
        break;
      default:
        throw new StockError('Invalid movement type');
    }

    const newStock = outletProduct.stock + quantityChange;
    if (newStock < 0 && !product.allowNegativeStock) {
      throw new StockError('Insufficient stock. Cannot go below 0.');
    }

    await tx
      .update(schema.outletProducts)
      .set({ stock: Math.max(0, newStock), updatedAt: new Date() })
      .where(
        and(
          eq(schema.outletProducts.outletId, params.outletId),
          eq(schema.outletProducts.productId, params.productId)
        )
      );

    await tx.insert(schema.stockMovements).values({
      id: crypto.randomUUID(),
      outletId: params.outletId,
      productId: params.productId,
      type: params.type,
      quantityChange,
      stockAfter: Math.max(0, newStock),
      note: params.note || null,
      createdBy: params.createdBy,
    });

    return { stockAfter: Math.max(0, newStock), quantityChange };
  });
}

export async function getLowStockProducts(outletId?: string) {
  return withTenantSchema(async (tx) => {
    const conditions: any[] = [
      eq(schema.products.type, 'STOCK'),
      eq(schema.products.isActive, true),
      eq(schema.outletProducts.isAvailable, true),
    ];

    if (outletId) {
      conditions.push(eq(schema.outletProducts.outletId, outletId));
    }

    conditions.push(
      sql`${schema.outletProducts.stock} <= COALESCE(${schema.outletProducts.lowStockThreshold}, ${schema.products.lowStockThreshold}, 0)`
    );

    const rows = await tx
      .select({
        id: schema.products.id,
        name: schema.products.name,
        sku: schema.products.sku,
        stock: schema.outletProducts.stock,
        lowStockThreshold: sql<number>`COALESCE(${schema.outletProducts.lowStockThreshold}, ${schema.products.lowStockThreshold}, 0)`,
        outletName: schema.outlets.name,
        outletId: schema.outletProducts.outletId,
      })
      .from(schema.products)
      .innerJoin(
        schema.outletProducts,
        and(
          eq(schema.outletProducts.productId, schema.products.id),
          outletId ? eq(schema.outletProducts.outletId, outletId) : undefined,
        )
      )
      .leftJoin(schema.outlets, eq(schema.outlets.id, schema.outletProducts.outletId))
      .where(and(...conditions))
      .orderBy(sql`${schema.outletProducts.stock} asc`);

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      stock: r.stock,
      lowStockThreshold: r.lowStockThreshold,
      outletName: r.outletName || null,
      outletId: r.outletId || null,
    }));
  });
}
