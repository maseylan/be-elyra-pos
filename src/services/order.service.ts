import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import * as loyaltyService from './loyalty.service';
import { eq, desc, sql, and, gte, lte, or, isNull } from 'drizzle-orm';
import crypto from 'crypto';

interface CreateOrderInput {
  items: Array<{
    productId: string;
    variantId?: string;
    productName?: string;
    selectedVariant?: any;
    selectedModifiers?: any[];
    selectedAddOns?: any[];
    quantity: number;
    price: number;
    subtotal: number;
    notes?: string;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  promoDiscount?: number;
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
  return withTenantDb(async (tx) => {
    // Verify item prices against DB
    const productIds = [...new Set(input.items.map(i => i.productId))];
    const variantIds = input.items.map(i => i.variantId).filter(Boolean) as string[];
    const dbResults = await Promise.all(
      productIds.map(id => tx.select().from(schema.products).where(eq(schema.products.id, id)).limit(1))
    );
    const dbProducts = dbResults.map(r => r[0]).filter(Boolean) as any[];
    const variantResults = variantIds.length > 0
      ? await Promise.all(variantIds.map(id => tx.select().from(schema.productVariants).where(eq(schema.productVariants.id, id)).limit(1)))
      : [];
    const dbVariants = variantResults.map(r => r[0]).filter(Boolean) as any[];
    const productPriceMap = new Map(dbProducts.map(p => [p.id, Number(p.sellPrice)]));
    const variantPriceMap = new Map(dbVariants.map(v => [v.id, Number(v.price)]));
    for (const item of input.items) {
      const dbPrice = item.variantId ? variantPriceMap.get(item.variantId) : productPriceMap.get(item.productId);
      if (dbPrice === undefined) throw new Error(`Product not found: ${item.productName || item.productId}`);
      if (item.price < dbPrice) {
        throw new Error(`Price mismatch for ${item.productName || item.productId}: client ${item.price} < DB ${dbPrice}`);
      }
      if (item.price > dbPrice) {
        throw new Error(`Price mismatch for ${item.productName || item.productId}: client ${item.price} > DB ${dbPrice}`);
      }
      if (Math.round(Number(item.subtotal)) !== Math.round(item.price * item.quantity)) {
        throw new Error(`Subtotal mismatch for ${item.productName || item.productId}: ${item.subtotal} !== ${item.price * item.quantity}`);
      }
    }

    // Enforce active session for checkout
    let activeSessionQuery = tx
      .select()
      .from(schema.cashierSessions)
      .where(
        and(
          eq(schema.cashierSessions.outletId, outletId),
          eq(schema.cashierSessions.status, 'OPEN'),
          ...(input.cashierId ? [eq(schema.cashierSessions.cashierId, input.cashierId)] : [])
        )
      )
      .limit(1);

    let [activeSession] = await activeSessionQuery;

    // Fallback: check any open session for the outlet if specific cashier match not found
    if (!activeSession && input.cashierId) {
      [activeSession] = await tx
        .select()
        .from(schema.cashierSessions)
        .where(
          and(
            eq(schema.cashierSessions.outletId, outletId),
            eq(schema.cashierSessions.status, 'OPEN')
          )
        )
        .limit(1);
    }

    if (!activeSession) {
      throw new Error('No active cashier session found for this outlet. Please open shift register before completing orders.');
    }

    // Fetch outlet + settings for order number generation and tax validation
    const [outlet] = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, outletId)).limit(1);
    const [tenantDefault] = await tx.select().from(schema.tenantSettings).where(eq(schema.tenantSettings.id, 'default'));
    const [override] = await tx.select().from(schema.outletSettings).where(eq(schema.outletSettings.outletId, outletId));

    const autoGenerate = override?.autoGenerateOrderNumberOverride ?? tenantDefault?.autoGenerateOrderNumber ?? true;
    const numFormat = override?.orderNumberingFormatOverride ?? tenantDefault?.orderNumberingFormat ?? '{OUTLET}-{YYYYMMDD}-{SEQ}';
    const seqReset = override?.orderSequenceResetOverride ?? tenantDefault?.orderSequenceReset ?? 'daily';
    const allowNegativeStock = override?.allowNegativeStockOverride ?? tenantDefault?.allowNegativeStock ?? false;

    // Validate tax amount against configured rate (matching FE calculation)
    const taxRate = Number(override?.taxRateOverride ?? tenantDefault?.defaultTaxRate ?? 0);
    const taxType = override?.taxTypeOverride ?? tenantDefault?.taxType ?? 'none';
    const promotionTaxMode = override?.promotionTaxModeOverride ?? tenantDefault?.promotionTaxMode ?? 'after_tax';
    if (taxType !== 'none' && taxRate > 0) {
      const promoDiscount = Math.max(0, Number(input.promoDiscount || 0));
      const taxableBase = promotionTaxMode === 'before_tax' ? Math.max(0, input.subtotal - promoDiscount) : input.subtotal;
      const expectedTax = taxType === 'inclusive'
        ? Math.round(taxableBase * taxRate / (100 + taxRate))
        : Math.round(taxableBase * taxRate / 100);
      if (Math.abs(input.taxAmount - expectedTax) > 1) {
        throw new Error(`Tax mismatch: client ${input.taxAmount}, expected ~${expectedTax} (rate ${taxRate}%)`);
      }
    }

    let orderNumber: string | undefined;
    if (autoGenerate) {
      const outletCode = outlet?.code || 'OUT';
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      // Serialize order number generation per outlet via advisory lock
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${outletId})::bigint)`);

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

    // Handle coupon if provided — use server-calculated discountAmount
    let couponId: string | undefined;
    let serverDiscount = input.discountAmount;
    if (input.couponCode && input.discountAmount > 0) {
      const result = await loyaltyService.validateCoupon(input.couponCode, input.subtotal, input.memberId, outletId);
      couponId = result.coupon.id;
      serverDiscount = result.discountAmount;
    }

    const [order] = await tx.insert(schema.orders).values({
      id: crypto.randomUUID(),
      idempotencyKey: input.idempotencyKey,
      outletId,
      sessionId: activeSession.id,
      subtotal: String(input.subtotal),
      taxAmount: String(input.taxAmount),
      discountAmount: String(serverDiscount),
      totalAmount: String((taxType === 'inclusive' ? input.subtotal : input.subtotal + input.taxAmount) - serverDiscount + input.roundingAmount),
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
        input.items.map(item => {
          const optionsParts: string[] = [];
          if (item.selectedModifiers && item.selectedModifiers.length > 0) {
            optionsParts.push(item.selectedModifiers.map((m: any) => m.name).join(', '));
          }
          if (item.selectedAddOns && item.selectedAddOns.length > 0) {
            optionsParts.push(item.selectedAddOns.map((a: any) => `+${a.name}`).join(', '));
          }
          if (item.notes) {
            optionsParts.push(item.notes);
          }
          const combinedNotes = optionsParts.join(' | ') || null;

          return {
            id: crypto.randomUUID(),
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: String(item.price),
            subtotal: String(item.subtotal),
            notes: combinedNotes,
          };
        })
      );
    }

    // Deduct stock for each item (variant or base product)
    for (const item of input.items) {
      const condition = and(
        eq(schema.outletProducts.outletId, outletId),
        eq(schema.outletProducts.productId, item.productId),
        item.variantId ? eq(schema.outletProducts.variantId, item.variantId) : isNull(schema.outletProducts.variantId)
      );

      const [op] = await tx
        .select()
        .from(schema.outletProducts)
        .where(condition)
        .limit(1);

      if (op) {
        if (op.stock < item.quantity && !allowNegativeStock) {
          throw new Error(`Stok tidak mencukupi untuk ${item.productName || item.productId}. Sisa: ${op.stock}, diminta: ${item.quantity}`);
        }
        const newStock = op.stock - item.quantity;
        await tx
          .update(schema.outletProducts)
          .set({ stock: newStock, updatedAt: new Date() })
          .where(eq(schema.outletProducts.id, op.id));

        await tx.insert(schema.stockMovements).values({
          id: crypto.randomUUID(),
          outletId,
          productId: item.productId,
          variantId: item.variantId || null,
          type: 'sale',
          quantityChange: -item.quantity,
          stockAfter: newStock,
          referenceId: order.id,
          note: `Order ${order.orderNumber || input.idempotencyKey}`,
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
        discountAmount: String(serverDiscount),
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
  return withTenantDb(async (tx) => {
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
  return withTenantDb(async (tx) => {
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
  return withTenantDb(async (tx) => {
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

    const [orderStats] = await tx
      .select({
        revenue: sql<number>`cast(coalesce(sum(${schema.orders.totalAmount}::numeric), 0) as float)`,
        totalOrders: sql<number>`cast(count(*) as int)`,
        avgOrderValue: sql<number>`cast(coalesce(avg(${schema.orders.totalAmount}::numeric), 0) as float)`,
      })
      .from(schema.orders)
      .where(and(...conditions));

    const [itemStats] = await tx
      .select({
        itemsSold: sql<number>`cast(coalesce(sum(${schema.orderItems.quantity}), 0) as int)`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(and(...conditions));

    const stats = {
      revenue: orderStats?.revenue || 0,
      totalOrders: orderStats?.totalOrders || 0,
      avgOrderValue: orderStats?.avgOrderValue || 0,
      itemsSold: itemStats?.itemsSold || 0,
    };

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
  return withTenantDb(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order) throw new Error('Order not found');
    if (order.status !== 'completed') throw new Error('Order cannot be refunded (current status: ' + order.status + ')');

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
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, 'completed')))
      .returning();

    if (!updated) throw new Error('Order was already refunded by another request');

    return updated;
  });
}
