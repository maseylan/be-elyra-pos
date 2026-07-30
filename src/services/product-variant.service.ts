import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import crypto from 'crypto';

export interface CreateVariantInput {
  name: string;
  price: number;
  sku?: string;
  isDefault?: boolean;
}

export interface UpdateVariantInput {
  name?: string;
  price?: number;
  sku?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpsertOutletVariantInput {
  price?: number;
  stock?: number;
  isAvailable?: boolean;
}

export async function createVariant(productId: string, input: CreateVariantInput) {
  if (!input.name || !input.name.trim()) {
    throw new Error('Nama varian wajib diisi');
  }

  const priceNum = Number(input.price);
  if (input.price === undefined || input.price === null || isNaN(priceNum)) {
    throw new Error('Harga varian harus berupa angka yang valid');
  }

  return withTenantDb(async (tx) => {
    const existingProduct = await tx.select({ id: schema.products.id, isGlobal: schema.products.isGlobal })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (existingProduct.length === 0) {
      throw new Error(`Product ${productId} not found`);
    }

    const id = crypto.randomUUID();

    // If isDefault is true, unset any existing default variant for this product
    if (input.isDefault) {
      await tx.update(schema.productVariants)
        .set({ isDefault: false })
        .where(eq(schema.productVariants.productId, productId));
    }

    await tx.insert(schema.productVariants).values({
      id,
      productId,
      name: input.name.trim(),
      price: String(priceNum),
      sku: input.sku || null,
      isDefault: input.isDefault ?? false,
      isActive: true,
    });

    // Automatically create outlet_products rows for this variant across relevant outlets
    let targetOutletIds: string[] = [];
    if (existingProduct[0].isGlobal) {
      const allOutlets = await tx.select({ id: schema.outlets.id }).from(schema.outlets).where(eq(schema.outlets.isActive, true));
      targetOutletIds = allOutlets.map((o: { id: string }) => o.id);
    } else {
      const productOutlets = await tx.select({ outletId: schema.outletProducts.outletId })
        .from(schema.outletProducts)
        .where(and(eq(schema.outletProducts.productId, productId), isNull(schema.outletProducts.variantId)));
      targetOutletIds = Array.from(new Set(productOutlets.map((po: { outletId: string }) => po.outletId)));
    }

    if (targetOutletIds.length > 0) {
      const outletVariantProducts = targetOutletIds.map((outletId: string) => ({
        id: crypto.randomUUID(),
        outletId,
        productId,
        variantId: id,
        isAvailable: true,
        stock: 0,
      }));
      await tx.insert(schema.outletProducts).values(outletVariantProducts);
    }

    // Flag product as having variants
    await tx.update(schema.products)
      .set({ hasVariants: true })
      .where(eq(schema.products.id, productId));

    // Remove any base product entry (variantId is null) in outlet_products since product now has variants
    await tx.delete(schema.outletProducts)
      .where(and(
        eq(schema.outletProducts.productId, productId),
        isNull(schema.outletProducts.variantId)
      ));

    return { id, productId, name: input.name.trim(), price: priceNum, sku: input.sku, isDefault: input.isDefault };
  });
}

export async function getVariantsByProduct(productId: string, outletId?: string) {
  return withTenantDb(async (tx) => {
    const [parentProduct] = await tx.select({ sku: schema.products.sku })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    const parentSku = parentProduct?.sku || null;

    const variants = await tx.select()
      .from(schema.productVariants)
      .where(and(
        eq(schema.productVariants.productId, productId),
        eq(schema.productVariants.isActive, true)
      ));

    if (!outletId) {
      return variants.map((v: any) => ({
        ...v,
        sku: v.sku || parentSku,
        price: parseFloat(v.price),
      }));
    }

    // Resolve outlet overrides from outletProducts
    const outletOverrides = await tx.select()
      .from(schema.outletProducts)
      .where(and(
        eq(schema.outletProducts.outletId, outletId),
        eq(schema.outletProducts.productId, productId)
      ));

    const overrideMap = new Map(outletOverrides.map((o: any) => [o.variantId, o]));

    return variants.map((v: any) => {
      const override = overrideMap.get(v.id) as any;
      return {
        ...v,
        sku: v.sku || parentSku,
        price: override?.sellPriceOverride !== null && override?.sellPriceOverride !== undefined
          ? parseFloat(override.sellPriceOverride)
          : parseFloat(v.price),
        stock: override?.stock ?? null,
        isAvailable: override?.isAvailable ?? true,
      };
    });
  });
}

export async function updateVariant(variantId: string, input: UpdateVariantInput) {
  return withTenantDb(async (tx) => {
    const existing = await tx.select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId));

    if (existing.length === 0) throw new Error('Variant not found');
    const variant = existing[0];

    if (input.isDefault) {
      await tx.update(schema.productVariants)
        .set({ isDefault: false })
        .where(eq(schema.productVariants.productId, variant.productId));
    }

    const updates: any = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.price !== undefined) updates.price = String(input.price);
    if (input.sku !== undefined) updates.sku = input.sku;
    if (input.isDefault !== undefined) updates.isDefault = input.isDefault;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    await tx.update(schema.productVariants)
      .set(updates)
      .where(eq(schema.productVariants.id, variantId));

    return { ...variant, ...input };
  });
}

export async function softDeleteVariant(variantId: string) {
  return withTenantDb(async (tx) => {
    await tx.update(schema.productVariants)
      .set({ isActive: false })
      .where(eq(schema.productVariants.id, variantId));
    return { success: true };
  });
}

export async function upsertOutletVariant(outletId: string, variantId: string, input: UpsertOutletVariantInput) {
  return withTenantDb(async (tx) => {
    const [variant] = await tx.select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId))
      .limit(1);

    if (!variant) throw new Error('Variant not found');

    const existing = await tx.select()
      .from(schema.outletProducts)
      .where(and(
        eq(schema.outletProducts.outletId, outletId),
        eq(schema.outletProducts.productId, variant.productId),
        eq(schema.outletProducts.variantId, variantId)
      ));

    if (existing.length === 0) {
      const id = crypto.randomUUID();
      await tx.insert(schema.outletProducts).values({
        id,
        outletId,
        productId: variant.productId,
        variantId,
        sellPriceOverride: input.price !== undefined ? String(input.price) : null,
        stock: input.stock ?? 0,
        isAvailable: input.isAvailable ?? true,
      });
    } else {
      const updates: any = { updatedAt: new Date() };
      if (input.price !== undefined) updates.sellPriceOverride = input.price !== null ? String(input.price) : null;
      if (input.stock !== undefined) updates.stock = input.stock;
      if (input.isAvailable !== undefined) updates.isAvailable = input.isAvailable;

      await tx.update(schema.outletProducts)
        .set(updates)
        .where(eq(schema.outletProducts.id, existing[0].id));
    }

    return { outletId, variantId, ...input };
  });
}
