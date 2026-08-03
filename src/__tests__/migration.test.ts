import { describe, it, expect } from 'vitest';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import 'dotenv/config';

const ADMIN_URL = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
const runDbTests = process.env.RUN_DB_TESTS === '1';

// ponytail: gated by RUN_DB_TESTS=1 — baseline `npm test` tidak butuh DB,
// CI dapat menyalakannya sebagai smoke check fresh migration (audit #23)
describe.skipIf(!runDbTests)('Fresh database migration', () => {
  it('migrasi ke database kosong menghasilkan constraint kritis', async () => {
    if (!ADMIN_URL) throw new Error('DATABASE_ADMIN_URL / DATABASE_URL wajib diisi saat RUN_DB_TESTS=1');

    const dbName = `elyrapos_migration_test_${Date.now()}`;
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      const dbUrl = new URL(ADMIN_URL);
      dbUrl.pathname = `/${dbName}`;
      const client = new Client({ connectionString: dbUrl.toString() });
      await client.connect();
      try {
        const db = drizzle(client);
        await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle/tenant') });

        const expected = [
          'orders_pk',
          'order_items_pk',
          'outlet_products_pk',
          'order_items_order_id_orders_id_fk',
          'orders_idempotency_key_unique',
          'outlet_products_unique_base',
          'orders_session_id_status_idx',
          'orders_outlet_created_idx',
          'order_items_order_id_idx',
          'cash_movements_session_created_idx',
          'stock_movements_outlet_created_idx',
          'points_txn_member_program_idx',
          'points_txn_earn_unique_order',
        ];
        for (const name of expected) {
          const { rows } = await client.query(
            `SELECT EXISTS (
               SELECT 1 FROM pg_constraint WHERE conname = $1
               UNION ALL
               SELECT 1 FROM pg_indexes WHERE indexname = $1
             ) AS ok`,
            [name],
          );
          expect(rows[0]?.ok, `missing constraint/index: ${name}`).toBe(true);
        }

        const [{ rows: idxRows }] = [await client.query(`SELECT indexdef FROM pg_indexes WHERE indexname = 'orders_idempotency_key_unique'`)];
        expect(idxRows[0]?.indexdef).toContain('UNIQUE');

        const [{ rows: fkRows }] = [await client.query(`SELECT confdeltype FROM pg_constraint WHERE conname = 'order_items_order_id_orders_id_fk'`)];
        expect(fkRows[0]?.confdeltype).toBe('c');
      } finally {
        await client.end();
      }
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
      await admin.end();
    }
  });
});
