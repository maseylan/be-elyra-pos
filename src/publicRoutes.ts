import { Router } from 'express';
import { registerTenant, verifyEmail, provisionTenant, resolveTenant, getAllTenants, setupDatabase, getTenantDetails, toggleTenantStatus, updateTenantPlan, getTenantDbInfo, checkTenantDbConnection, getTenantSystemInfo, platformHealthCheck, clearPlatformCache, getPlatformStats, checkAvailability } from './controllers/tenant.controller';
import { getOutgoingMails, getMailStats, retryOutgoingMail } from './controllers/outgoing-mail.controller';
import { requireAuth, requireSuperadmin, requireOwner } from './middlewares/auth.middleware';

const publicRouter = Router();

// Public route for self-serve registration
publicRouter.post('/tenants/register', registerTenant);
publicRouter.post('/auth/verify-email', verifyEmail);
publicRouter.post('/tenants/:tenantId/provision', requireAuth, requireSuperadmin, provisionTenant);
publicRouter.get('/tenants/resolve', resolveTenant);
publicRouter.get('/auth/check-availability', checkAvailability);

// Setup database (Superadmin only, does not need tenant context middleware)
publicRouter.post('/tenants/:tenantId/setup', requireAuth, requireSuperadmin, setupDatabase);
publicRouter.post('/tenants/setup', requireAuth, requireSuperadmin, setupDatabase);

// Superadmin routes (does not need tenant context)
publicRouter.get('/tenants', requireAuth, requireSuperadmin, getAllTenants);
publicRouter.get('/tenants/:tenantId', requireAuth, requireSuperadmin, getTenantDetails);
publicRouter.patch('/tenants/:tenantId/status', requireAuth, requireSuperadmin, toggleTenantStatus);
publicRouter.patch('/tenants/:tenantId/plan', requireAuth, requireSuperadmin, updateTenantPlan);
publicRouter.get('/tenants/:tenantId/db-info', requireAuth, requireSuperadmin, getTenantDbInfo);
publicRouter.post('/tenants/:tenantId/db-health', requireAuth, requireSuperadmin, checkTenantDbConnection);
publicRouter.get('/tenants/:tenantId/system-info', requireAuth, requireSuperadmin, getTenantSystemInfo);

// Platform operations
publicRouter.get('/platform/stats', requireAuth, requireSuperadmin, getPlatformStats);
publicRouter.post('/platform/health-check', requireAuth, requireSuperadmin, platformHealthCheck);
publicRouter.post('/platform/clear-cache', requireAuth, requireSuperadmin, clearPlatformCache);

// Outgoing mails (superadmin)
publicRouter.get('/mails/stats', requireAuth, requireSuperadmin, getMailStats);
publicRouter.get('/mails', requireAuth, requireSuperadmin, getOutgoingMails);
publicRouter.post('/mails/:id/retry', requireAuth, requireSuperadmin, retryOutgoingMail);

export default publicRouter;
