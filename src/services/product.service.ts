import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import { eq, and, notInArray, inArray, sql, or, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { HttpError } from '../utils/errors';

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
  variants?: Array<{
    name: string;
    price: number;
    sku?: string | null;
    isDefault?: boolean;
  }>;
}

export async function createProduct(input: CreateProductInput) {
  const id = crypto.randomUUID();
  return withTenantDb(async (tx) => {
    const isStockType = (input.type ?? 'STOCK') === 'STOCK';

    const costPriceNum = (input.costPrice !== undefined && input.costPrice !== null && !isNaN(Number(input.costPrice))) ? Number(input.costPrice) : 0;
    const sellPriceNum = (input.sellPrice !== undefined && input.sellPrice !== null && !isNaN(Number(input.sellPrice))) ? Number(input.sellPrice) : 0;
    const taxRateVal = (input.taxRate !== undefined && input.taxRate !== null && (input.taxRate as any) !== '' && !isNaN(Number(input.taxRate))) ? String(input.taxRate) : null;
    const categoryIdVal = (input.categoryId && input.categoryId.trim().length > 0) ? input.categoryId : null;
    const barcodeVal = (input.barcode && input.barcode.trim().length > 0) ? input.barcode : null;
    const createdByVal = (input.createdBy && input.createdBy.trim().length > 0) ? input.createdBy : null;
    const imageUrlVal = (input.imageUrl && input.imageUrl.trim().length > 0) ? input.imageUrl : null;

    await tx.insert(schema.products).values({
      id,
      sku: input.sku,
      barcode: barcodeVal,
      name: input.name,
      costPrice: String(costPriceNum),
      sellPrice: String(sellPriceNum),
      taxType: input.taxType || 'none',
      taxRate: taxRateVal,
      type: input.type ?? 'STOCK',
      trackStock: isStockType ? (input.trackStock ?? true) : null,
      unit: input.unit || 'pcs',
      lowStockThreshold: isStockType ? (input.lowStockThreshold ?? null) : null,
      allowNegativeStock: isStockType ? (input.allowNegativeStock ?? false) : null,
      categoryId: categoryIdVal,
      imageUrl: imageUrlVal,
      createdBy: createdByVal,
      isGlobal: input.isGlobal ?? true,
    });

    let targetOutletIds = input.outletIds;

    if (input.isGlobal && (!targetOutletIds || targetOutletIds.length === 0)) {
      const allOutlets = await tx.select({ id: schema.outlets.id }).from(schema.outlets).where(eq(schema.outlets.isActive, true));
      targetOutletIds = allOutlets.map((o: { id: string }) => o.id);
    }

    const hasVariantsProvided = Boolean(input.variants && input.variants.length > 0);

    if (targetOutletIds && targetOutletIds.length > 0 && !hasVariantsProvided) {
      const outletProductsToInsert = targetOutletIds.map((outletId: string) => ({
        id: crypto.randomUUID(),
        outletId,
        productId: id,
        variantId: null,
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

    // Insert variants atomically within the same transaction if provided
    if (input.variants && input.variants.length > 0) {
      let createdCount = 0;
      const variantOutletProductsToInsert: any[] = [];

      for (const v of input.variants) {
        if (!v.name || !v.name.trim()) continue;
        const vId = crypto.randomUUID();
        const priceNum = (v.price !== undefined && v.price !== null && !isNaN(Number(v.price))) ? Number(v.price) : 0;
        await tx.insert(schema.productVariants).values({
          id: vId,
          productId: id,
          name: v.name.trim(),
          price: String(priceNum),
          sku: v.sku || null,
          isDefault: v.isDefault ?? false,
          isActive: true,
        });

        if (targetOutletIds && targetOutletIds.length > 0) {
          for (const outletId of targetOutletIds) {
            variantOutletProductsToInsert.push({
              id: crypto.randomUUID(),
              outletId,
              productId: id,
              variantId: vId,
              isAvailable: true,
              stock: 0,
            });
          }
        }

        createdCount++;
      }

      if (variantOutletProductsToInsert.length > 0) {
        await tx.insert(schema.outletProducts).values(variantOutletProductsToInsert);
      }

      if (createdCount > 0) {
        await tx.update(schema.products)
          .set({ hasVariants: true })
          .where(eq(schema.products.id, id));
      }
    }

    return { id, ...input };
  });
}

export async function getProductById(id: string, outletId?: string) {
  return withTenantDb(async (tx) => {
    const results = await tx.select().from(schema.products).where(eq(schema.products.id, id));
    const product = results[0];

    if (!product) {
      throw new HttpError(404,`Product ${id} not found`);
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

    // Outlet-specific stock & price overrides
    let stock = product.stock;
    let sellPrice = parseFloat(product.sellPrice);
    let lowStockThreshold = product.lowStockThreshold;

    if (outletId) {
      if (product.hasVariants) {
        const opSum = await tx.select({
          totalStock: sql<number>`COALESCE(SUM(${schema.outletProducts.stock}), 0)`
        })
        .from(schema.outletProducts)
        .where(and(eq(schema.outletProducts.productId, id), eq(schema.outletProducts.outletId, outletId)));

        stock = Number(opSum[0]?.totalStock || 0);
      } else {
        const op = await tx.select()
          .from(schema.outletProducts)
          .where(and(eq(schema.outletProducts.productId, id), eq(schema.outletProducts.outletId, outletId), isNull(schema.outletProducts.variantId)));
        if (op.length > 0) {
          stock = op[0].stock;
          if (op[0].sellPriceOverride) sellPrice = parseFloat(op[0].sellPriceOverride);
          if (op[0].lowStockThreshold !== null && op[0].lowStockThreshold !== undefined) {
            lowStockThreshold = op[0].lowStockThreshold;
          }
        }
      }
    } else {
      const opSum = await tx.select({
        totalStock: sql<number>`COALESCE(SUM(${schema.outletProducts.stock}), 0)`
      })
      .from(schema.outletProducts)
      .where(eq(schema.outletProducts.productId, id));

      const outletStockSum = Number(opSum[0]?.totalStock || 0);
      if (outletStockSum > 0) {
        stock = outletStockSum;
      }
    }

    // Performance Calculations
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dayOfWeek = now.getDay();
    const distToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMonday);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const whereConditions: any[] = [
      eq(schema.orderItems.productId, id),
      eq(schema.orders.status, 'completed')
    ];

    if (outletId) {
      whereConditions.push(eq(schema.orders.outletId, outletId));
    }

    // Performance Calculations — aggregate in SQL instead of loading the whole sales history
    const [saleStats] = await tx
      .select({
        soldToday: sql<number>`cast(coalesce(sum(${schema.orderItems.quantity}) filter (where ${schema.orders.createdAt} >= ${startOfDay}), 0) as int)`,
        soldThisWeek: sql<number>`cast(coalesce(sum(${schema.orderItems.quantity}) filter (where ${schema.orders.createdAt} >= ${startOfWeek}), 0) as int)`,
        soldThisMonth: sql<number>`cast(coalesce(sum(${schema.orderItems.quantity}) filter (where ${schema.orders.createdAt} >= ${startOfMonth}), 0) as int)`,
        totalRevenue: sql<number>`cast(coalesce(sum(${schema.orderItems.subtotal}::numeric), 0) as float)`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(and(...whereConditions));

    const soldToday = Number(saleStats?.soldToday || 0);
    const soldThisWeek = Number(saleStats?.soldThisWeek || 0);
    const soldThisMonth = Number(saleStats?.soldThisMonth || 0);
    const totalRevenue = Number(saleStats?.totalRevenue || 0);
    // Fetch Product Variants, Modifier Groups, and Add-ons with error safeguards
    let resolvedVariants: any[] = [];
    try {
      const variants = await tx.select()
        .from(schema.productVariants)
        .where(and(eq(schema.productVariants.productId, id), eq(schema.productVariants.isActive, true)));

      resolvedVariants = variants.map((v: any) => ({ ...v, sku: v.sku || product.sku, price: parseFloat(v.price) }));
      if (outletId && variants.length > 0) {
        const vOverrides = await tx.select()
          .from(schema.outletProducts)
          .where(and(eq(schema.outletProducts.outletId, outletId), eq(schema.outletProducts.productId, id)));
        const vMap = new Map(vOverrides.map((o: any) => [o.variantId, o]));
        resolvedVariants = variants.map((v: any) => {
          const ov = vMap.get(v.id) as any;
          return {
            ...v,
            sku: v.sku || product.sku,
            price: ov?.sellPriceOverride !== null && ov?.sellPriceOverride !== undefined ? parseFloat(ov.sellPriceOverride) : parseFloat(v.price),
            stock: ov?.stock ?? null,
            isAvailable: ov?.isAvailable ?? true,
          };
        });
      }
    } catch (err) {
      console.warn(`Failed to fetch variants for product ${id}:`, err);
    }

    let resolvedModifierGroups: any[] = [];
    try {
      const modifierGroups = await tx.select().from(schema.modifierGroups).where(eq(schema.modifierGroups.productId, id));
      if (modifierGroups.length > 0) {
        const gIds = modifierGroups.map((g: any) => g.id);
        const mods = await tx.select().from(schema.modifiers).where(and(inArray(schema.modifiers.groupId, gIds), eq(schema.modifiers.isActive, true)));
        const pMods = mods.filter((m: any) => gIds.includes(m.groupId));
        let mOverridesMap = new Map();
        if (outletId && pMods.length > 0) {
          const mOvr = await tx.select().from(schema.outletModifiers).where(and(eq(schema.outletModifiers.outletId, outletId), inArray(schema.outletModifiers.modifierId, pMods.map((m: any) => m.id))));
          mOverridesMap = new Map(mOvr.map((o: any) => [o.modifierId, o]));
        }
        resolvedModifierGroups = modifierGroups.map((g: any) => ({
          ...g,
          modifiers: pMods.filter((m: any) => m.groupId === g.id).map((m: any) => {
            const ov = mOverridesMap.get(m.id) as any;
            return {
              ...m,
              priceAdjustment: ov?.priceAdjustment !== null && ov?.priceAdjustment !== undefined ? parseFloat(ov.priceAdjustment) : parseFloat(m.priceAdjustment),
              isAvailable: ov?.isAvailable ?? true,
            };
          }),
        }));
      }
    } catch (err) {
      console.warn(`Failed to fetch modifier groups for product ${id}:`, err);
    }

    let resolvedAddOns: any[] = [];
    try {
      const addOnLinks = await tx.select().from(schema.productAddOns).where(eq(schema.productAddOns.productId, id));
      if (addOnLinks.length > 0) {
        const aIds = addOnLinks.map((l: any) => l.addOnId);
        const allAddOns = await tx.select().from(schema.addOns).where(and(inArray(schema.addOns.id, aIds), eq(schema.addOns.isActive, true)));
        const pAddOns = allAddOns.filter((a: any) => aIds.includes(a.id));
        let aOverridesMap = new Map();
        if (outletId && pAddOns.length > 0) {
          const aOvr = await tx.select().from(schema.outletAddOns).where(and(eq(schema.outletAddOns.outletId, outletId), inArray(schema.outletAddOns.addOnId, pAddOns.map((a: any) => a.id))));
          aOverridesMap = new Map(aOvr.map((o: any) => [o.addOnId, o]));
        }
        resolvedAddOns = pAddOns.map((a: any) => {
          const ov = aOverridesMap.get(a.id) as any;
          return {
            ...a,
            price: ov?.price !== null && ov?.price !== undefined ? parseFloat(ov.price) : parseFloat(a.price),
            stock: ov?.stock ?? null,
            isAvailable: ov?.isAvailable ?? true,
          };
        });
      }
    } catch (err) {
      console.warn(`Failed to fetch add-ons for product ${id}:`, err);
    }

    return {
      ...product,
      stock,
      costPrice: parseFloat(product.costPrice),
      sellPrice,
      lowStockThreshold,
      taxRate: product.taxRate ? parseFloat(product.taxRate) : undefined,
      availableAt,
      variants: resolvedVariants,
      modifierGroups: resolvedModifierGroups,
      addOns: resolvedAddOns,
      performance: {
        soldToday,
        soldThisWeek,
        soldThisMonth,
        totalRevenue
      }
    };
  });
}

export async function deleteProduct(id: string) {
  const updated = await withTenantDb(async (tx) => {
    return tx.update(schema.products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();
  });
  
  if (updated.length === 0) {
    throw new HttpError(404,`Product ${id} not found`);
  }
  
  return updated[0];
}

export async function updateProduct(id: string, input: Partial<CreateProductInput>) {
  const updated = await withTenantDb(async (tx) => {
    const payload: any = { ...input };
    payload.updatedAt = new Date();
    delete payload.outletIds;
    delete payload.variants;
    delete payload.stock;
    delete payload.modifierGroups;
    delete payload.addOns;
    
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
          variantId: null,
          stock: 0,
          isAvailable: true,
        }));
        await tx.insert(schema.outletProducts)
          .values(outletProductsToInsert)
          .onConflictDoUpdate({
            target: [schema.outletProducts.outletId, schema.outletProducts.productId, schema.outletProducts.variantId],
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
          variantId: null,
          isAvailable: true,
        }));
        await tx.insert(schema.outletProducts)
          .values(outletProductsToInsert)
          .onConflictDoUpdate({
            target: [schema.outletProducts.outletId, schema.outletProducts.productId, schema.outletProducts.variantId],
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
    throw new HttpError(404,`Product ${id} not found`);
  }
  
  return updated;
}

export async function listProducts(params: { page: number; limit: number; categoryId?: string; includeImages?: boolean; status?: string }) {
  const offset = (params.page - 1) * params.limit;
  const st = (params.status || 'ACTIVE').toUpperCase();

  return withTenantDb(async (tx) => {
    const conditions: any[] = [];

    if (st === 'ARCHIVED') {
      conditions.push(eq(schema.products.isActive, false));
    } else if (st === 'ACTIVE') {
      conditions.push(eq(schema.products.isActive, true));
    }

    if (params.categoryId) {
      conditions.push(eq(schema.products.categoryId, params.categoryId));
    }

    let query = tx
      .select()
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(and(...conditions));

    let countQuery = tx
      .select({ count: sql<number>`cast(count(${schema.products.id}) as int)` })
      .from(schema.products)
      .where(and(...conditions));
    
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
