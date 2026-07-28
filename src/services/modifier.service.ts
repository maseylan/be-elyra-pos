import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface CreateModifierGroupInput {
  name: string;
  selectionType?: 'single' | 'multiple';
  minSelect?: number;
  maxSelect?: number;
  isRequired?: boolean;
}

export interface CreateModifierInput {
  name: string;
  priceAdjustment: number;
}

export interface UpsertOutletModifierInput {
  priceAdjustment?: number;
  isAvailable?: boolean;
}

export async function createModifierGroup(productId: string, input: CreateModifierGroupInput) {
  return withTenantSchema(async (tx) => {
    const id = crypto.randomUUID();
    const selectionType = input.selectionType ?? 'single';

    await tx.insert(schema.modifierGroups).values({
      id,
      productId,
      name: input.name,
      selectionType,
      minSelect: selectionType === 'single' ? 0 : (input.minSelect ?? 0),
      maxSelect: selectionType === 'single' ? 1 : (input.maxSelect ?? null),
      isRequired: input.isRequired ?? false,
    });

    return { id, productId, ...input };
  });
}

export async function getModifierGroupsByProduct(productId: string, outletId?: string) {
  return withTenantSchema(async (tx) => {
    const groups = await tx.select()
      .from(schema.modifierGroups)
      .where(eq(schema.modifierGroups.productId, productId));

    if (groups.length === 0) return [];

    const groupIds = groups.map((g: any) => g.id);
    const allModifiers = await tx.select()
      .from(schema.modifiers)
      .where(and(
        eq(schema.modifiers.isActive, true)
      ));

    const relevantModifiers = allModifiers.filter((m: any) => groupIds.includes(m.groupId));

    let outletOverridesMap = new Map();
    if (outletId && relevantModifiers.length > 0) {
      const overrides = await tx.select()
        .from(schema.outletModifiers)
        .where(eq(schema.outletModifiers.outletId, outletId));
      outletOverridesMap = new Map(overrides.map((o: any) => [o.modifierId, o]));
    }

    return groups.map((group: any) => {
      const groupMods = relevantModifiers
        .filter((m: any) => m.groupId === group.id)
        .map((m: any) => {
          const override = outletOverridesMap.get(m.id);
          return {
            ...m,
            priceAdjustment: override?.priceAdjustment !== null && override?.priceAdjustment !== undefined
              ? parseFloat(override.priceAdjustment)
              : parseFloat(m.priceAdjustment),
            isAvailable: override?.isAvailable ?? true,
          };
        });

      return {
        ...group,
        modifiers: groupMods,
      };
    });
  });
}

export async function createModifier(groupId: string, input: CreateModifierInput) {
  return withTenantSchema(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.modifiers).values({
      id,
      groupId,
      name: input.name,
      priceAdjustment: String(input.priceAdjustment),
      isActive: true,
    });
    return { id, groupId, ...input };
  });
}

export async function updateModifierGroup(groupId: string, input: Partial<CreateModifierGroupInput>) {
  return withTenantSchema(async (tx) => {
    const updates: any = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.selectionType !== undefined) updates.selectionType = input.selectionType;
    if (input.minSelect !== undefined) updates.minSelect = input.minSelect;
    if (input.maxSelect !== undefined) updates.maxSelect = input.maxSelect;
    if (input.isRequired !== undefined) updates.isRequired = input.isRequired;

    await tx.update(schema.modifierGroups)
      .set(updates)
      .where(eq(schema.modifierGroups.id, groupId));

    return { groupId, ...input };
  });
}

export async function updateModifier(modifierId: string, input: { name?: string; priceAdjustment?: number; isActive?: boolean }) {
  return withTenantSchema(async (tx) => {
    const updates: any = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.priceAdjustment !== undefined) updates.priceAdjustment = String(input.priceAdjustment);
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    await tx.update(schema.modifiers)
      .set(updates)
      .where(eq(schema.modifiers.id, modifierId));

    return { modifierId, ...input };
  });
}

export async function softDeleteModifier(modifierId: string) {
  return withTenantSchema(async (tx) => {
    await tx.update(schema.modifiers)
      .set({ isActive: false })
      .where(eq(schema.modifiers.id, modifierId));
    return { success: true };
  });
}

export async function upsertOutletModifier(outletId: string, modifierId: string, input: UpsertOutletModifierInput) {
  return withTenantSchema(async (tx) => {
    const existing = await tx.select()
      .from(schema.outletModifiers)
      .where(and(
        eq(schema.outletModifiers.outletId, outletId),
        eq(schema.outletModifiers.modifierId, modifierId)
      ));

    if (existing.length === 0) {
      const id = crypto.randomUUID();
      await tx.insert(schema.outletModifiers).values({
        id,
        outletId,
        modifierId,
        priceAdjustment: input.priceAdjustment !== undefined ? String(input.priceAdjustment) : null,
        isAvailable: input.isAvailable ?? true,
      });
    } else {
      const updates: any = { updatedAt: new Date() };
      if (input.priceAdjustment !== undefined) updates.priceAdjustment = input.priceAdjustment !== null ? String(input.priceAdjustment) : null;
      if (input.isAvailable !== undefined) updates.isAvailable = input.isAvailable;

      await tx.update(schema.outletModifiers)
        .set(updates)
        .where(eq(schema.outletModifiers.id, existing[0].id));
    }

    return { outletId, modifierId, ...input };
  });
}
