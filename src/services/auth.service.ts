import { publicDb } from '../db/poolManager';
import { tenants, superAdmins } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { checkLoginLockout, recordFailedLogin, resetLoginAttempts } from './login-lockout.service';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

export const ownerLogin = async (email: string, password: string, subdomain?: string) => {
  const tenantRecords = await publicDb.select().from(tenants).where(eq(tenants.email, email));
  
  if (tenantRecords.length === 0) {
    await checkLoginLockout('superadmin', email);
    const superAdminRecords = await publicDb.select().from(superAdmins).where(eq(superAdmins.email, email));
    
    if (superAdminRecords.length > 0) {
      const sa = superAdminRecords[0];
      const isPasswordValid = await bcrypt.compare(password, sa.passwordHash);
      if (!isPasswordValid) {
        await recordFailedLogin('superadmin', email);
        throw new Error('INVALID_CREDENTIALS');
      }
      await resetLoginAttempts('superadmin', email);
      
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
  const scope = `tenant:${tenant.id}`;

  await checkLoginLockout(scope, email);

  // If login is attempted from a specific subdomain, ensure they own it
  if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
    if (tenant.subdomain !== subdomain) {
      await recordFailedLogin(scope, email);
      throw new Error('INVALID_CREDENTIALS');
    }
  }

  if (!tenant.isActive) {
    await recordFailedLogin(scope, email);
    throw new Error('INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(password, tenant.passwordHash);

  if (!isPasswordValid) {
    await recordFailedLogin(scope, email);
    throw new Error('INVALID_CREDENTIALS');
  }

  await resetLoginAttempts(scope, email);

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
      nextBillingCycle: tenant.nextBillingCycle,
      applicationStatus: tenant.applicationStatus
    }
  };
};
