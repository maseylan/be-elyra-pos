import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export class CategoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryNotFoundError';
  }
}

export async function createCategory(input: { name: string; description?: string }) {
  const id = crypto.randomUUID();
  return withTenantSchema(async (tx) => {
    await tx.insert(schema.categories).values({
      id,
      name: input.name,
      description: input.description,
    });
    return { id, ...input };
  });
}

export async function listCategories() {
  return withTenantSchema(async (tx) => {
    return tx.select().from(schema.categories).where(eq(schema.categories.isActive, true));
  });
}

export async function getCategoryById(id: string) {
  const category = await withTenantSchema(async (tx) => {
    const results = await tx.select().from(schema.categories).where(eq(schema.categories.id, id));
    return results[0];
  });
  
  if (!category || !category.isActive) {
    throw new CategoryNotFoundError(`Category ${id} not found`);
  }
  
  return category;
}

export async function updateCategory(id: string, input: { name?: string; description?: string }) {
  const updated = await withTenantSchema(async (tx) => {
    const payload: any = { updatedAt: new Date() };
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    
    return tx.update(schema.categories)
      .set(payload)
      .where(eq(schema.categories.id, id))
      .returning();
  });
  
  if (updated.length === 0) {
    throw new CategoryNotFoundError(`Category ${id} not found`);
  }
  
  return updated[0];
}

export async function deleteCategory(id: string) {
  const updated = await withTenantSchema(async (tx) => {
    return tx.update(schema.categories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.categories.id, id))
      .returning();
  });
  
  if (updated.length === 0) {
    throw new CategoryNotFoundError(`Category ${id} not found`);
  }
  
  return updated[0];
}
