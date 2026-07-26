import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled'); END IF; END $$`);

    await client.query(`CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price_monthly INTEGER NOT NULL DEFAULT 0,
      price_yearly INTEGER,
      features JSONB NOT NULL DEFAULT '[]',
      max_outlets INTEGER,
      max_products INTEGER,
      max_accounts INTEGER,
      has_loyalty BOOLEAN DEFAULT FALSE,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status invoice_status DEFAULT 'pending' NOT NULL,
      due_date TIMESTAMP,
      paid_at TIMESTAMP,
      period_start TIMESTAMP,
      period_end TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      amount INTEGER NOT NULL,
      method TEXT,
      status TEXT DEFAULT 'pending',
      reference TEXT,
      paid_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )`);

    console.log('Public schema tables created successfully');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
