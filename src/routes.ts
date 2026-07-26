import { Router } from 'express';
import { getProducts, getProductById, createProduct, deleteProduct, updateProduct } from './controllers/product.controller';
import { getStockMovements, adjustStock, getLowStockProducts } from './controllers/stock.controller';
import { getCategories, getCategoryById, createCategory, deleteCategory, updateCategory } from './controllers/category.controller';
import { getSettings, updateSettings, getOutletSettings, updateOutletSettings } from './controllers/settings.controller';
import { getAccounts, addAccount, removeAccount, assignUserOutlets, getMyOutlets } from './controllers/user.controller';
import { createOutlet, listOutlets, getOutlet, updateOutlet, deactivateOutlet } from './controllers/outlet.controller';
import { createOrder, listOrders, getOrder, getOrderSummary, refundOrder } from './controllers/order.controller';
import { listCustomers, getCustomer, adjustCustomerPoints, createCustomer, enrollCustomer } from './controllers/customer.controller';
import { listPromotions, getPromotion, createPromotion, updatePromotion, deletePromotion, getActivePromotions, updatePromotionOutlets } from './controllers/promotion.controller';
import { listFloorPlans, getFloorPlan, createFloorPlan, updateFloorPlan, deleteFloorPlan } from './controllers/floor-plan.controller';
import { listTables, createTable, updateTable, deleteTable, updateTableStatus, bulkUpdatePositions } from './controllers/table.controller';
import { requireAuth, requireRole, authorizeTenantAccess, requireSuperadmin, requireLoyaltyAccess } from './middlewares/auth.middleware';
import { requireSessionType } from './middlewares/require-session-type.middleware';
import {
  listPrograms, getProgram, createProgram, updateProgram, deleteProgram,
  listProgramOutlets, assignOutlet, removeOutlet, getActiveProgramByOutlet,
  listRewards, createReward, updateReward, deleteReward,
  listCoupons, createCoupon, updateCoupon, deleteCoupon, validateCouponHandler,
  lookupMember, listMembers, getMemberDetail, getRedeemableRewards,
  earnPointsHandler,
} from './controllers/loyalty.controller';
import { resolveOutletContext } from './middlewares/outlet-context.middleware';

const apiRouter = Router();

// All routes in this router require tenant-operational session type
apiRouter.use(requireSessionType('tenant-operational'));

const requireAdminOrOwner = requireRole(['admin', 'owner']);

// Protected Tenant Admin/Owner/Cashier Routes
apiRouter.get('/products', requireAuth, authorizeTenantAccess, resolveOutletContext, getProducts);
apiRouter.get('/products/low-stock', requireAuth, authorizeTenantAccess, resolveOutletContext, getLowStockProducts);
apiRouter.get('/products/:id', requireAuth, authorizeTenantAccess, resolveOutletContext, getProductById);
apiRouter.post('/products', requireAuth, authorizeTenantAccess, requireAdminOrOwner, createProduct);
apiRouter.put('/products/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, updateProduct);
apiRouter.delete('/products/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, deleteProduct);

// Stock routes
apiRouter.get('/stock-movements', requireAuth, authorizeTenantAccess, resolveOutletContext, getStockMovements);
apiRouter.post('/stock/adjust', requireAuth, authorizeTenantAccess, requireAdminOrOwner, resolveOutletContext, adjustStock);

// Category routes
apiRouter.get('/categories', requireAuth, authorizeTenantAccess, getCategories);
apiRouter.get('/categories/:id', requireAuth, authorizeTenantAccess, getCategoryById);
apiRouter.post('/categories', requireAuth, authorizeTenantAccess, requireAdminOrOwner, createCategory);
apiRouter.put('/categories/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, updateCategory);
apiRouter.delete('/categories/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, deleteCategory);

// Protected Tenant Admin/Owner Routes
apiRouter.get('/accounts', requireAuth, authorizeTenantAccess, requireAdminOrOwner, getAccounts);
apiRouter.post('/accounts', requireAuth, authorizeTenantAccess, requireAdminOrOwner, addAccount);
apiRouter.delete('/accounts/:accountId', requireAuth, authorizeTenantAccess, requireAdminOrOwner, removeAccount);

// Settings routes
apiRouter.get('/settings', requireAuth, authorizeTenantAccess, requireAdminOrOwner, getSettings);
apiRouter.put('/settings', requireAuth, authorizeTenantAccess, requireAdminOrOwner, updateSettings);

// Outlet settings routes
apiRouter.get('/settings/outlet/:outletId', requireAuth, authorizeTenantAccess, getOutletSettings);
apiRouter.put('/settings/outlet/:outletId', requireAuth, authorizeTenantAccess, requireAdminOrOwner, updateOutletSettings);

// Order routes (outlet context required — resolved via X-Outlet-Id header)
apiRouter.post('/orders', requireAuth, authorizeTenantAccess, resolveOutletContext, createOrder);
apiRouter.get('/orders/summary', requireAuth, authorizeTenantAccess, resolveOutletContext, getOrderSummary);
apiRouter.get('/orders', requireAuth, authorizeTenantAccess, resolveOutletContext, listOrders);
apiRouter.patch('/orders/:id/refund', requireAuth, authorizeTenantAccess, requireAdminOrOwner, refundOrder);
apiRouter.get('/orders/:id', requireAuth, authorizeTenantAccess, resolveOutletContext, getOrder);

// Outlet routes
apiRouter.get('/outlets', requireAuth, authorizeTenantAccess, listOutlets);
apiRouter.post('/outlets', requireAuth, authorizeTenantAccess, requireAdminOrOwner, createOutlet);
apiRouter.get('/outlets/:id', requireAuth, authorizeTenantAccess, getOutlet);
apiRouter.put('/outlets/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, updateOutlet);
apiRouter.delete('/outlets/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, deactivateOutlet);

// User-Outlet Assignment & Info
apiRouter.get('/users/me/outlets', requireAuth, authorizeTenantAccess, getMyOutlets);
apiRouter.post('/users/:id/outlets', requireAuth, authorizeTenantAccess, requireAdminOrOwner, assignUserOutlets);

// Floor Plan routes (outlet context required)
apiRouter.get('/floor-plans', requireAuth, authorizeTenantAccess, resolveOutletContext, listFloorPlans);
apiRouter.get('/floor-plans/:id', requireAuth, authorizeTenantAccess, resolveOutletContext, getFloorPlan);
apiRouter.post('/floor-plans', requireAuth, authorizeTenantAccess, requireAdminOrOwner, resolveOutletContext, createFloorPlan);
apiRouter.put('/floor-plans/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, resolveOutletContext, updateFloorPlan);
apiRouter.delete('/floor-plans/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, resolveOutletContext, deleteFloorPlan);

// Table routes
apiRouter.get('/tables', requireAuth, authorizeTenantAccess, resolveOutletContext, listTables);
apiRouter.post('/tables', requireAuth, authorizeTenantAccess, requireAdminOrOwner, resolveOutletContext, createTable);
apiRouter.put('/tables/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, resolveOutletContext, updateTable);
apiRouter.delete('/tables/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, resolveOutletContext, deleteTable);
apiRouter.patch('/tables/:id/status', requireAuth, authorizeTenantAccess, resolveOutletContext, updateTableStatus);
apiRouter.post('/tables/bulk-positions', requireAuth, authorizeTenantAccess, requireAdminOrOwner, resolveOutletContext, bulkUpdatePositions);

// Loyalty routes — middleware applied at prefix level
const loyaltyMW = [requireAuth, authorizeTenantAccess, requireAdminOrOwner, requireLoyaltyAccess];
apiRouter.use('/loyalty-programs', ...loyaltyMW);
apiRouter.use('/loyalty-coupons', ...loyaltyMW);
apiRouter.use('/loyalty-members', ...loyaltyMW);
apiRouter.use('/loyalty-rewards', ...loyaltyMW);

apiRouter.get('/loyalty-programs', listPrograms);
apiRouter.post('/loyalty-programs', createProgram);
apiRouter.get('/loyalty-programs/:id', getProgram);
apiRouter.put('/loyalty-programs/:id', updateProgram);
apiRouter.delete('/loyalty-programs/:id', deleteProgram);

apiRouter.get('/loyalty-programs/:id/outlets', listProgramOutlets);
apiRouter.post('/loyalty-programs/:id/outlets', assignOutlet);
apiRouter.delete('/loyalty-programs/:id/outlets/:outletId', removeOutlet);

apiRouter.get('/loyalty-programs/by-outlet/:outletId', requireAuth, authorizeTenantAccess, requireLoyaltyAccess, getActiveProgramByOutlet);

apiRouter.get('/loyalty-programs/:programId/rewards', listRewards);
apiRouter.post('/loyalty-programs/:programId/rewards', createReward);
apiRouter.put('/loyalty-rewards/:id', updateReward);
apiRouter.delete('/loyalty-rewards/:id', deleteReward);

apiRouter.get('/loyalty-coupons', listCoupons);
apiRouter.post('/loyalty-coupons', createCoupon);
apiRouter.put('/loyalty-coupons/:id', updateCoupon);
apiRouter.delete('/loyalty-coupons/:id', deleteCoupon);
apiRouter.post('/loyalty-coupons/validate', requireAuth, authorizeTenantAccess, requireLoyaltyAccess, validateCouponHandler);

apiRouter.post('/loyalty-members/lookup', lookupMember);
apiRouter.get('/loyalty-members', listMembers);
apiRouter.get('/loyalty-members/:id', getMemberDetail);
apiRouter.get('/loyalty-members/:id/redeemable-rewards', getRedeemableRewards);

apiRouter.post('/orders/:orderId/earn-points', requireAuth, authorizeTenantAccess, requireLoyaltyAccess, resolveOutletContext, earnPointsHandler);

// Customer routes
apiRouter.post('/customers', requireAuth, authorizeTenantAccess, requireAdminOrOwner, createCustomer);
apiRouter.get('/customers', requireAuth, authorizeTenantAccess, requireAdminOrOwner, listCustomers);
apiRouter.get('/customers/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, getCustomer);
apiRouter.post('/customers/:id/points/adjust', requireAuth, authorizeTenantAccess, requireAdminOrOwner, resolveOutletContext, adjustCustomerPoints);
apiRouter.post('/customers/:customerId/programs', requireAuth, authorizeTenantAccess, requireAdminOrOwner, enrollCustomer);

// Promotion routes
apiRouter.get('/promotions/active', requireAuth, authorizeTenantAccess, resolveOutletContext, getActivePromotions);
apiRouter.post('/promotions', requireAuth, authorizeTenantAccess, requireAdminOrOwner, createPromotion);
apiRouter.get('/promotions', requireAuth, authorizeTenantAccess, requireAdminOrOwner, listPromotions);
apiRouter.put('/promotions/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, updatePromotion);
apiRouter.delete('/promotions/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, deletePromotion);
apiRouter.put('/promotions/:id/outlets', requireAuth, authorizeTenantAccess, requireAdminOrOwner, updatePromotionOutlets);
apiRouter.get('/promotions/:id', requireAuth, authorizeTenantAccess, requireAdminOrOwner, getPromotion);

// 404 catch-all for unmatched API routes
apiRouter.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
  });
});

export default apiRouter;
