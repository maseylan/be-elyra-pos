import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as sharedSchema from './schema';
import dotenv from 'dotenv';

dotenv.config();

// Public DB connection (for SuperAdmin & Tenant Registry, bypassing PgBouncer if needed)
const publicPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
export const publicDb = drizzle(publicPool, { schema: sharedSchema });

// Pool manager for Tenant DB connections
// This uses PgBouncer for efficient transaction pooling
export const tenantPool = new Pool({
  connectionString: process.env.PGBOUNCER_URL || process.env.DATABASE_URL,
  max: 20, // PgBouncer handles multiplexing, so this is just the client pool size
  idleTimeoutMillis: 30000,
});
export const tenantDbPool = drizzle(tenantPool);

