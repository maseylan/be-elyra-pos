import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { superAdmins } from './src/db/schema';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const seedSuperAdmin = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  const db = drizzle(pool);
  
  const email = process.env.SUPERADMIN_EMAIL;
  const plainPassword = process.env.SUPERADMIN_PASSWORD;
  if (!email || !plainPassword) throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required');
  
  console.log(`Creating superadmin with email: ${email}`);
  
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  
  try {
    await db.insert(superAdmins).values({
      id: crypto.randomUUID(),
      email,
      passwordHash,
    });
    console.log('Superadmin successfully created!');
    console.log(`Email: ${email}`);
  } catch (err: any) {
    if (err.code === '23505') { // Unique violation
      console.log('Superadmin with this email already exists!');
    } else {
      console.error('Error creating superadmin:', err);
    }
  }
  
  await pool.end();
};

seedSuperAdmin();
