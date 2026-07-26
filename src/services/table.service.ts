import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

interface CreateTableInput {
  floorPlanId: string;
  number: string;
  capacity?: number;
  shape?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
}

interface UpdateTableInput {
  number?: string;
  capacity?: number;
  shape?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  status?: string;
}

export async function listTables(floorPlanId: string) {
  return withTenantSchema(async (tx) => {
    return await tx
      .select()
      .from(schema.tables)
      .where(and(
        eq(schema.tables.floorPlanId, floorPlanId),
        eq(schema.tables.isActive, true)
      ))
      .orderBy(schema.tables.number);
  });
}

export async function getTable(id: string) {
  return withTenantSchema(async (tx) => {
    const [table] = await tx
      .select()
      .from(schema.tables)
      .where(eq(schema.tables.id, id))
      .limit(1);
    return table || null;
  });
}

export async function createTable(input: CreateTableInput) {
  return withTenantSchema(async (tx) => {
    const [table] = await tx.insert(schema.tables).values({
      id: crypto.randomUUID(),
      floorPlanId: input.floorPlanId,
      number: input.number,
      capacity: input.capacity ?? 4,
      shape: input.shape ?? 'circle',
      posX: input.posX ?? 0,
      posY: input.posY ?? 0,
      width: input.width ?? 80,
      height: input.height ?? 80,
    }).returning();
    return table;
  });
}

export async function updateTable(id: string, input: UpdateTableInput) {
  return withTenantSchema(async (tx) => {
    const [table] = await tx.update(schema.tables).set({
      ...input,
      updatedAt: new Date(),
    }).where(eq(schema.tables.id, id)).returning();
    return table;
  });
}

export async function deleteTable(id: string) {
  return withTenantSchema(async (tx) => {
    const [table] = await tx.update(schema.tables).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(schema.tables.id, id)).returning();
    return table;
  });
}

export async function updateTableStatus(id: string, status: string) {
  return withTenantSchema(async (tx) => {
    const [table] = await tx.update(schema.tables).set({
      status,
      updatedAt: new Date(),
    }).where(eq(schema.tables.id, id)).returning();
    return table;
  });
}

export async function bulkUpdatePositions(updates: Array<{ id: string; posX: number; posY: number }>) {
  return withTenantSchema(async (tx) => {
    for (const u of updates) {
      await tx.update(schema.tables).set({
        posX: u.posX,
        posY: u.posY,
        updatedAt: new Date(),
      }).where(eq(schema.tables.id, u.id));
    }
    return true;
  });
}
