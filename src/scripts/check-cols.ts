import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(
    `SELECT table_schema, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema LIKE 'tenant_%' AND table_name = 'outlet_settings'
     ORDER BY table_schema, ordinal_position`
  );
  for (const row of r.rows) {
    console.log(`${row.table_schema} | ${row.column_name}`);
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
