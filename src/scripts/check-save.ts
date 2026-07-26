import { publicDb } from '../db/poolManager';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';

async function main() {
  const activeTenants = await publicDb.select().from(tenants).where(eq(tenants.isActive, true));
  for (const tenant of activeTenants) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.on('connect', (client: any) => {
      client.query(`SET search_path TO "${tenant.id}", public`);
    });
    try {
      // Check current data
      const cur = await pool.query(`SELECT id, outlet_id, active_floor_plan_ids FROM outlet_settings LIMIT 5`);
      console.log(`\n=== Tenant: ${tenant.id} ===`);
      console.log('Current outlet_settings:', JSON.stringify(cur.rows, null, 2));

      // Try a direct update
      const testId = cur.rows[0]?.outlet_id;
      if (testId) {
        await pool.query(
          `UPDATE outlet_settings SET active_floor_plan_ids = $1::jsonb WHERE outlet_id = $2`,
          [JSON.stringify(['test-uuid-1111', 'test-uuid-2222']), testId]
        );
        console.log('Updated outlet:', testId);
        
        // Verify
        const verify = await pool.query(
          `SELECT active_floor_plan_ids FROM outlet_settings WHERE outlet_id = $1`,
          [testId]
        );
        console.log('After update:', JSON.stringify(verify.rows[0]?.active_floor_plan_ids));
        
        // Reset back
        await pool.query(
          `UPDATE outlet_settings SET active_floor_plan_ids = NULL WHERE outlet_id = $1`,
          [testId]
        );
        console.log('Reset to null');
      }
    } catch(e: any) {
      console.log('ERR:', tenant.id, e.message);
    }
    await pool.end();
  }
}
main();
