import { Router } from 'express';
import {
  getSelfOrderStatus,
  getSelfOrderCatalog,
  createSelfOrder,
} from '../controllers/self-order.controller';

const publicSelfOrderRouter = Router();

publicSelfOrderRouter.get('/:outletId/self-order/status', getSelfOrderStatus);
publicSelfOrderRouter.get('/:outletId/self-order/catalog', getSelfOrderCatalog);
publicSelfOrderRouter.post('/:outletId/self-order/orders', createSelfOrder);

export default publicSelfOrderRouter;
