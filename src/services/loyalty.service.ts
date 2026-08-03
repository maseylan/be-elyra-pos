import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import { eq, and, sql, desc, lte, gte, or, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { HttpError } from '../utils/errors';

// ----- Loyalty Programs -----
export async function listPrograms() {
  return withTenantDb(async (tx) => {
    return await tx.select().from(schema.loyaltyPrograms).orderBy(desc(schema.loyaltyPrograms.createdAt));
  });
}

export async function getProgram(id: string) {
  return withTenantDb(async (tx) => {
    const [program] = await tx.select().from(schema.loyaltyPrograms).where(eq(schema.loyaltyPrograms.id, id)).limit(1);
    return program || null;
  });
}

export async function createProgram(data: { name: string; description?: string; pointsPerUnit?: number; unitAmount?: number }) {
  return withTenantDb(async (tx) => {
    const [program] = await tx.insert(schema.loyaltyPrograms).values({
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      pointsPerUnit: data.pointsPerUnit ?? 1,
      unitAmount: data.unitAmount ?? 1000,
    }).returning();
    return program;
  });
}

export async function updateProgram(id: string, data: { name?: string; description?: string; pointsPerUnit?: number; unitAmount?: number; isActive?: boolean }) {
  return withTenantDb(async (tx) => {
    const [program] = await tx.update(schema.loyaltyPrograms).set({ ...data, updatedAt: new Date() }).where(eq(schema.loyaltyPrograms.id, id)).returning();
    return program;
  });
}

export async function deleteProgram(id: string) {
  return withTenantDb(async (tx) => {
    await tx.delete(schema.loyaltyPrograms).where(eq(schema.loyaltyPrograms.id, id));
  });
}

// ----- Outlet-Program Assignment -----
export async function listProgramOutlets(programId: string) {
  return withTenantDb(async (tx) => {
    return await tx.select().from(schema.outletLoyaltyPrograms)
      .leftJoin(schema.outlets, eq(schema.outletLoyaltyPrograms.outletId, schema.outlets.id))
      .where(eq(schema.outletLoyaltyPrograms.programId, programId));
  });
}

export async function assignOutletToProgram(programId: string, outletId: string) {
  return withTenantDb(async (tx) => {
    const [assignment] = await tx.insert(schema.outletLoyaltyPrograms).values({
      id: crypto.randomUUID(),
      outletId,
      programId,
    }).returning();
    return assignment;
  });
}

export async function removeOutletFromProgram(programId: string, outletId: string) {
  return withTenantDb(async (tx) => {
    await tx.delete(schema.outletLoyaltyPrograms).where(
      and(eq(schema.outletLoyaltyPrograms.programId, programId), eq(schema.outletLoyaltyPrograms.outletId, outletId))
    );
  });
}

export async function getActiveProgramByOutlet(outletId: string) {
  return withTenantDb(async (tx) => {
    const result = await tx.select().from(schema.outletLoyaltyPrograms)
      .innerJoin(schema.loyaltyPrograms, eq(schema.outletLoyaltyPrograms.programId, schema.loyaltyPrograms.id))
      .where(and(
        eq(schema.outletLoyaltyPrograms.outletId, outletId),
        eq(schema.outletLoyaltyPrograms.isActive, true),
        eq(schema.loyaltyPrograms.isActive, true),
      ))
      .limit(1);
    return result.length > 0 ? result[0].loyalty_programs : null;
  });
}

// ----- Rewards -----
export async function listRewards(programId: string) {
  return withTenantDb(async (tx) => {
    return await tx.select().from(schema.loyaltyRewards)
      .where(eq(schema.loyaltyRewards.programId, programId))
      .orderBy(schema.loyaltyRewards.createdAt);
  });
}

export async function createReward(programId: string, data: {
  name: string; description?: string; type: string; pointsCost: number;
  value: number; maxDiscount?: number; productId?: string; stock?: number;
}) {
  return withTenantDb(async (tx) => {
    const [reward] = await tx.insert(schema.loyaltyRewards).values({
      id: crypto.randomUUID(),
      programId,
      name: data.name,
      description: data.description,
      type: data.type,
      pointsCost: data.pointsCost,
      value: String(data.value),
      maxDiscount: data.maxDiscount ? String(data.maxDiscount) : null,
      productId: data.productId || null,
      stock: data.stock ?? null,
    }).returning();
    return reward;
  });
}

export async function updateReward(id: string, data: any) {
  return withTenantDb(async (tx) => {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.value) updateData.value = String(data.value);
    if (data.maxDiscount) updateData.maxDiscount = String(data.maxDiscount);
    if (data.minPurchase) updateData.minPurchase = String(data.minPurchase);
    const [reward] = await tx.update(schema.loyaltyRewards).set(updateData).where(eq(schema.loyaltyRewards.id, id)).returning();
    return reward;
  });
}

export async function deleteReward(id: string) {
  return withTenantDb(async (tx) => {
    await tx.delete(schema.loyaltyRewards).where(eq(schema.loyaltyRewards.id, id));
  });
}

// ----- Coupons -----
export async function listCoupons() {
  return withTenantDb(async (tx) => {
    return await tx.select().from(schema.loyaltyCoupons).orderBy(desc(schema.loyaltyCoupons.createdAt));
  });
}

export async function createCoupon(data: {
  programId?: string; code: string; type: string; value: number;
  maxDiscount?: number; productId?: string; minPurchase?: number;
  usageLimit?: number; validFrom?: string; validUntil?: string;
  isSingleUse?: boolean; memberId?: string;
}) {
  return withTenantDb(async (tx) => {
    const [coupon] = await tx.insert(schema.loyaltyCoupons).values({
      id: crypto.randomUUID(),
      programId: data.programId || null,
      code: data.code.toUpperCase(),
      type: data.type,
      value: String(data.value),
      maxDiscount: data.maxDiscount ? String(data.maxDiscount) : null,
      productId: data.productId || null,
      minPurchase: data.minPurchase ? String(data.minPurchase) : null,
      usageLimit: data.usageLimit ?? null,
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      isSingleUse: data.isSingleUse ?? false,
      memberId: data.memberId || null,
    }).returning();
    return coupon;
  });
}

export async function updateCoupon(id: string, data: any) {
  return withTenantDb(async (tx) => {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.value) updateData.value = String(data.value);
    if (data.maxDiscount) updateData.maxDiscount = String(data.maxDiscount);
    if (data.minPurchase) updateData.minPurchase = String(data.minPurchase);
    if (data.validFrom) updateData.validFrom = new Date(data.validFrom);
    if (data.validUntil) updateData.validUntil = new Date(data.validUntil);
    if (data.code) updateData.code = data.code.toUpperCase();
    const [coupon] = await tx.update(schema.loyaltyCoupons).set(updateData).where(eq(schema.loyaltyCoupons.id, id)).returning();
    return coupon;
  });
}

export async function deleteCoupon(id: string) {
  return withTenantDb(async (tx) => {
    await tx.delete(schema.loyaltyCoupons).where(eq(schema.loyaltyCoupons.id, id));
  });
}

export async function validateCoupon(code: string, subtotal: number, memberId?: string, outletId?: string, tx?: any) {
  const run = async (client: any) => {
    const [coupon] = await client.select().from(schema.loyaltyCoupons)
      .where(eq(schema.loyaltyCoupons.code, code.toUpperCase())).for('update').limit(1);

    if (!coupon) throw new HttpError(400, 'COUPON_NOT_FOUND');
    if (!coupon.isActive) throw new HttpError(400, 'COUPON_INACTIVE');

    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) throw new HttpError(400, 'COUPON_NOT_YET_VALID');
    if (coupon.validUntil && coupon.validUntil < now) throw new HttpError(400, 'COUPON_EXPIRED');

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new HttpError(409, 'COUPON_USAGE_LIMIT_REACHED');

    if (coupon.minPurchase && subtotal < Number(coupon.minPurchase)) {
      throw new HttpError(400, `COUPON_MIN_PURCHASE:${coupon.minPurchase}`);
    }

    if (coupon.isSingleUse && memberId) {
      const [usage] = await client.select().from(schema.loyaltyCouponUsages)
        .where(and(
          eq(schema.loyaltyCouponUsages.couponId, coupon.id),
          eq(schema.loyaltyCouponUsages.memberId, memberId),
        )).limit(1);
      if (usage) throw new HttpError(409, 'COUPON_ALREADY_USED');
    }

    let discountAmount = Number(coupon.value);
    if (coupon.type === 'percentage_discount') {
      discountAmount = Math.round(subtotal * discountAmount / 100);
      if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
    }
    discountAmount = Math.min(discountAmount, subtotal);

    return { coupon, discountAmount };
  };
  // ponytail: tx param lets caller validate inside its own transaction; standalone keeps API for /coupons/validate
  return tx ? run(tx) : withTenantDb(run);
}

// ----- Customers / Members -----
export async function findOrCreateCustomer(data: { name?: string; phone: string; email?: string }) {
  return withTenantDb(async (tx) => {
    let [customer] = await tx.select().from(schema.customers).where(eq(schema.customers.phone, data.phone)).limit(1);
    if (!customer) {
      [customer] = await tx.insert(schema.customers).values({
        id: crypto.randomUUID(),
        name: data.name || `Pelanggan ${data.phone}`,
        phone: data.phone,
        email: data.email,
      }).returning();
    }
    return customer;
  });
}

export async function getOrCreateMember(customerId: string) {
  return withTenantDb(async (tx) => {
    let [member] = await tx.select().from(schema.loyaltyMembers)
      .where(eq(schema.loyaltyMembers.customerId, customerId)).limit(1);
    if (!member) {
      [member] = await tx.insert(schema.loyaltyMembers).values({
        id: crypto.randomUUID(),
        customerId,
      }).returning();
    }
    return member;
  });
}

export async function findMemberByPhone(phone: string) {
  return withTenantDb(async (tx) => {
    const result = await tx.select().from(schema.loyaltyMembers)
      .innerJoin(schema.customers, eq(schema.loyaltyMembers.customerId, schema.customers.id))
      .where(eq(schema.customers.phone, phone))
      .limit(1);
    if (result.length === 0) return null;
    return { member: result[0].loyalty_members, customer: result[0].customers };
  });
}

export async function listMembers(search?: string) {
  return withTenantDb(async (tx) => {
    let query = tx.select().from(schema.loyaltyMembers)
      .innerJoin(schema.customers, eq(schema.loyaltyMembers.customerId, schema.customers.id));

    if (search) {
      query = query.where(
        or(
          sql`${schema.customers.name} ILIKE ${`%${search}%`}`,
          sql`${schema.customers.phone} ILIKE ${`%${search}%`}`,
        )
      );
    }

    return await query.orderBy(desc(schema.loyaltyMembers.createdAt)).limit(50);
  });
}

export async function getMemberDetail(memberId: string) {
  return withTenantDb(async (tx) => {
    const [result] = await tx.select().from(schema.loyaltyMembers)
      .innerJoin(schema.customers, eq(schema.loyaltyMembers.customerId, schema.customers.id))
      .where(eq(schema.loyaltyMembers.id, memberId))
      .limit(1);
    if (!result) return null;

    const programPoints = await tx.select({
      programId: schema.loyaltyPointsTransactions.programId,
      totalPoints: sql<number>`COALESCE(SUM(${schema.loyaltyPointsTransactions.points}), 0)`,
    })
      .from(schema.loyaltyPointsTransactions)
      .where(and(
        eq(schema.loyaltyPointsTransactions.memberId, memberId),
        or(
          isNull(schema.loyaltyPointsTransactions.expiresAt),
          gte(schema.loyaltyPointsTransactions.expiresAt, new Date()),
        ),
      ))
      .groupBy(schema.loyaltyPointsTransactions.programId);

    const recentPoints = await tx.select()
      .from(schema.loyaltyPointsTransactions)
      .where(eq(schema.loyaltyPointsTransactions.memberId, memberId))
      .orderBy(desc(schema.loyaltyPointsTransactions.createdAt))
      .limit(20);

    return { member: result.loyalty_members, customer: result.customers, programPoints, recentPoints };
  });
}

export async function getRedeemableRewards(memberId: string) {
  return withTenantDb(async (tx) => {
    const programs = await tx.select({
      programId: schema.loyaltyMemberPrograms.programId,
    }).from(schema.loyaltyMemberPrograms)
      .where(eq(schema.loyaltyMemberPrograms.memberId, memberId));

    if (programs.length === 0) return [];

    const programIds: string[] = programs.map((p: any) => p.programId);
    const balances: Array<{ programId: string; totalPoints: number }> = await tx.select({
      programId: schema.loyaltyPointsTransactions.programId,
      totalPoints: sql<number>`COALESCE(SUM(${schema.loyaltyPointsTransactions.points}), 0)`,
    })
      .from(schema.loyaltyPointsTransactions)
      .where(and(
        eq(schema.loyaltyPointsTransactions.memberId, memberId),
        or(
          isNull(schema.loyaltyPointsTransactions.expiresAt),
          gte(schema.loyaltyPointsTransactions.expiresAt, new Date()),
        ),
      ))
      .groupBy(schema.loyaltyPointsTransactions.programId);

    const balanceMap = new Map(balances.map(b => [b.programId, b.totalPoints]));

    const rewards: any[] = await tx.select().from(schema.loyaltyRewards)
      .where(and(
        sql`${schema.loyaltyRewards.programId} = ANY(${programIds}::uuid[])`,
        eq(schema.loyaltyRewards.isActive, true),
      ));

    return rewards.map(r => ({
      ...r,
      memberPoints: balanceMap.get(r.programId) || 0,
      canRedeem: (balanceMap.get(r.programId) || 0) >= r.pointsCost,
    }));
  });
}

// ----- Points -----
export async function earnPoints(memberId: string, programId: string, outletId: string, orderId: string, points: number, expiresAt?: Date) {
  return withTenantDb(async (tx) => {
    const [txn] = await tx.insert(schema.loyaltyPointsTransactions).values({
      id: crypto.randomUUID(),
      memberId,
      programId,
      orderId,
      outletId,
      points,
      type: 'earn',
      expiresAt: expiresAt || null,
    }).returning();
    return txn;
  });
}

export async function redeemPoints(memberId: string, reward: any, orderId: string, outletId: string) {
  return withTenantDb(async (tx) => {
    const now = new Date();

    const [txn] = await tx.insert(schema.loyaltyPointsTransactions).values({
      id: crypto.randomUUID(),
      memberId,
      programId: reward.programId,
      orderId,
      outletId,
      points: -reward.pointsCost,
      type: 'redeem',
      expiresAt: null,
    }).returning();

    const [redemption] = await tx.insert(schema.loyaltyRewardRedemptions).values({
      id: crypto.randomUUID(),
      rewardId: reward.id,
      memberId,
      orderId,
      programId: reward.programId,
      pointsCost: reward.pointsCost,
      status: 'claimed',
      claimedAt: now,
    }).returning();

    if (reward.stock !== null) {
      await tx.update(schema.loyaltyRewards)
        .set({ stock: sql`${schema.loyaltyRewards.stock} - 1` })
        .where(eq(schema.loyaltyRewards.id, reward.id));
    }

    return { transaction: txn, redemption };
  });
}

export async function recordCouponUsage(orderId: string, couponId: string, discountAmount: number, memberId?: string) {
  return withTenantDb(async (tx) => {
    await tx.insert(schema.loyaltyCouponUsages).values({
      id: crypto.randomUUID(),
      couponId,
      orderId,
      memberId: memberId || null,
      discountAmount: String(discountAmount),
    });

    await tx.update(schema.loyaltyCoupons)
      .set({ usedCount: sql`${schema.loyaltyCoupons.usedCount} + 1` })
      .where(eq(schema.loyaltyCoupons.id, couponId));
  });
}

export async function getOrderForEarnPoints(orderId: string, outletId: string, memberId: string) {
  return withTenantDb(async (tx) => {
    const [order] = await tx.select()
      .from(schema.orders)
      .where(and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.outletId, outletId),
        eq(schema.orders.memberId, memberId),
        eq(schema.orders.status, 'completed'),
      ))
      .limit(1);
    return order || null;
  });
}

export async function getEarnedPointsForOrder(orderId: string) {
  return withTenantDb(async (tx) => {
    const [txn] = await tx.select()
      .from(schema.loyaltyPointsTransactions)
      .where(and(
        eq(schema.loyaltyPointsTransactions.orderId, orderId),
        eq(schema.loyaltyPointsTransactions.type, 'earn'),
      ))
      .limit(1);
    return txn || null;
  });
}

export async function getMemberPointsByProgram(memberId: string, programId: string) {
  return withTenantDb(async (tx) => {
    const [result] = await tx.select({
      totalPoints: sql<number>`COALESCE(SUM(${schema.loyaltyPointsTransactions.points}), 0)`,
    }).from(schema.loyaltyPointsTransactions)
      .where(and(
        eq(schema.loyaltyPointsTransactions.memberId, memberId),
        eq(schema.loyaltyPointsTransactions.programId, programId),
        or(
          isNull(schema.loyaltyPointsTransactions.expiresAt),
          gte(schema.loyaltyPointsTransactions.expiresAt, new Date()),
        ),
      ));
    return result?.totalPoints || 0;
  });
}

export async function calculateEarnedPoints(subtotal: number, program: { pointsPerUnit: number; unitAmount: number }) {
  return Math.floor(subtotal / program.unitAmount) * program.pointsPerUnit;
}
