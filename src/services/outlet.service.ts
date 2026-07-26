import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export class OutletNotFoundError extends Error {}

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
    return tx.select().from(schema.outlets).where(eq(schema.outlets.isActive, true));
  });
}

export async function getOutletById(id: string) {
  const outlet = await withTenantSchema(async (tx) => {
    const results = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, id));
    return results[0];
  });
  if (!outlet) throw new OutletNotFoundError(`Outlet ${id} not found`);
  return outlet;
}

export async function deactivateOutlet(id: string) {
  const updated = await withTenantSchema(async (tx) => {
    return tx.update(schema.outlets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.outlets.id, id))
      .returning();
  });
  if (updated.length === 0) throw new OutletNotFoundError(`Outlet ${id} not found`);
  return updated[0];
}
  