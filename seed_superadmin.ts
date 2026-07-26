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
  
  const email = 'admin@elyrapos.my.id';
  const plainPassword = 'superadmin123';
  
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
    console.log(`Password: ${plainPassword}`);
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
