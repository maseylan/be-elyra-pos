import { publicDb } from '../db/poolManager';
import { tenants, superAdmins } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-123';

export const ownerLogin = async (email: string, password: string, subdomain?: string) => {
  const tenantRecords = await publicDb.select().from(tenants).where(eq(tenants.email, email));
  
  if (tenantRecords.length === 0) {
    const superAdminRecords = await publicDb.select().from(superAdmins).where(eq(superAdmins.email, email));
    
    if (superAdminRecords.length > 0) {
      const sa = superAdminRecords[0];
      const isPasswordValid = await bcrypt.compare(password, sa.passwordHash);
      if (!isPasswordValid) throw new Error('INVALID_CREDENTIALS');
      
      const token = jwt.sign({ role: 'superadmin', email: sa.email }, JWT_SECRET, { expiresIn: '24h' });
      return {
        message: 'Superadmin login successful',
        token,
        user: {
          role: 'superadmin',
          email: sa.email
        }
      };
    }

    throw new Error('INVALID_CREDENTIALS');
  }

  const tenant = tenantRecords[0];

  // If login is attempted from a specific subdomain, ensure they own it
  if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
    if (tenant.subdomain !== subdomain) {
      throw new Error('INVALID_CREDENTIALS');
    }
  }

  const isPasswordValid = await bcrypt.compare(password, tenant.passwordHash);

  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (!tenant.isActive) {
    throw new Error('ACCOUNT_DEACTIVATED');
  }

  const token = jwt.sign(
    { 
      tenantId: tenant.id, 
      subdomain: tenant.subdomain,
      role: 'owner',
      name: tenant.ownerName
    }, 
    JWT_SECRET, 
    { expiresIn: '24h' }
  );

  return {
    message: 'Login successful',
    token,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      ownerName: tenant.ownerName,
      subscriptionType: tenant.subscriptionType,
      subscriptionEnd: tenant.subscriptionEnd,
      applicationStatus: tenant.applicationStatus
    }
  };
};
