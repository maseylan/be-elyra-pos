import { Router } from 'express';
import { registerTenant, provisionTenant, resolveTenant, getAllTenants, setupDatabase } from './controllers/tenant.controller';
import { requireAuth, requireSuperadmin, requireOwner } from './middlewares/auth.middleware';

const publicRouter = Router();

// Public route for self-serve registration
publicRouter.post('/tenants/register', registerTenant);
publicRouter.post('/tenants/:tenantId/provision', provisionTenant);
publicRouter.get('/tenants/resolve', resolveTenant);

// Setup database (Needs auth, but NOT tenant context middleware)
publicRouter.post('/tenants/setup', requireAuth, requireOwner, setupDatabase);

// Superadmin routes (does not need tenant context)
publicRouter.get('/tenants', requireAuth, requireSuperadmin, getAllTenants);

export default publicRouter;
