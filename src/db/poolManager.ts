import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as sharedSchema from './schema';
import dotenv from 'dotenv';

dotenv.config();

export const publicPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
export const publicDb = drizzle(publicPool, { schema: sharedSchema });

export const adminPool = new Pool({
  connectionString: process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30000,
});
