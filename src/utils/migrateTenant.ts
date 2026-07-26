import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';
import * as schema from '../db/tenant_schema';
import { publicDb } from '../db/poolManager';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export const ensureTenantSchemaProvisioned = async (tenantId: string) => {
  const migrationClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await migrationClient.connect();
    
    // Create schema if not exists
    await migrationClient.query(`CREATE SCHEMA IF NOT EXISTS "${tenantId}"`);

    // Await the search_path setting to ensure it takes effect before migrations
    await migrationClient.query(`SET search_path TO "${tenantId}", public`);
    
    const migrationDb = drizzle(migrationClient);
    await migrate(migrationDb, { 
      migrationsFolder: path.join(__dirname, '../../drizzle/tenant'),
      migrationsSchema: tenantId
    });
    
    // Seed the owner account using data from the public tenants table
    const existingUsers = await migrationDb.select().from(schema.users);
    if (existingUsers.length === 0) {
      // Fetch owner details from public schema
      const tenantData = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
      if (tenantData.length > 0) {
        const owner = tenantData[0];
        await migrationDb.insert(schema.users).values({
          role: 'owner',
          name: owner.ownerName,
          email: owner.email,
          passwordHash: owner.passwordHash,
          isActive: true,
          isAllOutlets: true,
        });
        console.log(`Seeded owner account for tenant ${tenantId}`);
      }
    }

    // Seed a default outlet if none exists
    const existingOutlets = await migrationDb.select().from(schema.outlets);
    let outletId: string;
    if (existingOutlets.length === 0) {
      outletId = crypto.randomUUID();
      await migrationDb.insert(schema.outlets).values({
        id: outletId,
        name: 'Outlet Pusat',
        businessMode: 'retail',
        isActive: true,
      });
      console.log(`Seeded default outlet for tenant ${tenantId}`);
    } else {
      outletId = existingOutlets[0].id;
    }

    // Seed dummy products if not exists
    const existingProducts = await migrationDb.select().from(schema.products);
    interface SeededProduct {
      id: string;
      sku: string;
      name: string;
      costPrice: string;
      sellPrice: string;
      trackStock: boolean;
    }
    const seededProductIds: SeededProduct[] = [];
    if (existingProducts.length === 0) {
      const dummyProducts: Omit<SeededProduct, 'id'>[] = [
        { sku: 'SKU-001', name: 'Nasi Goreng Spesial', costPrice: '20000', sellPrice: '25000', trackStock: true },
        { sku: 'SKU-002', name: 'Ayam Bakar Madu', costPrice: '25000', sellPrice: '30000', trackStock: true },
        { sku: 'SKU-003', name: 'Es Teh Manis', costPrice: '2000', sellPrice: '5000', trackStock: true },
        { sku: 'SKU-004', name: 'Kopi Susu Gula Aren', costPrice: '10000', sellPrice: '18000', trackStock: true },
        { sku: 'SKU-005', name: 'Mie Goreng Seafood', costPrice: '22000', sellPrice: '28000', trackStock: true },
      ];

      const productsToInsert = dummyProducts.map(p => ({
        ...p,
        id: crypto.randomUUID(),
      }));

      seededProductIds.push(...productsToInsert);

      await migrationDb.insert(schema.products).values(
        seededProductIds.map(p => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          costPrice: p.costPrice,
          sellPrice: p.sellPrice,
          trackStock: p.trackStock,
        }))
      );
      console.log(`Seeded ${seededProductIds.length} dummy products for tenant ${tenantId}`);

      // Seed outlet_products for all seeded products (they are global by default)
      const outletProductsToInsert = seededProductIds.map(p => ({
        id: crypto.randomUUID(),
        outletId,
        productId: p.id,
        stock: 100,
        isAvailable: true,
      }));
      await migrationDb.insert(schema.outletProducts).values(outletProductsToInsert);
      console.log(`Seeded outlet_products for ${seededProductIds.length} products`);

      // Seed stock_movements (initial stock)
      const movementsToInsert = seededProductIds.map(p => ({
        id: crypto.randomUUID(),
        outletId,
        productId: p.id,
        type: 'initial' as const,
        quantityChange: 100,
        stockAfter: 100,
      }));
      await migrationDb.insert(schema.stockMovements).values(movementsToInsert);
      console.log(`Seeded stock_movements (initial) for ${seededProductIds.length} products`);
    }

    // Update tenant's application status to provisioned
    await publicDb.update(tenants)
      .set({ applicationStatus: 'provisioned' })
      .where(eq(tenants.id, tenantId));

    console.log(`Schema provisioned/verified for tenant: ${tenantId}`);
  } catch (error) {
    console.error(`Migration error for tenant ${tenantId}:`, error);
    throw error;
  } finally {
    await migrationClient.end();
  }
};
