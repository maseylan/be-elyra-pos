import { Router, Request, Response } from 'express';
import { requireSessionType } from '../middlewares/require-session-type.middleware';

const router = Router();

// All billing routes require owner-billing session type
router.use(requireSessionType('owner-billing'));

router.get('/subscription', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' });
});

router.get('/invoices', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
