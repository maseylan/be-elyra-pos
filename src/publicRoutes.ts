import { Router } from 'express';
import { registerTenant, provisionTenant, resolveTenant, getAllTenants, setupDatabase, getTenantDetails, toggleTenantStatus, updateTenantPlan } from './controllers/tenant.controller';
import { requireAuth, requireSuperadmin, requireOwner } from './middlewares/auth.middleware';

const publicRouter = Router();

// Public route for self-serve registration
publicRouter.post('/tenants/register', registerTenant);
publicRouter.post('/tenants/:tenantId/provision', provisionTenant);
publicRouter.get('/tenants/resolve', resolveTenant);

// Setup database (Superadmin only, does not need tenant context middleware)
publicRouter.post('/tenants/:tenantId/setup', requireAuth, requireSuperadmin, setupDatabase);
publicRouter.post('/tenants/setup', requireAuth, requireSuperadmin, setupDatabase);

// Superadmin routes (does not need tenant context)
publicRouter.get('/tenants', requireAuth, requireSuperadmin, getAllTenants);
publicRouter.get('/tenants/:tenantId', requireAuth, requireSuperadmin, getTenantDetails);
publicRouter.patch('/tenants/:tenantId/status', requireAuth, requireSuperadmin, toggleTenantStatus);
publicRouter.patch('/tenants/:tenantId/plan', requireAuth, requireSuperadmin, updateTenantPlan);

export default publicRouter;
