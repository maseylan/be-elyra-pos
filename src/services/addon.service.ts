import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface CreateAddOnInput {
  name: string;
  price: number;
}

export interface UpsertOutletAddOnInput {
  price?: number;
  stock?: number;
  isAvailable?: boolean;
}

export async function createAddOn(input: CreateAddOnInput) {
  return withTenantSchema(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.addOns).values({
      id,
      name: input.name,
      price: String(input.price),
      isActive: true,
    });
    return { id, ...input };
  });
}

export async function getAddOns(outletId?: string) {
  return withTenantSchema(async (tx) => {
    const addOnsList = await tx.select()
      .from(schema.addOns)
      .where(eq(schema.addOns.isActive, true));

    if (!outletId || addOnsList.length === 0) {
      return addOnsList.map((a: any) => ({
        ...a,
        price: parseFloat(a.price),
      }));
    }

    const outletOverrides = await tx.select()
      .from(schema.outletAddOns)
      .where(eq(schema.outletAddOns.outletId, outletId));

    const overrideMap = new Map(outletOverrides.map((o: any) => [o.addOnId, o]));

    return addOnsList.map((a: any) => {
      const override = overrideMap.get(a.id) as any;
      return {
        ...a,
        price: override?.price !== null && override?.price !== undefined
          ? parseFloat(override.price)
          : parseFloat(a.price),
        stock: override?.stock ?? null,
        isAvailable: override?.isAvailable ?? true,
      };
    });
  });
}

export async function getAddOnsForProduct(productId: string, outletId?: string) {
  return withTenantSchema(async (tx) => {
    const links = await tx.select({ addOnId: schema.productAddOns.addOnId })
      .from(schema.productAddOns)
      .where(eq(schema.productAddOns.productId, productId));

    if (links.length === 0) return [];
    const addOnIds = links.map((l: any) => l.addOnId);

    const allAddOns = await getAddOns(outletId);
    return allAddOns.filter((a: any) => addOnIds.includes(a.id));
  });
}

export async function attachAddOnToProduct(productId: string, addOnId: string) {
  return withTenantSchema(async (tx) => {
    const existing = await tx.select()
      .from(schema.productAddOns)
      .where(and(
        eq(schema.productAddOns.productId, productId),
        eq(schema.productAddOns.addOnId, addOnId)
      ));

    if (existing.length > 0) return existing[0];

    const id = crypto.randomUUID();
    await tx.insert(schema.productAddOns).values({
      id,
      productId,
      addOnId,
    });
    return { id, productId, addOnId };
  });
}

export async function detachAddOnFromProduct(productId: string, addOnId: string) {
  return withTenantSchema(async (tx) => {
    await tx.delete(schema.productAddOns)
      .where(and(
        eq(schema.productAddOns.productId, productId),
        eq(schema.productAddOns.addOnId, addOnId)
      ));
    return { success: true };
  });
}

export async function upsertOutletAddOn(outletId: string, addOnId: string, input: UpsertOutletAddOnInput) {
  return withTenantSchema(async (tx) => {
    const existing = await tx.select()
      .from(schema.outletAddOns)
      .where(and(
        eq(schema.outletAddOns.outletId, outletId),
        eq(schema.outletAddOns.addOnId, addOnId)
      ));

    if (existing.length === 0) {
      const id = crypto.randomUUID();
      await tx.insert(schema.outletAddOns).values({
        id,
        outletId,
        addOnId,
        price: input.price !== undefined ? String(input.price) : null,
        stock: input.stock ?? null,
        isAvailable: input.isAvailable ?? true,
      });
    } else {
      const updates: any = { updatedAt: new Date() };
      if (input.price !== undefined) updates.price = input.price !== null ? String(input.price) : null;
      if (input.stock !== undefined) updates.stock = input.stock;
      if (input.isAvailable !== undefined) updates.isAvailable = input.isAvailable;

      await tx.update(schema.outletAddOns)
        .set(updates)
        .where(eq(schema.outletAddOns.id, existing[0].id));
    }

    return { outletId, addOnId, ...input };
  });
}
