import { Router } from 'express';
import { requireSessionType } from '../middlewares/require-session-type.middleware';
import * as controller from '../controllers/owner-billing.controller';

const router = Router();

router.use(requireSessionType('owner-billing'));

router.get('/subscription', controller.getSubscription);
router.get('/plans', controller.getAvailablePlans);
router.get('/invoices', controller.getInvoices);
router.get('/invoices/:id', controller.getInvoiceDetail);
router.get('/invoices/:id/pdf', controller.getInvoicePdf);
router.post('/upgrade', controller.upgradePlan);

export default router;
