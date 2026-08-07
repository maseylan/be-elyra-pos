import { withTenantDb } from '../db/with-tenant-db';
import * as schema from '../db/tenant_schema';
import * as loyaltyService from './loyalty.service';
import { eq, desc, sql, and, gte, lte, or, isNull, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { HttpError } from '../utils/errors';

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
    const productIds = [...new Set(input.items.map(i => i.productId))];
    const variantIds = [...new Set(input.items.map(i => i.variantId).filter(Boolean) as string[])];
    const modifierIds = [...new Set(input.items.flatMap(i => i.selectedModifiers?.map((m: any) => m.id).filter(Boolean) || []))] as string[];
    const addOnIds = [...new Set(input.items.flatMap(i => i.selectedAddOns?.map((a: any) => a.id).filter(Boolean) || []))] as string[];

    if (input.items.some((item) => item.selectedModifiers?.some((m: any) => !m.id) || item.selectedAddOns?.some((a: any) => !a.id))) {
      throw new HttpError(400, 'Modifier dan add-on harus memiliki ID yang valid.');
    }

    const [dbProducts, dbVariants, dbOutletProducts, dbModifierGroups, dbModifiers, dbOutletModifiers, dbProductAddOns, dbAddOns, dbOutletAddOns] = await Promise.all([
      tx.select().from(schema.products).where(inArray(schema.products.id, productIds)),
      variantIds.length ? tx.select().from(schema.productVariants).where(inArray(schema.productVariants.id, variantIds)) : [],
      tx.select().from(schema.outletProducts).where(and(eq(schema.outletProducts.outletId, outletId), inArray(schema.outletProducts.productId, productIds))),
      tx.select().from(schema.modifierGroups).where(inArray(schema.modifierGroups.productId, productIds)),
      modifierIds.length ? tx.select().from(schema.modifiers).where(inArray(schema.modifiers.id, modifierIds)) : [],
      modifierIds.length ? tx.select().from(schema.outletModifiers).where(and(eq(schema.outletModifiers.outletId, outletId), inArray(schema.outletModifiers.modifierId, modifierIds))) : [],
      addOnIds.length ? tx.select().from(schema.productAddOns).where(and(inArray(schema.productAddOns.productId, productIds), inArray(schema.productAddOns.addOnId, addOnIds))) : [],
      addOnIds.length ? tx.select().from(schema.addOns).where(inArray(schema.addOns.id, addOnIds)) : [],
      addOnIds.length ? tx.select().from(schema.outletAddOns).where(and(eq(schema.outletAddOns.outletId, outletId), inArray(schema.outletAddOns.addOnId, addOnIds))) : [],
    ]);

    const pricedItems = input.items.map((item) => {
      const product = dbProducts.find((row: any) => row.id === item.productId);
      const variant = item.variantId ? dbVariants.find((row: any) => row.id === item.variantId && row.productId === item.productId) : undefined;
      if (!product || (item.variantId && !variant)) throw new HttpError(404, `Product not found: ${item.productName || item.productId}`);
      if (product.isActive === false || (variant && variant.isActive === false)) throw new HttpError(400, `Product tidak aktif: ${item.productName || item.productId}`);

      const outletProduct = dbOutletProducts.find((row: any) => row.productId === item.productId && (row.variantId || null) === (item.variantId || null));
      if (!outletProduct) throw new HttpError(400, `Product tidak tersedia di outlet ini: ${item.productName || item.productId}`);
      if (outletProduct.isAvailable === false) throw new HttpError(400, `Product sedang tidak tersedia: ${item.productName || item.productId}`);

      const selectedModifiers = (item.selectedModifiers || []).map(({ id }: any) => {
        const modifier = dbModifiers.find((row: any) => row.id === id);
        const group = modifier && dbModifierGroups.find((row: any) => row.id === modifier.groupId && row.productId === item.productId);
        const override = dbOutletModifiers.find((row: any) => row.modifierId === id);
        if (!modifier || !group || override?.isAvailable === false) throw new HttpError(400, 'Modifier tidak valid atau tidak tersedia.');
        return { id: modifier.id, name: modifier.name, price: Number(override?.priceAdjustment ?? modifier.priceAdjustment) };
      });

      const selectedAddOns = (item.selectedAddOns || []).map(({ id }: any) => {
        const addOn = dbAddOns.find((row: any) => row.id === id);
        const attached = dbProductAddOns.some((row: any) => row.productId === item.productId && row.addOnId === id);
        const override = dbOutletAddOns.find((row: any) => row.addOnId === id);
        if (!addOn || !attached || override?.isAvailable === false) throw new HttpError(400, 'Add-on tidak valid atau tidak tersedia.');
        return { id: addOn.id, name: addOn.name, price: Number(override?.price ?? addOn.price) };
      });

      const basePrice = Number(outletProduct.sellPriceOverride ?? variant?.price ?? product.sellPrice);
      const unitPrice = basePrice + selectedModifiers.reduce((sum, row) => sum + row.price, 0) + selectedAddOns.reduce((sum, row) => sum + row.price, 0);

      if (Math.abs(item.price - unitPrice) > 1) {
        throw new HttpError(400, `Price mismatch for ${item.productName || item.productId}: client ${item.price}, server ${unitPrice}`);
      }

      return { ...item, selectedModifiers, selectedAddOns, price: unitPrice, subtotal: unitPrice * item.quantity };
    });

    const serverSubtotal = pricedItems.reduce((sum, item) => sum + item.subtotal, 0);
    if (Math.abs(input.subtotal - serverSubtotal) > 1) {
      throw new HttpError(400, `Subtotal mismatch: client ${input.subtotal}, server ${serverSubtotal}`);
    }

    // Enforce active session for checkout — lock the row so a concurrent close waits
    const sessionConditions = [
      eq(schema.cashierSessions.outletId, outletId),
      eq(schema.cashierSessions.status, 'OPEN'),
    ];
    if (input.cashierId) sessionConditions.push(eq(schema.cashierSessions.cashierId, input.cashierId));

    let [activeSession] = await tx
      .select()
      .from(schema.cashierSessions)
      .where(and(...sessionConditions))
      .for('update')
      .limit(1);

    if (!activeSession && input.cashierId) {
      [activeSession] = await tx
        .select()
        .from(schema.cashierSessions)
        .where(and(eq(schema.cashierSessions.outletId, outletId), eq(schema.cashierSessions.status, 'OPEN')))
        .for('update')
        .limit(1);
    }

    if (!activeSession) {
      throw new HttpError(409, 'No active cashier session found for this outlet. Please open shift register before completing orders.');
    }

    // Fetch outlet + settings for order number generation and tax validation
    const [outlet] = await tx.select().from(schema.outlets).where(eq(schema.outlets.id, outletId)).limit(1);
    const [tenantDefault] = await tx.select().from(schema.tenantSettings).where(eq(schema.tenantSettings.id, 'default'));
    const [override] = await tx.select().from(schema.outletSettings).where(eq(schema.outletSettings.outletId, outletId));

    const autoGenerate = override?.autoGenerateOrderNumberOverride ?? tenantDefault?.autoGenerateOrderNumber ?? true;
    const numFormat = override?.orderNumberingFormatOverride ?? tenantDefault?.orderNumberingFormat ?? '{OUTLET}-{YYYYMMDD}-{SEQ}';
    const seqReset = override?.orderSequenceResetOverride ?? tenantDefault?.orderSequenceReset ?? 'daily';
    const allowNegativeStock = override?.allowNegativeStockOverride ?? tenantDefault?.allowNegativeStock ?? false;

    // Server-side tax calculation (matching FE calculation)
    const taxRate = Number(override?.taxRateOverride ?? tenantDefault?.defaultTaxRate ?? 0);
    const taxType = override?.taxTypeOverride ?? tenantDefault?.taxType ?? 'none';
    const promotionTaxMode = override?.promotionTaxModeOverride ?? tenantDefault?.promotionTaxMode ?? 'after_tax';
    const promoDiscount = Math.max(0, Number(input.promoDiscount || 0));
    const taxableBase = promotionTaxMode === 'before_tax' ? Math.max(0, serverSubtotal - promoDiscount) : serverSubtotal;
    const serverTax = taxType === 'none' || taxRate <= 0
      ? 0
      : taxType === 'inclusive'
        ? Math.round(taxableBase * taxRate / (100 + taxRate))
        : Math.round(taxableBase * taxRate / 100);

    // Handle coupon if provided — use server-calculated discountAmount
    let couponId: string | undefined;
    let serverDiscount = Math.min(Math.max(0, input.discountAmount), serverSubtotal);
    if (input.couponCode && input.discountAmount > 0) {
      const result = await loyaltyService.validateCoupon(input.couponCode, serverSubtotal, input.memberId, outletId, tx);
      couponId = result.coupon.id;
      serverDiscount = result.discountAmount;
    }

    const serverTotal = Math.round((taxType === 'inclusive' ? serverSubtotal : serverSubtotal + serverTax) - serverDiscount + input.roundingAmount);
    if (Math.abs(input.totalAmount - serverTotal) > 1) {
      throw new HttpError(400, `Total mismatch: client ${input.totalAmount}, server ${serverTotal}`);
    }
    if (Math.abs(input.taxAmount - serverTax) > 1) {
      throw new HttpError(400, `Tax mismatch: client ${input.taxAmount}, server ~${serverTax} (rate ${taxRate}%)`);
    }
    if (input.amountPaid > 0 && input.amountPaid + 1 < serverTotal) {
      throw new HttpError(400, `Pembayaran tidak mencukupi: dibayar ${input.amountPaid}, total ${serverTotal}`);
    }
    const serverChange = input.amountPaid > 0 ? Math.max(0, input.amountPaid - serverTotal) : 0;
    if (Math.abs(input.changeAmount - serverChange) > 1) {
      throw new HttpError(400, `Change mismatch: client ${input.changeAmount}, server ${serverChange}`);
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

    const [order] = await tx.insert(schema.orders).values({
      id: crypto.randomUUID(),
      idempotencyKey: input.idempotencyKey,
      outletId,
      sessionId: activeSession.id,
      subtotal: String(serverSubtotal),
      taxAmount: String(serverTax),
      discountAmount: String(serverDiscount),
      totalAmount: String(serverTotal),
      roundingAmount: String(input.roundingAmount),
      orderNumber,
      paymentMethod: input.paymentMethod,
      amountPaid: String(input.amountPaid),
      changeAmount: String(serverChange),
      tableNumber: input.tableNumber,
      cashierId: input.cashierId,
      cashierName: input.cashierName,
      memberId: input.memberId || null,
      couponId: couponId || null,
      redeemedRewardId: input.redeemedRewardId || null,
      status: 'completed',
    }).returning();

    if (pricedItems.length > 0) {
      await tx.insert(schema.orderItems).values(
        pricedItems.map(item => {
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
            variantId: item.variantId || null,
            productName: item.productName,
            quantity: item.quantity,
            price: String(item.price),
            subtotal: String(item.subtotal),
            notes: combinedNotes,
          };
        })
      );
    }

    // Deduct stock for each item (variant or base product) — atomic conditional update
    for (const item of pricedItems) {
      const condition = and(
        eq(schema.outletProducts.outletId, outletId),
        eq(schema.outletProducts.productId, item.productId),
        item.variantId ? eq(schema.outletProducts.variantId, item.variantId) : isNull(schema.outletProducts.variantId)
      );

      const stockUpdate = allowNegativeStock
        ? sql`${schema.outletProducts.stock} - ${item.quantity}`
        : sql`CASE WHEN ${schema.outletProducts.stock} >= ${item.quantity} THEN ${schema.outletProducts.stock} - ${item.quantity} ELSE ${schema.outletProducts.stock} END`;

      const [op] = await tx
        .update(schema.outletProducts)
        .set({ stock: stockUpdate, updatedAt: new Date() })
        .where(condition)
        .returning();

      if (!op) throw new HttpError(409, `Stok tidak tersedia untuk ${item.productName || item.productId}.`);
      if (op.stock < 0) {
        throw new HttpError(409, `Stok tidak mencukupi untuk ${item.productName || item.productId}. Sisa: ${op.stock + item.quantity}, diminta: ${item.quantity}`);
      }

      await tx.insert(schema.stockMovements).values({
        id: crypto.randomUUID(),
        outletId,
        productId: item.productId,
        variantId: item.variantId || null,
        type: 'sale',
        quantityChange: -item.quantity,
        stockAfter: op.stock,
        referenceId: order.id,
        note: `Order ${order.orderNumber || input.idempotencyKey}`,
        createdBy: input.cashierId,
      });
    }

    // Record coupon usage (coupon row already locked by validateCoupon)
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

    // Record reward redemption if any — verify balance, membership, and stock atomically
    if (input.redeemedRewardId && input.memberId) {
      const [reward] = await tx.select().from(schema.loyaltyRewards)
        .where(eq(schema.loyaltyRewards.id, input.redeemedRewardId))
        .for('update')
        .limit(1);
      if (!reward || reward.isActive === false) throw new HttpError(400, 'Reward tidak valid atau tidak aktif.');

      const [membership] = await tx.select().from(schema.loyaltyMemberPrograms)
        .where(and(
          eq(schema.loyaltyMemberPrograms.memberId, input.memberId),
          eq(schema.loyaltyMemberPrograms.programId, reward.programId),
        ))
        .limit(1);
      if (!membership) throw new HttpError(400, 'Member tidak terdaftar pada program reward ini.');

      if (reward.stock !== null && reward.stock < 1) throw new HttpError(409, 'Stok reward habis.');

      const [balanceRow] = await tx.select({
        balance: sql<number>`COALESCE(SUM(${schema.loyaltyPointsTransactions.points}), 0)`,
      })
        .from(schema.loyaltyPointsTransactions)
        .where(and(
          eq(schema.loyaltyPointsTransactions.memberId, input.memberId),
          eq(schema.loyaltyPointsTransactions.programId, reward.programId),
        ));
      if (Number(balanceRow?.balance || 0) < reward.pointsCost) throw new HttpError(400, 'Poin member tidak mencukupi untuk reward ini.');

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
        const [updatedReward] = await tx.update(schema.loyaltyRewards)
          .set({ stock: sql`${schema.loyaltyRewards.stock} - 1`, updatedAt: new Date() })
          .where(and(eq(schema.loyaltyRewards.id, reward.id), sql`${schema.loyaltyRewards.stock} > 0`))
          .returning();
        if (!updatedReward) throw new HttpError(409, 'Stok reward habis.');
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

    if (filters.period === 'today') {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}`
      );
      conditions.push(
        sql`${schema.orders.createdAt} < date_trunc('day', NOW() AT TIME ZONE ${tz} + INTERVAL '1 day') AT TIME ZONE ${tz}`
      );
    } else if (filters.period === 'yesterday') {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz} - INTERVAL '1 day') AT TIME ZONE ${tz}`
      );
      conditions.push(
        sql`${schema.orders.createdAt} < date_trunc('day', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}`
      );
    } else if (filters.period === '7days') {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz} - INTERVAL '6 days') AT TIME ZONE ${tz}`
      );
    } else if (filters.period === '7days_prev') {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz} - INTERVAL '13 days') AT TIME ZONE ${tz}`
      );
      conditions.push(
        sql`${schema.orders.createdAt} < date_trunc('day', NOW() AT TIME ZONE ${tz} - INTERVAL '6 days') AT TIME ZONE ${tz}`
      );
    } else if (filters.period === '30days') {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz} - INTERVAL '29 days') AT TIME ZONE ${tz}`
      );
    } else if (filters.period === '30days_prev') {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz} - INTERVAL '59 days') AT TIME ZONE ${tz}`
      );
      conditions.push(
        sql`${schema.orders.createdAt} < date_trunc('day', NOW() AT TIME ZONE ${tz} - INTERVAL '29 days') AT TIME ZONE ${tz}`
      );
    } else if (filters.from || filters.to) {
      if (filters.from) conditions.push(gte(schema.orders.createdAt, new Date(filters.from)));
      if (filters.to) conditions.push(lte(schema.orders.createdAt, new Date(filters.to)));
    } else {
      conditions.push(
        sql`${schema.orders.createdAt} >= date_trunc('day', NOW() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}`
      );
      conditions.push(
        sql`${schema.orders.createdAt} < date_trunc('day', NOW() AT TIME ZONE ${tz} + INTERVAL '1 day') AT TIME ZONE ${tz}`
      );
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

    if (!order) throw new HttpError(404, 'Order not found');
    if (order.status !== 'completed') throw new HttpError(409, 'Order cannot be refunded (current status: ' + order.status + ')');

    const items = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));

    // Restock items — scoped to variant if present, atomic increment
    for (const item of items) {
      const [op] = await tx
        .update(schema.outletProducts)
        .set({ stock: sql`${schema.outletProducts.stock} + ${item.quantity}`, updatedAt: new Date() })
        .where(
          and(
            eq(schema.outletProducts.outletId, order.outletId),
            eq(schema.outletProducts.productId, item.productId),
            item.variantId ? eq(schema.outletProducts.variantId, item.variantId) : isNull(schema.outletProducts.variantId)
          )
        )
        .returning({ stock: schema.outletProducts.stock });

      if (op) {
        await tx.insert(schema.stockMovements).values({
          id: crypto.randomUUID(),
          outletId: order.outletId,
          productId: item.productId,
          variantId: item.variantId || null,
          type: 'return',
          quantityChange: item.quantity,
          stockAfter: Number(op[0].stock),
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

    if (!updated) throw new HttpError(409, 'Order was already refunded by another request');

    return updated;
  });
}
