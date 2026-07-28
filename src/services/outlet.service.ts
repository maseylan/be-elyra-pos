import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { HttpError } from '../utils/errors';

interface CreateOutletInput {
  name: string;
  address?: string;
  phone?: string;
  businessMode: string;
  isCustomConfig?: boolean;
}

export async function createOutlet(input: CreateOutletInput) {
  const id = crypto.randomUUID();
  return withTenantSchema(async (tx) => {
    const [outlet] = await tx.insert(schema.outlets).values({ id, ...input }).returning();
    return outlet;
  });
}

export async function listOutlets() {
  return withTenantSchema(async (tx) => {
    const outletsList = await tx.select().from(schema.outlets).where(eq(schema.outlets.isActive, true));

    const [{ totalGlobalProducts }] = await tx
      .select({ totalGlobalProducts: sql<number>`cast(count(${schema.products.id}) as int)` })
      .from(schema.products)
      .where(eq(schema.products.isGlobal, true));

    const result = await Promise.all(outletsList.map(async (o: any) => {
      let productCount = totalGlobalProducts || 0;
      const [{ countOutletProds }] = await tx
        .select({ countOutletProds: sql<number>`cast(count(${schema.outletProducts.id}) as int)` })
        .from(schema.outletProducts)
        .where(eq(schema.outletProducts.outletId, o.id));

      if (countOutletProds > 0) {
        productCount = countOutletProds;
      }

      const [{ employeeCount }] = await tx
        .select({ employeeCount: sql<number>`cast(count(${schema.userOutlets.id}) as int)` })
        .from(schema.userOutlets)
        .where(eq(schema.userOutlets.outletId, o.id));

      return {
        ...o,
        productCount: productCount || 0,
        employeeCount: employeeCount || 0,
      };
    }));

    return result;
  });
}

export async function getOutletById(id: string) {
  const outlet = await withTenantSchema(async (tx) => {
    const results = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, id));
    return results[0];
  });
  if (!outlet) throw new HttpError(404, `Outlet ${id} not found`);
  return outlet;
}

interface UpdateOutletInput {
  name?: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  businessMode?: string;
  isCustomConfig?: boolean;
}

export async function updateOutlet(id: string, input: UpdateOutletInput) {
  const updated = await withTenantSchema(async (tx) => {
    return tx.update(schema.outlets)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.outlets.id, id))
      .returning();
  });
  if (updated.length === 0) throw new HttpError(404, `Outlet ${id} not found`);
  return updated[0];
}


export async function deactivateOutlet(id: string) {
  const updated = await withTenantSchema(async (tx) => {
    return tx.update(schema.outlets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.outlets.id, id))
      .returning();
  });
  if (updated.length === 0) throw new HttpError(404, `Outlet ${id} not found`);
  return updated[0];
}

  