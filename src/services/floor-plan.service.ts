import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';

interface CreateFloorPlanInput {
  name: string;
  width?: number;
  height?: number;
  gridSize?: number;
}

interface UpdateFloorPlanInput {
  name?: string;
  width?: number;
  height?: number;
  gridSize?: number;
}

export async function listFloorPlans(outletId: string) {
  return withTenantDb(async (tx) => {
    return await tx
      .select()
      .from(schema.floorPlans)
      .where(eq(schema.floorPlans.outletId, outletId))
      .orderBy(desc(schema.floorPlans.createdAt));
  });
}

export async function getFloorPlan(id: string, outletId: string) {
  return withTenantDb(async (tx) => {
    const [plan] = await tx
      .select()
      .from(schema.floorPlans)
      .where(eq(schema.floorPlans.id, id))
      .limit(1);
    if (!plan || plan.outletId !== outletId) return null;
    return plan;
  });
}

export async function createFloorPlan(outletId: string, input: CreateFloorPlanInput) {
  return withTenantDb(async (tx) => {
    const [plan] = await tx.insert(schema.floorPlans).values({
      id: crypto.randomUUID(),
      outletId,
      name: input.name,
      width: input.width ?? 1200,
      height: input.height ?? 800,
      gridSize: input.gridSize ?? 40,
    }).returning();
    return plan;
  });
}

export async function updateFloorPlan(id: string, outletId: string, input: UpdateFloorPlanInput) {
  return withTenantDb(async (tx) => {
    const [plan] = await tx.update(schema.floorPlans).set({
      ...input,
      updatedAt: new Date(),
    }).where(eq(schema.floorPlans.id, id)).returning();
    return plan;
  });
}

export async function deleteFloorPlan(id: string, outletId: string) {
  return withTenantDb(async (tx) => {
    const [plan] = await tx.update(schema.floorPlans).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(schema.floorPlans.id, id)).returning();
    return plan;
  });
}
