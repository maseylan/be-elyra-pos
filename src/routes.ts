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
import { requireRole, authorizeTenantAccess, requireLoyaltyAccess } from './middlewares/auth.middleware';
import { requireSessionType } from './middlewares/require-session-type.middleware';
import {
  listPrograms, getProgram, createProgram, updateProgram, deleteProgram,
  listProgramOutlets, assignOutlet, removeOutlet, getActiveProgramByOutlet,
  listRewards, createReward, updateReward, deleteReward,
  listCoupons, createCoupon, updateCoupon, deleteCoupon, validateCouponHandler,
  lookupMember, listMembers, getMemberDetail, getRedeemableRewards,
  earnPointsHandler,
} from './controllers/loyalty.controller';
import { resolveOutletContext, resolveOptionalOutletContext } from './middlewares/outlet-context.middleware';

import { createVariant, getVariants, updateVariant, deleteVariant, updateOutletVariant } from './controllers/variant.controller';
import { createModifierGroup, getModifierGroups, createModifier, updateModifierGroup, updateModifier, deleteModifier, updateOutletModifier } from './controllers/modifier.controller';
import { createAddOn, getAddOns, attachAddOn, detachAddOn, updateOutletAddOn } from './controllers/addon.controller';
import { getActiveSession, openSession, closeSession, forceCloseSession, getSessionHistory, getTerminalStatus, createCashMovement, getCashMovements } from './controllers/session.controller';
import { getPendingQROrders, claimPendingQROrder } from './controllers/self-order.controller';
import { printRaw, getQzCertificate, signQzRequest } from './controllers/print.controller';

const apiRouter = Router();

// All routes in this router require tenant-operational session type
apiRouter.use(requireSessionType('tenant-operational'));
apiRouter.use(authorizeTenantAccess);

const requireAdminOrOwner = requireRole(['admin', 'owner']);

// Protected Tenant Admin/Owner/Cashier Routes
apiRouter.get('/products', getProducts);
apiRouter.get('/products/low-stock', resolveOptionalOutletContext, getLowStockProducts);
apiRouter.get('/products/:id', getProductById);
apiRouter.post('/products', requireAdminOrOwner, createProduct);
apiRouter.put('/products/:id', requireAdminOrOwner, updateProduct);
apiRouter.delete('/products/:id', requireAdminOrOwner, deleteProduct);

// Product Variant Routes
apiRouter.post('/products/:productId/variants', requireAdminOrOwner, createVariant);
apiRouter.get('/products/:productId/variants', resolveOutletContext, getVariants);
apiRouter.patch('/variants/:variantId', requireAdminOrOwner, updateVariant);
apiRouter.delete('/variants/:variantId', requireAdminOrOwner, deleteVariant);
apiRouter.put('/outlets/:outletId/variants/:variantId', requireAdminOrOwner, resolveOutletContext, updateOutletVariant);

// Modifier Group & Item Routes
apiRouter.post('/products/:productId/modifier-groups', requireAdminOrOwner, createModifierGroup);
apiRouter.get('/products/:productId/modifier-groups', resolveOutletContext, getModifierGroups);
apiRouter.post('/modifier-groups/:groupId/modifiers', requireAdminOrOwner, createModifier);
apiRouter.patch('/modifier-groups/:groupId', requireAdminOrOwner, updateModifierGroup);
apiRouter.patch('/modifiers/:modifierId', requireAdminOrOwner, updateModifier);
apiRouter.delete('/modifiers/:modifierId', requireAdminOrOwner, deleteModifier);
apiRouter.put('/outlets/:outletId/modifiers/:modifierId', requireAdminOrOwner, resolveOutletContext, updateOutletModifier);

// Add-on Routes (supporting both /add-ons and /addons endpoints)
apiRouter.post('/add-ons', requireAdminOrOwner, createAddOn);
apiRouter.post('/addons', requireAdminOrOwner, createAddOn);

apiRouter.get('/add-ons', resolveOutletContext, getAddOns);
apiRouter.get('/addons', resolveOutletContext, getAddOns);

apiRouter.post('/products/:productId/add-ons', requireAdminOrOwner, attachAddOn);
apiRouter.post('/products/:productId/addons', requireAdminOrOwner, attachAddOn);

apiRouter.delete('/products/:productId/add-ons/:addOnId', requireAdminOrOwner, detachAddOn);
apiRouter.delete('/products/:productId/addons/:addOnId', requireAdminOrOwner, detachAddOn);

apiRouter.put('/outlets/:outletId/add-ons/:addOnId', requireAdminOrOwner, resolveOutletContext, updateOutletAddOn);
apiRouter.put('/outlets/:outletId/addons/:addOnId', requireAdminOrOwner, resolveOutletContext, updateOutletAddOn);


// Stock routes
apiRouter.get('/stock-movements', resolveOptionalOutletContext, getStockMovements);
apiRouter.post('/stock/adjust', requireAdminOrOwner, resolveOutletContext, adjustStock);

// Category routes
apiRouter.get('/categories', getCategories);
apiRouter.get('/categories/:id', getCategoryById);
apiRouter.post('/categories', requireAdminOrOwner, createCategory);
apiRouter.put('/categories/:id', requireAdminOrOwner, updateCategory);
apiRouter.delete('/categories/:id', requireAdminOrOwner, deleteCategory);

// Protected Tenant Admin/Owner Routes
apiRouter.get('/accounts', requireAdminOrOwner, getAccounts);
apiRouter.post('/accounts', requireAdminOrOwner, addAccount);
apiRouter.delete('/accounts/:accountId', requireAdminOrOwner, removeAccount);

// Settings routes
apiRouter.get('/settings', requireAdminOrOwner, getSettings);
apiRouter.put('/settings', requireAdminOrOwner, updateSettings);

// Outlet settings routes
apiRouter.get('/settings/outlet/:outletId', getOutletSettings);
apiRouter.put('/settings/outlet/:outletId', requireAdminOrOwner, updateOutletSettings);

// Shift Register Session routes
const requireSupervisorOrAdmin = requireRole(['supervisor', 'admin', 'owner']);

apiRouter.get('/sessions/active', resolveOutletContext, getActiveSession);
apiRouter.get('/sessions/terminals', resolveOutletContext, getTerminalStatus);
apiRouter.post('/sessions/open', resolveOutletContext, openSession);
apiRouter.post('/sessions/close', resolveOutletContext, closeSession);
apiRouter.post('/sessions/cash-movement', resolveOutletContext, createCashMovement);
apiRouter.get('/sessions/cash-movements', resolveOptionalOutletContext, getCashMovements);
apiRouter.post('/sessions/:id/force-close', requireSupervisorOrAdmin, forceCloseSession);
apiRouter.get('/sessions', resolveOptionalOutletContext, requireSupervisorOrAdmin, getSessionHistory);

// Order routes (outlet context required — resolved via X-Outlet-Id header)
apiRouter.get('/orders/pending-qr', resolveOutletContext, getPendingQROrders);
apiRouter.post('/orders/:orderId/claim-qr', resolveOutletContext, claimPendingQROrder);
apiRouter.post('/orders', resolveOutletContext, createOrder);
apiRouter.get('/orders/summary', resolveOptionalOutletContext, getOrderSummary);
apiRouter.get('/orders', resolveOptionalOutletContext, listOrders);
apiRouter.patch('/orders/:id/refund', requireAdminOrOwner, refundOrder);
apiRouter.get('/orders/:id', resolveOptionalOutletContext, getOrder);

// Raw ESC/POS print ke printer TCP (host whitelisted loopback)
apiRouter.post('/print/raw', resolveOutletContext, printRaw);

// Outlet routes
apiRouter.get('/outlets', listOutlets);
apiRouter.post('/outlets', requireAdminOrOwner, createOutlet);
apiRouter.get('/outlets/:id', getOutlet);
apiRouter.put('/outlets/:id', requireAdminOrOwner, updateOutlet);
apiRouter.delete('/outlets/:id', requireAdminOrOwner, deactivateOutlet);

// User-Outlet Assignment & Info
apiRouter.get('/users/me/outlets', getMyOutlets);
apiRouter.post('/users/:id/outlets', requireAdminOrOwner, assignUserOutlets);

// Floor Plan routes (outlet context required)
apiRouter.get('/floor-plans', resolveOutletContext, listFloorPlans);
apiRouter.get('/floor-plans/:id', resolveOutletContext, getFloorPlan);
apiRouter.post('/floor-plans', requireAdminOrOwner, resolveOutletContext, createFloorPlan);
apiRouter.put('/floor-plans/:id', requireAdminOrOwner, resolveOutletContext, updateFloorPlan);
apiRouter.delete('/floor-plans/:id', requireAdminOrOwner, resolveOutletContext, deleteFloorPlan);

// Table routes
apiRouter.get('/tables', resolveOutletContext, listTables);
apiRouter.post('/tables', requireAdminOrOwner, resolveOutletContext, createTable);
apiRouter.put('/tables/:id', requireAdminOrOwner, resolveOutletContext, updateTable);
apiRouter.delete('/tables/:id', requireAdminOrOwner, resolveOutletContext, deleteTable);
apiRouter.patch('/tables/:id/status', resolveOutletContext, updateTableStatus);
apiRouter.post('/tables/bulk-positions', requireAdminOrOwner, resolveOutletContext, bulkUpdatePositions);

// Loyalty routes — middleware applied at prefix level
const loyaltyMW = [requireAdminOrOwner, requireLoyaltyAccess];
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

apiRouter.get('/loyalty-programs/by-outlet/:outletId', requireLoyaltyAccess, getActiveProgramByOutlet);

apiRouter.get('/loyalty-programs/:programId/rewards', listRewards);
apiRouter.post('/loyalty-programs/:programId/rewards', createReward);
apiRouter.put('/loyalty-rewards/:id', updateReward);
apiRouter.delete('/loyalty-rewards/:id', deleteReward);

apiRouter.get('/loyalty-coupons', listCoupons);
apiRouter.post('/loyalty-coupons', createCoupon);
apiRouter.put('/loyalty-coupons/:id', updateCoupon);
apiRouter.delete('/loyalty-coupons/:id', deleteCoupon);
apiRouter.post('/loyalty-coupons/validate', requireLoyaltyAccess, validateCouponHandler);

apiRouter.post('/loyalty-members/lookup', lookupMember);
apiRouter.get('/loyalty-members', listMembers);
apiRouter.get('/loyalty-members/:id', getMemberDetail);
apiRouter.get('/loyalty-members/:id/redeemable-rewards', getRedeemableRewards);

apiRouter.post('/orders/:orderId/earn-points', requireLoyaltyAccess, resolveOutletContext, earnPointsHandler);

// Customer routes
apiRouter.post('/customers', requireAdminOrOwner, createCustomer);
apiRouter.get('/customers', requireAdminOrOwner, listCustomers);
apiRouter.get('/customers/:id', requireAdminOrOwner, getCustomer);
apiRouter.post('/customers/:id/points/adjust', requireAdminOrOwner, resolveOutletContext, adjustCustomerPoints);
apiRouter.post('/customers/:customerId/programs', requireAdminOrOwner, enrollCustomer);

// Promotion routes
apiRouter.get('/promotions/active', resolveOutletContext, getActivePromotions);
apiRouter.post('/promotions', requireAdminOrOwner, createPromotion);
apiRouter.get('/promotions', requireAdminOrOwner, listPromotions);
apiRouter.put('/promotions/:id', requireAdminOrOwner, updatePromotion);
apiRouter.delete('/promotions/:id', requireAdminOrOwner, deletePromotion);
apiRouter.get('/promotions/:id', requireAdminOrOwner, getPromotion);

// QZ Tray Code Signing Endpoints
apiRouter.get('/print/qz-certificate', getQzCertificate);
apiRouter.post('/print/sign-qz', signQzRequest);
apiRouter.get('/print/sign-qz', signQzRequest);

// 404 catch-all for unmatched API routes
apiRouter.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
  });
});

export default apiRouter;
