import { Request, Response } from 'express';
import { z } from 'zod';
import * as loyaltyService from '../services/loyalty.service';
import { getCurrentTenant } from '../contexts/tenant-context';

function p(params: any, key: string): string { return params[key] as string; }

function checkSubscription(res: Response): boolean {
  const { subscriptionType } = getCurrentTenant();
  if (subscriptionType === 'starter') {
    res.status(403).json({ error: 'Fitur Loyalty hanya tersedia untuk paket Pro dan Enterprise' });
    return false;
  }
  return true;
}

// ----- Programs -----
export const listPrograms = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const programs = await loyaltyService.listPrograms();
    res.json(programs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProgram = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const id = p(req.params, 'id');
    const program = await loyaltyService.getProgram(id);
    if (!program) return res.status(404).json({ error: 'Program not found' });
    res.json(program);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const createProgramSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  pointsPerUnit: z.number().int().positive().default(1),
  unitAmount: z.number().int().positive().default(1000),
});

export const createProgram = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = createProgramSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const program = await loyaltyService.createProgram(parsed.data);
    res.status(201).json(program);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const updateProgramSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  pointsPerUnit: z.number().int().positive().optional(),
  unitAmount: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const updateProgram = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = updateProgramSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const id = p(req.params, 'id');
    const program = await loyaltyService.updateProgram(id, parsed.data);
    res.json(program);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProgram = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const id = p(req.params, 'id');
    await loyaltyService.deleteProgram(id);
    res.json({ message: 'Program deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ----- Outlet-Program Assignment -----
export const listProgramOutlets = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const id = p(req.params, 'id');
    const outlets = await loyaltyService.listProgramOutlets(id);
    res.json(outlets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const assignOutletSchema = z.object({
  outletId: z.string().uuid(),
});

export const assignOutlet = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = assignOutletSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const id = p(req.params, 'id');
    const result = await loyaltyService.assignOutletToProgram(id, parsed.data.outletId);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const removeOutlet = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const id = p(req.params, 'id');
    const outletId = p(req.params, 'outletId');
    await loyaltyService.removeOutletFromProgram(id, outletId);
    res.json({ message: 'Outlet removed from program' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getActiveProgramByOutlet = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const outletId = p(req.params, 'outletId');
    const program = await loyaltyService.getActiveProgramByOutlet(outletId);
    res.json(program);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ----- Rewards -----
export const listRewards = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const programId = p(req.params, 'programId');
    const rewards = await loyaltyService.listRewards(programId);
    res.json(rewards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const createRewardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['fixed_discount', 'percentage_discount', 'free_item']),
  pointsCost: z.number().int().positive(),
  value: z.number().min(0),
  maxDiscount: z.number().optional(),
  productId: z.string().uuid().optional(),
  stock: z.number().int().optional(),
});

export const createReward = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = createRewardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const programId = p(req.params, 'programId');
    const reward = await loyaltyService.createReward(programId, parsed.data);
    res.status(201).json(reward);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateReward = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const id = p(req.params, 'id');
    const reward = await loyaltyService.updateReward(id, req.body);
    res.json(reward);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteReward = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const id = p(req.params, 'id');
    await loyaltyService.deleteReward(id);
    res.json({ message: 'Reward deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ----- Coupons -----
export const listCoupons = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const coupons = await loyaltyService.listCoupons();
    res.json(coupons);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const createCouponSchema = z.object({
  programId: z.string().uuid().optional(),
  code: z.string().min(1).transform(s => s.toUpperCase()),
  type: z.enum(['fixed_discount', 'percentage_discount', 'free_item']),
  value: z.number().min(0),
  maxDiscount: z.number().optional(),
  productId: z.string().uuid().optional(),
  minPurchase: z.number().optional(),
  usageLimit: z.number().int().positive().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  isSingleUse: z.boolean().optional(),
  memberId: z.string().uuid().optional(),
});

export const createCoupon = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = createCouponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const coupon = await loyaltyService.createCoupon(parsed.data);
    res.status(201).json(coupon);
  } catch (error: any) {
    if (error.message?.includes('unique')) return res.status(409).json({ error: 'Coupon code already exists' });
    res.status(500).json({ error: error.message });
  }
};

export const updateCoupon = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const id = p(req.params, 'id');
    const coupon = await loyaltyService.updateCoupon(id, req.body);
    res.json(coupon);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCoupon = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const id = p(req.params, 'id');
    await loyaltyService.deleteCoupon(id);
    res.json({ message: 'Coupon deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const validateCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().min(0),
  memberId: z.string().uuid().optional(),
});

export const validateCouponHandler = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = validateCouponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const result = await loyaltyService.validateCoupon(parsed.data.code, parsed.data.subtotal, parsed.data.memberId);
    res.json(result);
  } catch (error: any) {
    const msgs: Record<string, string> = {
      COUPON_NOT_FOUND: 'Kode promo tidak ditemukan',
      COUPON_INACTIVE: 'Kode promo tidak aktif',
      COUPON_NOT_YET_VALID: 'Kode promo belum berlaku',
      COUPON_EXPIRED: 'Kode promo sudah kadaluarsa',
      COUPON_USAGE_LIMIT_REACHED: 'Kode promo sudah mencapai batas pemakaian',
      COUPON_ALREADY_USED: 'Kode promo sudah pernah digunakan',
    };
    const key = error.message?.split(':')[0];
    if (error.message?.startsWith('COUPON_MIN_PURCHASE:')) {
      const min = error.message.split(':')[1];
      return res.status(400).json({ error: `Minimal pembelian Rp ${Number(min).toLocaleString('id-ID')}` });
    }
    res.status(400).json({ error: msgs[key] || 'Kode promo tidak valid' });
  }
};

// ----- Members -----
const lookupMemberSchema = z.object({
  phone: z.string().min(1),
  name: z.string().optional(),
  email: z.string().optional(),
});

export const lookupMember = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = lookupMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const existing = await loyaltyService.findMemberByPhone(parsed.data.phone);
    if (existing) return res.json({ member: existing.member, customer: existing.customer, isNew: false });

    const customer = await loyaltyService.findOrCreateCustomer(parsed.data);
    const member = await loyaltyService.getOrCreateMember(customer.id);
    res.json({ member, customer, isNew: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const listMembers = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const search = req.query.search as string | undefined;
    const members = await loyaltyService.listMembers(search);
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMemberDetail = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const id = p(req.params, 'id');
    const detail = await loyaltyService.getMemberDetail(id);
    if (!detail) return res.status(404).json({ error: 'Member not found' });
    res.json(detail);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRedeemableRewards = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  try {
    const memberId = p(req.params, 'memberId');
    const rewards = await loyaltyService.getRedeemableRewards(memberId);
    res.json(rewards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ----- Cashier: Earn Points on Order Completion -----
const earnPointsSchema = z.object({
  memberId: z.string().uuid(),
  programId: z.string().uuid(),
  subtotal: z.number().min(0),
});

export const earnPointsHandler = async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = earnPointsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const outletId = (req as any).outletId;
    if (!outletId) return res.status(400).json({ error: 'Outlet context required' });

    const program = await loyaltyService.getProgram(parsed.data.programId);
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const orderId = p(req.params, 'orderId');
    const points = await loyaltyService.calculateEarnedPoints(parsed.data.subtotal, program);

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const txn = await loyaltyService.earnPoints(parsed.data.memberId, parsed.data.programId, outletId, orderId, points, expiresAt);
    res.status(201).json({ points, transaction: txn });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
