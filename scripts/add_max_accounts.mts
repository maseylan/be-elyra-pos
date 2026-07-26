import { publicDb } from '../src/db/poolManager';
import { sql } from 'drizzle-orm';

async function run() {
  await publicDb.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_accounts INTEGER`);
  console.log('Column max_accounts added');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
