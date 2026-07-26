import { publicDb } from '../db/poolManager';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';

async function main() {
  const activeTenants = await publicDb.select().from(tenants).where(eq(tenants.isActive, true));

  for (const tenant of activeTenants) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.on('connect', (client) => {
      client.query(`SET search_path TO "${tenant.id}", public`);
    });
    try {
      await pool.query(`ALTER TABLE "${tenant.id}"."outlet_settings" ADD COLUMN IF NOT EXISTS active_floor_plan_ids jsonb`);
      console.log('OK:', tenant.id);
    } catch (e: any) {
      console.log('ERR:', tenant.id, e.message);
    } finally {
      await pool.end();
    }
  }
}

main();
