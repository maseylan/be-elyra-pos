import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as loyaltyService from '../services/loyalty.service';
import { getCurrentTenant } from '../contexts/tenant-context';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

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
export const listPrograms = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const programs = await loyaltyService.listPrograms();
  res.json(programs);
});

export const getProgram = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const id = p(req.params, 'id');
  const program = await loyaltyService.getProgram(id);
  if (!program) return res.status(404).json({ error: 'Program not found' });
  res.json(program);
});

const createProgramSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  pointsPerUnit: z.number().int().positive().default(1),
  unitAmount: z.number().int().positive().default(1000),
});

export const createProgram = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = createProgramSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const program = await loyaltyService.createProgram(parsed.data);
  res.status(201).json(program);
});

const updateProgramSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  pointsPerUnit: z.number().int().positive().optional(),
  unitAmount: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const updateProgram = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = updateProgramSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const id = p(req.params, 'id');
  const program = await loyaltyService.updateProgram(id, parsed.data);
  res.json(program);
});

export const deleteProgram = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const id = p(req.params, 'id');
  await loyaltyService.deleteProgram(id);
  res.json({ message: 'Program deleted' });
});

// ----- Outlet-Program Assignment -----
export const listProgramOutlets = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const id = p(req.params, 'id');
  const outlets = await loyaltyService.listProgramOutlets(id);
  res.json(outlets);
});

const assignOutletSchema = z.object({
  outletId: z.string().uuid(),
});

export const assignOutlet = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = assignOutletSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const id = p(req.params, 'id');
  const result = await loyaltyService.assignOutletToProgram(id, parsed.data.outletId);
  res.status(201).json(result);
});

export const removeOutlet = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const id = p(req.params, 'id');
  const outletId = p(req.params, 'outletId');
  await loyaltyService.removeOutletFromProgram(id, outletId);
  res.json({ message: 'Outlet removed from program' });
});

export const getActiveProgramByOutlet = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const outletId = p(req.params, 'outletId');
  const program = await loyaltyService.getActiveProgramByOutlet(outletId);
  res.json(program);
});

// ----- Rewards -----
export const listRewards = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const programId = p(req.params, 'programId');
  const rewards = await loyaltyService.listRewards(programId);
  res.json(rewards);
});

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

export const createReward = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = createRewardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const programId = p(req.params, 'programId');
  const reward = await loyaltyService.createReward(programId, parsed.data);
  res.status(201).json(reward);
});

export const updateReward = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const id = p(req.params, 'id');
  const reward = await loyaltyService.updateReward(id, req.body);
  res.json(reward);
});

export const deleteReward = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const id = p(req.params, 'id');
  await loyaltyService.deleteReward(id);
  res.json({ message: 'Reward deleted' });
});

// ----- Coupons -----
export const listCoupons = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const coupons = await loyaltyService.listCoupons();
  res.json(coupons);
});

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

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = createCouponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  try {
    const coupon = await loyaltyService.createCoupon(parsed.data);
    res.status(201).json(coupon);
  } catch (error: any) {
    if (error.message?.includes('unique')) throw new HttpError(409, 'Coupon code already exists');
    throw error;
  }
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const id = p(req.params, 'id');
  const coupon = await loyaltyService.updateCoupon(id, req.body);
  res.json(coupon);
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const id = p(req.params, 'id');
  await loyaltyService.deleteCoupon(id);
  res.json({ message: 'Coupon deleted' });
});

const validateCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().min(0),
  memberId: z.string().uuid().optional(),
});

export const validateCouponHandler = asyncHandler(async (req: Request, res: Response) => {
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
      throw new HttpError(400, `Minimal pembelian Rp ${Number(min).toLocaleString('id-ID')}`);
    }
    throw new HttpError(400, msgs[key] || 'Kode promo tidak valid');
  }
});

// ----- Members -----
const lookupMemberSchema = z.object({
  phone: z.string().min(1),
  name: z.string().optional(),
  email: z.string().optional(),
});

export const lookupMember = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = lookupMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  const existing = await loyaltyService.findMemberByPhone(parsed.data.phone);
  if (existing) return res.json({ member: existing.member, customer: existing.customer, isNew: false });

  const customer = await loyaltyService.findOrCreateCustomer(parsed.data);
  const member = await loyaltyService.getOrCreateMember(customer.id);
  res.json({ member, customer, isNew: true });
});

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const search = req.query.search as string | undefined;
  const members = await loyaltyService.listMembers(search);
  res.json(members);
});

export const getMemberDetail = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const id = p(req.params, 'id');
  const detail = await loyaltyService.getMemberDetail(id);
  if (!detail) return res.status(404).json({ error: 'Member not found' });
  res.json(detail);
});

export const getRedeemableRewards = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const memberId = p(req.params, 'memberId');
  const rewards = await loyaltyService.getRedeemableRewards(memberId);
  res.json(rewards);
});

// ----- Cashier: Earn Points on Order Completion -----
const earnPointsSchema = z.object({
  memberId: z.string().uuid(),
  programId: z.string().uuid(),
  subtotal: z.number().min(0),
});

export const earnPointsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!checkSubscription(res)) return;
  const parsed = earnPointsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
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
});
