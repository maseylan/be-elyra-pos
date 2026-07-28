import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq, and, sql, desc, inArray, lte, gt, gte, ne } from 'drizzle-orm';
import crypto from 'crypto';
import { HttpError } from '../utils/errors';

export async function listStockMovements(filters: {
  outletId?: string;
  productId?: string;
  variantId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  excludeSales?: boolean;
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
    if (filters.variantId) conditions.push(eq(schema.stockMovements.variantId, filters.variantId));
    if (filters.type) conditions.push(eq(schema.stockMovements.type, filters.type as any));
    if (filters.startDate) conditions.push(gte(schema.stockMovements.createdAt, new Date(filters.startDate)));
    if (filters.endDate) conditions.push(lte(schema.stockMovements.createdAt, new Date(filters.endDate)));
    if (filters.excludeSales) conditions.push(ne(schema.stockMovements.type, 'sale'));

    const rows = await tx
      .select({
        movement: schema.stockMovements,
        productName: schema.products.name,
        productSku: schema.products.sku,
        variantName: schema.productVariants.name,
        variantSku: schema.productVariants.sku,
        outletName: schema.outlets.name,
        userName: schema.users.name,
        userRole: schema.users.role,
      })
      .from(schema.stockMovements)
      .leftJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
      .leftJoin(schema.productVariants, eq(schema.productVariants.id, schema.stockMovements.variantId))
      .leftJoin(schema.outlets, eq(schema.outlets.id, schema.stockMovements.outletId))
      .leftJoin(schema.users, eq(schema.users.id, schema.stockMovements.createdBy))
      .where(and(...conditions))
      .orderBy(desc(schema.stockMovements.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await tx
      .select({ count: sql<number>`cast(count(${schema.stockMovements.id}) as int)` })
      .from(schema.stockMovements)
      .where(and(...conditions));

    const data = rows.map((r: any) => {
      const displayName = r.variantName ? `${r.productName}:${r.variantName}` : (r.productName || r.movement.productId);
      const effectiveSku = r.variantSku || r.productSku || null;

      return {
        id: r.movement.id,
        outletId: r.movement.outletId,
        productId: r.movement.productId,
        variantId: r.movement.variantId || null,
        outletName: r.outletName,
        productName: displayName,
        productSku: effectiveSku,
        variantName: r.variantName || null,
        variantSku: r.variantSku || null,
        type: r.movement.type,
        quantityChange: r.movement.quantityChange,
        stockAfter: r.movement.stockAfter,
        referenceId: r.movement.referenceId,
        note: r.movement.note,
        createdBy: r.movement.createdBy,
        userName: r.userName || r.movement.createdBy || 'Admin',
        userRole: r.userRole || 'Store Manager',
        createdAt: r.movement.createdAt,
      };
    });

    return { data, total: count, page, limit };
  });
}

export async function adjustStock(params: {
  outletId: string;
  productId: string;
  variantId?: string;
  type: 'restock' | 'stock_out' | 'adjustment' | 'waste' | 'return';
  quantity: number;
  note?: string;
  createdBy?: string;
}) {
  return withTenantSchema(async (tx) => {
    const [product] = await tx
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, params.productId));

    if (!product) throw new HttpError(400,'Product not found');
    if (product.type !== 'STOCK') throw new HttpError(400,'Product is not a stock-tracked item');

    const outletProductConditions = [
      eq(schema.outletProducts.outletId, params.outletId),
      eq(schema.outletProducts.productId, params.productId),
    ];
    if (params.variantId) {
      outletProductConditions.push(eq(schema.outletProducts.variantId, params.variantId));
    } else {
      outletProductConditions.push(sql`${schema.outletProducts.variantId} IS NULL`);
    }

    const [outletProduct] = await tx
      .select()
      .from(schema.outletProducts)
      .where(and(...outletProductConditions));

    if (!outletProduct) throw new HttpError(400,'Product/variant is not available at this outlet');

    let quantityChange: number;
    switch (params.type) {
      case 'restock':
      case 'return':
        quantityChange = Math.abs(params.quantity);
        break;
      case 'waste':
      case 'stock_out':
        quantityChange = -Math.abs(params.quantity);
        break;
      case 'adjustment':
        quantityChange = params.quantity;
        break;
      default:
        throw new HttpError(400,'Invalid movement type');
    }

    const newStock = outletProduct.stock + quantityChange;
    if (newStock < 0 && !product.allowNegativeStock) {
      throw new HttpError(400,'Insufficient stock. Cannot go below 0.');
    }

    await tx
      .update(schema.outletProducts)
      .set({ stock: Math.max(0, newStock), updatedAt: new Date() })
      .where(eq(schema.outletProducts.id, outletProduct.id));

    await tx.insert(schema.stockMovements).values({
      id: crypto.randomUUID(),
      outletId: params.outletId,
      productId: params.productId,
      variantId: params.variantId || null,
      type: params.type === 'stock_out' ? 'waste' : params.type,
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
        variantId: schema.outletProducts.variantId,
        productName: schema.products.name,
        productSku: schema.products.sku,
        variantName: schema.productVariants.name,
        variantSku: schema.productVariants.sku,
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
      .leftJoin(schema.productVariants, eq(schema.productVariants.id, schema.outletProducts.variantId))
      .leftJoin(schema.outlets, eq(schema.outlets.id, schema.outletProducts.outletId))
      .where(and(...conditions))
      .orderBy(sql`${schema.outletProducts.stock} asc`);

    return rows.map((r: any) => ({
      id: r.variantId ? `${r.id}:${r.variantId}` : r.id,
      productId: r.id,
      variantId: r.variantId || null,
      name: r.variantName ? `${r.productName}:${r.variantName}` : r.productName,
      sku: r.variantSku || r.productSku || null,
      stock: r.stock,
      lowStockThreshold: r.lowStockThreshold,
      outletName: r.outletName || null,
      outletId: r.outletId || null,
    }));
  });
}
