import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq, and, notInArray, inArray, sql, or, isNull } from 'drizzle-orm';
import crypto from 'crypto';

export class ProductNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductNotFoundError';
  }
}

interface CreateProductInput {
  sku: string;
  barcode?: string;
  name: string;
  costPrice: number;
  sellPrice: number;
  taxType: 'inclusive' | 'exclusive' | 'none';
  taxRate?: number;
  type?: 'STOCK' | 'NON_STOCK' | 'SERVICES';
  trackStock?: boolean;
  stock?: number;
  unit: string;
  lowStockThreshold?: number;
  allowNegativeStock?: boolean;
  categoryId?: string;
  imageUrl?: string;
  createdBy?: string;
  isGlobal?: boolean;
  outletIds?: string[];
}

export async function createProduct(input: CreateProductInput) {
  const id = crypto.randomUUID();
  return withTenantSchema(async (tx) => {
    const isStockType = (input.type ?? 'STOCK') === 'STOCK';

    await tx.insert(schema.products).values({
      id,
      sku: input.sku,
      barcode: input.barcode,
      name: input.name,
      costPrice: String(input.costPrice),
      sellPrice: String(input.sellPrice),
      taxType: input.taxType,
      taxRate: input.taxRate ? String(input.taxRate) : null,
      type: input.type ?? 'STOCK',
      trackStock: isStockType ? (input.trackStock ?? true) : null,
      unit: input.unit,
      lowStockThreshold: isStockType ? (input.lowStockThreshold ?? null) : null,
      allowNegativeStock: isStockType ? (input.allowNegativeStock ?? false) : null,
      categoryId: input.categoryId,
      imageUrl: input.imageUrl,
      createdBy: input.createdBy,
      isGlobal: input.isGlobal ?? true,
    });

    let targetOutletIds = input.outletIds;

    if (input.isGlobal && (!targetOutletIds || targetOutletIds.length === 0)) {
      const allOutlets = await tx.select({ id: schema.outlets.id }).from(schema.outlets).where(eq(schema.outlets.isActive, true));
      targetOutletIds = allOutlets.map((o: { id: string }) => o.id);
    }

    if (targetOutletIds && targetOutletIds.length > 0) {
      const outletProductsToInsert = targetOutletIds.map((outletId: string) => ({
        id: crypto.randomUUID(),
        outletId,
        productId: id,
        isAvailable: true,
        stock: isStockType ? (input.stock ?? 0) : 0,
      }));
      await tx.insert(schema.outletProducts).values(outletProductsToInsert);

      if (isStockType && input.trackStock && (input.stock ?? 0) > 0) {
        const movementsToInsert = targetOutletIds.map(outletId => ({
          id: crypto.randomUUID(),
          outletId,
          productId: id,
          type: 'initial' as const,
          quantityChange: input.stock ?? 0,
          stockAfter: input.stock ?? 0,
          createdBy: input.createdBy,
        }));
        await tx.insert(schema.stockMovements).values(movementsToInsert);
      }
    }

    return { id, ...input };
  });
}

export async function getProductById(id: string) {
  return withTenantSchema(async (tx) => {
    const results = await tx.select().from(schema.products).where(eq(schema.products.id, id));
    const product = results[0];

    if (!product) {
      throw new ProductNotFoundError(`Product ${id} not found`);
    }

    let availableAt: any[] = [];
    if (!product.isGlobal) {
      availableAt = await tx.select({
        outletId: schema.outletProducts.outletId,
        outletName: schema.outlets.name,
      })
      .from(schema.outletProducts)
      .innerJoin(schema.outlets, eq(schema.outlets.id, schema.outletProducts.outletId))
      .where(and(eq(schema.outletProducts.productId, id), eq(schema.outletProducts.isAvailable, true)));
    } else {
      availableAt = [{ outletName: 'Semua Outlet' }];
    }

    return {
      ...product,
      costPrice: parseFloat(product.costPrice),
      sellPrice: parseFloat(product.sellPrice),
      taxRate: product.taxRate ? parseFloat(product.taxRate) : undefined,
      availableAt,
    };
  });
}

export async function deleteProduct(id: string) {
  const updated = await withTenantSchema(async (tx) => {
    return tx.update(schema.products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();
  });
  
  if (updated.length === 0) {
    throw new ProductNotFoundError(`Product ${id} not found`);
  }
  
  return updated[0];
}

export async function updateProduct(id: string, input: Partial<CreateProductInput>) {
  const updated = await withTenantSchema(async (tx) => {
    const payload: any = { ...input };
    payload.updatedAt = new Date();
    delete payload.outletIds;
    
    if (input.costPrice !== undefined) payload.costPrice = String(input.costPrice);
    if (input.sellPrice !== undefined) payload.sellPrice = String(input.sellPrice);
    if (input.taxRate !== undefined) payload.taxRate = input.taxRate ? String(input.taxRate) : null;
    
    if (input.isGlobal !== undefined) payload.isGlobal = input.isGlobal;

    if (input.type !== undefined) {
      const isStockType = input.type === 'STOCK';
      payload.type = input.type;
      if (!isStockType) {
        payload.trackStock = null;
        payload.allowNegativeStock = null;
        payload.lowStockThreshold = null;
      }
    }
    
    const [updatedProduct] = await tx.update(schema.products)
      .set(payload)
      .where(eq(schema.products.id, id))
      .returning();

    if (input.isGlobal) {
      const allOutlets = await tx.select({ id: schema.outlets.id }).from(schema.outlets).where(eq(schema.outlets.isActive, true));
      const allOutletIds = allOutlets.map((o: { id: string }) => o.id);

      if (allOutletIds.length > 0) {
        const outletProductsToInsert = allOutletIds.map((outletId: string) => ({
          id: crypto.randomUUID(),
          outletId,
          productId: id,
          stock: 0,
          isAvailable: true,
        }));
        await tx.insert(schema.outletProducts)
          .values(outletProductsToInsert)
          .onConflictDoUpdate({
            target: [schema.outletProducts.outletId, schema.outletProducts.productId],
            set: { isAvailable: true, updatedAt: new Date() }
          });
      }
    }

    if (input.outletIds !== undefined && !input.isGlobal) {
      if (input.outletIds.length > 0) {
        await tx.update(schema.outletProducts)
          .set({ isAvailable: false, updatedAt: new Date() })
          .where(
            and(
              eq(schema.outletProducts.productId, id),
              notInArray(schema.outletProducts.outletId, input.outletIds)
            )
          );

        const outletProductsToInsert = input.outletIds.map(outletId => ({
          id: crypto.randomUUID(),
          outletId,
          productId: id,
          isAvailable: true,
        }));
        await tx.insert(schema.outletProducts)
          .values(outletProductsToInsert)
          .onConflictDoUpdate({
            target: [schema.outletProducts.outletId, schema.outletProducts.productId],
            set: { isAvailable: true, updatedAt: new Date() }
          });
      } else {
        await tx.update(schema.outletProducts)
          .set({ isAvailable: false, updatedAt: new Date() })
          .where(eq(schema.outletProducts.productId, id));
      }
    }

    return updatedProduct;
  });
  
  if (!updated) {
    throw new ProductNotFoundError(`Product ${id} not found`);
  }
  
  return updated;
}

export async function listProducts(params: { page: number; limit: number; categoryId?: string; includeImages?: boolean }) {
  const offset = (params.page - 1) * params.limit;
  
  return withTenantSchema(async (tx) => {
    let query = tx
      .select()
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId));
    let countQuery = tx.select({ count: sql<number>`cast(count(${schema.products.id}) as int)` }).from(schema.products);
    
    if (params.categoryId) {
      query = query.where(eq(schema.products.categoryId, params.categoryId)) as any;
      countQuery = countQuery.where(eq(schema.products.categoryId, params.categoryId)) as any;
    }
    
    const [{ count }] = await countQuery;
    const rows = await query.limit(params.limit).offset(offset);
    
    // Fetch available outlets for the fetched products
    const productIds = rows.map((r: any) => r.products.id);
    let availableAtMap: Record<string, any[]> = {};
    
    if (productIds.length > 0) {
      const outletProductLinks = await tx.select({
        productId: schema.outletProducts.productId,
        outletName: schema.outlets.name,
      })
      .from(schema.outletProducts)
      .innerJoin(schema.outlets, eq(schema.outlets.id, schema.outletProducts.outletId))
      .where(
        and(
          inArray(schema.outletProducts.productId, productIds),
          eq(schema.outletProducts.isAvailable, true)
        )
      );
      
      outletProductLinks.forEach((link: any) => {
        if (!availableAtMap[link.productId]) availableAtMap[link.productId] = [];
        availableAtMap[link.productId].push(link);
      });
    }
    
    const includeImages = params.includeImages !== false;
    const data = rows.map((r: any) => {
      const p = r.products;
      const cat = r.categories;
      const entry: any = {
        ...p,
        costPrice: parseFloat(p.costPrice),
        sellPrice: parseFloat(p.sellPrice),
        taxRate: p.taxRate ? parseFloat(p.taxRate) : undefined,
        availableAt: p.isGlobal ? [{ outletName: 'Semua Outlet' }] : (availableAtMap[p.id] || []),
        categoryName: cat?.name || null,
      };
      if (!includeImages) delete entry.imageUrl;
      return entry;
    });

    return { data, total: count };
  });
}
