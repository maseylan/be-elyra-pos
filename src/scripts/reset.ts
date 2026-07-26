import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function resetDB() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to DB');
  
  // Drop public schema cascade
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  console.log('Public schema dropped and recreated');
  
  // Also drop tenant schemas? Sure, we can fetch all schemas and drop them
  const schemas = await client.query(`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'public', 'pg_toast')
  `);
  
  for (const row of schemas.rows) {
    if (row.schema_name.startsWith('tenant_')) {
      await client.query(`DROP SCHEMA "${row.schema_name}" CASCADE`);
      console.log(`Dropped schema ${row.schema_name}`);
    }
  }
  
  await client.end();
}

resetDB().catch(console.error);
