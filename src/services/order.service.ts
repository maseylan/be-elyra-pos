import { withTenantSchema } from '../db/with-tenant-schema';
import * as schema from '../db/tenant_schema';
import * as loyaltyService from './loyalty.service';
import { eq, desc, sql, and, gte, lte, or } from 'drizzle-orm';
import crypto from 'crypto';

interface CreateOrderInput {
  items: Array<{
    productId: string;
    productName?: string;
    quantity: number;
    price: number;
    subtotal: number;
    notes?: string;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  roundingAmount: number;
  paymentMethod: string;
  amountPaid: number;
  changeAmount: number;
  tableNumber?: string;
  cashierId?: string;
  cashierName?: string;
  idempotencyKey: string;
  memberId?: string;
  couponCode?: string;
  redeemedRewardId?: string;
}

function padSeq(n: number, len = 4): string {
  return String(n).padStart(len, '0');
}

export async function createOrder(outletId: string, input: CreateOrderInput) {
  return withTenantSchema(async (tx) => {
    // Fetch outlet + settings for order number generation
    const [outlet] = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, outletId)).limit(1);
    const [tenantDefault] = await tx.select().from(schema.tenantSettings).where(eq(schema.tenantSettings.id, 'default'));
    const [override] = await tx.select().from(schema.outletSettings).where(eq(schema.outletSettings.outletId, outletId));

    const autoGenerate = override?.autoGenerateOrderNumberOverride ?? tenantDefault?.autoGenerateOrderNumber ?? true;
    const numFormat = override?.orderNumberingFormatOverride ?? tenantDefault?.orderNumberingFormat ?? '{OUTLET}-{YYYYMMDD}-{SEQ}';
    const seqReset = override?.orderSequenceResetOverride ?? tenantDefault?.orderSequenceReset ?? 'daily';

    let orderNumber: string | undefined;
    if (autoGenerate) {
      const outletCode = outlet?.code || 'OUT';
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      let seq = 0;
      if (seqReset === 'daily') {
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(schema.orders)
          .where(sql`${schema.orders.outletId} = ${outletId} AND ${schema.orders.createdAt}::date = CURRENT_DATE`);
        seq = Number(count) + 1;
      } else {
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(schema.orders)
          .where(eq(schema.orders.outletId, outletId));
        seq = Number(count) + 1;
      }

      orderNumber = numFormat
        .replace(/\{OUTLET\}/g, outletCode)
        .replace(/\{YYYYMMDD\}/g, today)
        .replace(/\{SEQ\}/g, padSeq(seq));
    }

    // Handle coupon if provided
    let couponId: string | undefined;
    if (input.couponCode && input.discountAmount > 0) {
      try {
        const { coupon } = await loyaltyService.validateCoupon(input.couponCode, input.subtotal, input.memberId, outletId);
        couponId = coupon.id;
      } catch {}
    }

    const [order] = await tx.insert(schema.orders).values({
      id: crypto.randomUUID(),
      idempotencyKey: input.idempotencyKey,
      outletId,
      subtotal: String(input.subtotal),
      taxAmount: String(input.taxAmount),
      discountAmount: String(input.discountAmount),
      totalAmount: String(input.totalAmount),
      roundingAmount: String(input.roundingAmount),
      orderNumber,
      paymentMethod: input.paymentMethod,
      amountPaid: String(input.amountPaid),
      changeAmount: String(input.changeAmount),
      tableNumber: input.tableNumber,
      cashierId: input.cashierId,
      cashierName: input.cashierName,
      memberId: input.memberId || null,
      couponId: couponId || null,
      redeemedRewardId: input.redeemedRewardId || null,
      status: 'completed',
    }).returning();

    if (input.items.length > 0) {
      await tx.insert(schema.orderItems).values(
        input.items.map(item => ({
          id: crypto.randomUUID(),
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: String(item.price),
          subtotal: String(item.subtotal),
          notes: item.notes,
        }))
      );
    }

    // Deduct stock for each item
    for (const item of input.items) {
      const [op] = await tx
        .select()
        .from(schema.outletProducts)
        .where(
          sql`${schema.outletProducts.outletId} = ${outletId} AND ${schema.outletProducts.productId} = ${item.productId}`
        )
        .limit(1);

      if (op) {
        const newStock = Math.max(0, op.stock - item.quantity);
        await tx
          .update(schema.outletProducts)
          .set({ stock: newStock, updatedAt: new Date() })
          .where(eq(schema.outletProducts.id, op.id));

        await tx.insert(schema.stockMovements).values({
          id: crypto.randomUUID(),
          outletId,
          productId: item.productId,
          type: 'sale',
          quantityChange: -item.quantity,
          stockAfter: newStock,
          referenceId: order.id,
          note: `Order ${input.idempotencyKey}`,
          createdBy: input.cashierId,
        });
      }
    }

    // Record coupon usage
    if (couponId) {
      await tx.insert(schema.loyaltyCouponUsages).values({
        id: crypto.randomUUID(),
        couponId,
        orderId: order.id,
        memberId: input.memberId || null,
        discountAmount: String(input.discountAmount),
      });
      await tx.update(schema.loyaltyCoupons)
        .set({ usedCount: sql`${schema.loyaltyCoupons.usedCount} + 1` })
        .where(eq(schema.loyaltyCoupons.id, couponId));
    }

    // Record reward redemption if any
    if (input.redeemedRewardId && input.memberId) {
      const [reward] = await tx.select().from(schema.loyaltyRewards).where(eq(schema.loyaltyRewards.id, input.redeemedRewardId)).limit(1);
      if (reward) {
        await tx.insert(schema.loyaltyRewardRedemptions).values({
          id: crypto.randomUUID(),
          rewardId: reward.id,
          memberId: input.memberId,
          orderId: order.id,
          programId: reward.programId,
          pointsCost: reward.pointsCost,
          status: 'claimed',
          claimedAt: new Date(),
        });
        await tx.insert(schema.loyaltyPointsTransactions).values({
          id: crypto.randomUUID(),
          memberId: input.memberId,
          programId: reward.programId,
          orderId: order.id,
          outletId,
          points: -reward.pointsCost,
          type: 'redeem',
        });
        if (reward.stock !== null) {
          await tx.update(schema.loyaltyRewards)
            .set({ stock: sql`${schema.loyaltyRewards.stock} - 1` })
            .where(eq(schema.loyaltyRewards.id, reward.id));
        }
      }
    }

    return order;
  });
}

export async function listOrders(filters: { outletId?: string; page?: number; limit?: number; status?: string; from?: string; to?: string; memberId?: string }) {
  return withTenantSchema(async (tx) => {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];

    if (filters.outletId) conditions.push(eq(schema.orders.outletId, filters.outletId));
    if (filters.status) conditions.push(eq(schema.orders.status, filters.status));
    if (filters.from) conditions.push(gte(schema.orders.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(schema.orders.createdAt, new Date(filters.to)));
    if (filters.memberId) conditions.push(eq(schema.orders.memberId, filters.memberId));

    const items = await tx
      .select()
      .from(schema.orders)
      .where(and(...conditions))
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(schema.orders)
      .where(and(...conditions));

    return { data: items, total: Number(count), page, limit };
  });
}

export async function getOrderById(orderId: string, outletId?: string) {
  return withTenantSchema(async (tx) => {
    const conditions: any[] = [eq(schema.orders.id, orderId)];
    if (outletId) conditions.push(eq(schema.orders.outletId, outletId));

    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(...conditions))
      .limit(1);

    if (!order) return null;

    const items = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));

    return { ...order, items };
  });
}

export async function getOrderSummary(filters: { outletId?: string; period?: string; from?: string; to?: string; tz?: string }) {
  return withTenantSchema(async (tx) => {
    const conditions: any[] = [eq(schema.orders.status, 'completed')];
    if (filters.outletId) conditions.push(eq(schema.orders.outletId, filters.outletId));

    const tz = filters.tz || 'UTC';

    if (filters.period === 'today' || (!filters.from && !filters.to)) {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}`
      );
      conditions.push(
        sql`${schema.orders.createdAt} < date_trunc('day', NOW() AT TIME ZONE ${tz} + INTERVAL '1 day') AT TIME ZONE ${tz}`
      );
    } else if (filters.period === '7days') {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz} - INTERVAL '6 days') AT TIME ZONE ${tz}`
      );
    } else if (filters.period === '30days') {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz} - INTERVAL '29 days') AT TIME ZONE ${tz}`
      );
    } else {
      if (filters.from) conditions.push(gte(schema.orders.createdAt, new Date(filters.from)));
      if (filters.to) conditions.push(lte(schema.orders.createdAt, new Date(filters.to)));
    }

    const [stats] = await tx
      .select({
        revenue: sql<number>`cast(coalesce(sum(${schema.orders.totalAmount}::numeric), 0) as float)`,
        totalOrders: sql<number>`cast(count(distinct ${schema.orders.id}) as int)`,
        avgOrderValue: sql<number>`cast(coalesce(avg(${schema.orders.totalAmount}::numeric), 0) as float)`,
        itemsSold: sql<number>`cast(coalesce(sum(${schema.orderItems.quantity}), 0) as int)`,
      })
      .from(schema.orders)
      .leftJoin(schema.orderItems, eq(schema.orderItems.orderId, schema.orders.id))
      .where(and(...conditions));

    const paymentMethods = await tx
      .select({
        method: schema.orders.paymentMethod,
        count: sql<number>`cast(count(*) as int)`,
        total: sql<number>`cast(coalesce(sum(${schema.orders.totalAmount}::numeric), 0) as float)`,
      })
      .from(schema.orders)
      .where(and(...conditions))
      .groupBy(schema.orders.paymentMethod);

    const recentOrders = await tx
      .select()
      .from(schema.orders)
      .where(and(...conditions))
      .orderBy(desc(schema.orders.createdAt))
      .limit(5);

    const topSellingItems = await tx
      .select({
        productId: schema.orderItems.productId,
        productName: schema.orderItems.productName,
        totalQuantity: sql<number>`cast(sum(${schema.orderItems.quantity}) as int)`,
        totalRevenue: sql<number>`cast(coalesce(sum(${schema.orderItems.subtotal}::numeric), 0) as float)`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(and(...conditions))
      .groupBy(schema.orderItems.productId, schema.orderItems.productName)
      .orderBy(desc(sql`sum(${schema.orderItems.quantity})`))
      .limit(10);

    return { ...stats, paymentMethods, recentOrders, topSellingItems };
  });
}

export async function refundOrder(orderId: string, reason: string, refundedBy?: string) {
  return withTenantSchema(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);

    if (!order) throw new Error('Order not found');
    if (order.status === 'refunded') throw new Error('Order already refunded');
    if (order.status === 'void') throw new Error('Cannot refund a voided order');

    const items = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));

    // Restock items
    for (const item of items) {
      const [op] = await tx
        .select()
        .from(schema.outletProducts)
        .where(
          and(
            eq(schema.outletProducts.outletId, order.outletId),
            eq(schema.outletProducts.productId, item.productId)
          )
        )
        .limit(1);

      if (op) {
        const newStock = op.stock + item.quantity;
        await tx
          .update(schema.outletProducts)
          .set({ stock: newStock, updatedAt: new Date() })
          .where(eq(schema.outletProducts.id, op.id));

        await tx.insert(schema.stockMovements).values({
          id: crypto.randomUUID(),
          outletId: order.outletId,
          productId: item.productId,
          type: 'return',
          quantityChange: item.quantity,
          stockAfter: newStock,
          referenceId: order.id,
          note: `Refund: ${reason}`,
          createdBy: refundedBy,
        });
      }
    }

    const [updated] = await tx
      .update(schema.orders)
      .set({
        status: 'refunded',
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return updated;
  });
}
