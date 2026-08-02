import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { withTenantDb } from '../db/with-tenant-db';
import {
  outlets, outletSettings, cashierSessions, products, categories,
  productVariants, modifierGroups, modifiers, addOns, productAddOns,
  orders, orderItems, floorPlans, tables, outletProducts
} from '../db/tenant_schema';
import { HttpError } from '../utils/errors';
import * as outletSettingsService from './outlet-settings.service';
import { emitToOutlet } from '../socket';

export interface CreateSelfOrderParams {
  outletId: string;
  customerName: string;
  customerPhone?: string | null;
  tableNumber?: string | null;
  paymentMethod: 'cashier' | 'qris';
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    variantId?: string | null;
    variantName?: string | null;
    selectedModifiers?: Array<{ id?: string; name: string; price?: number }>;
    selectedAddOns?: Array<{ id?: string; name: string; price?: number }>;
    notes?: string | null;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  totalAmount: number;
}

export async function getSelfOrderStatus(outletId: string, tableId?: string) {
  return withTenantDb(async (tx) => {
    const settings = await outletSettingsService.resolveEffectiveSettings(outletId, tx);

    // 1. Must have enableSelfOrder === true
    if (!settings.enableSelfOrder) {
      throw new HttpError(404, 'Halaman Self-Order tidak diaktifkan untuk outlet ini.');
    }

    // 2. Fetch active sessions for outlet
    const activeSessions = await tx
      .select()
      .from(cashierSessions)
      .where(and(eq(cashierSessions.outletId, outletId), eq(cashierSessions.status, 'OPEN')))
      .orderBy(cashierSessions.openedAt);

    const hasActiveSession = activeSessions.length > 0;
    const primaryTerminalName = activeSessions[0]?.terminalName || 'Kasir Utama';

    // 3. Table validation if tableId provided
    let tableInfo = null;
    if (tableId) {
      const [table] = await tx
        .select({
          id: tables.id,
          number: tables.number,
          floorPlanId: tables.floorPlanId,
          capacity: tables.capacity,
        })
        .from(tables)
        .where(and(eq(tables.id, tableId), eq(tables.isActive, true)))
        .limit(1);

      if (table) {
        tableInfo = table;
      }
    }

    // Fetch outlet name
    const [outlet] = await tx
      .select({ name: outlets.name, address: outlets.address })
      .from(outlets)
      .where(eq(outlets.id, outletId))
      .limit(1);

    return {
      enableSelfOrder: true,
      hasActiveSession,
      isMultiTerminal: settings.multiTerminal,
      primaryTerminalName,
      outletName: outlet?.name || settings.storeName || 'Restoran',
      storeAddress: outlet?.address || settings.storeAddress,
      table: tableInfo,
    };
  });
}

export async function getSelfOrderCatalog(outletId: string) {
  return withTenantDb(async (tx) => {
    const settings = await outletSettingsService.resolveEffectiveSettings(outletId, tx);

    if (!settings.enableSelfOrder) {
      throw new HttpError(404, 'Halaman Self-Order tidak diaktifkan untuk outlet ini.');
    }

    // Fetch categories
    const allCategories = await tx
      .select()
      .from(categories)
      .orderBy(categories.name);

    // Fetch active products
    const activeProducts = await tx
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.name);

    const productIds = activeProducts.map((p: any) => p.id);

    // Fetch outletProducts for price overrides
    let allOutletProducts: any[] = [];
    if (productIds.length > 0) {
      allOutletProducts = await tx
        .select()
        .from(outletProducts)
        .where(eq(outletProducts.outletId, outletId));
    }

    // Fetch variants
    let allVariants: any[] = [];
    if (productIds.length > 0) {
      allVariants = await tx
        .select()
        .from(productVariants)
        .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)));
    }

    // Fetch modifier groups & modifiers
    let allModGroups: any[] = [];
    let allModifiers: any[] = [];
    if (productIds.length > 0) {
      allModGroups = await tx
        .select()
        .from(modifierGroups)
        .where(inArray(modifierGroups.productId, productIds));

      const modGroupIds = allModGroups.map((g: any) => g.id);
      if (modGroupIds.length > 0) {
        allModifiers = await tx
          .select()
          .from(modifiers)
          .where(and(inArray(modifiers.groupId, modGroupIds), eq(modifiers.isActive, true)));
      }
    }

    // Combine modifiers into groups
    const modGroupsWithItems = allModGroups.map((g: any) => ({
      ...g,
      modifiers: allModifiers.filter((m: any) => m.groupId === g.id),
    }));

    // Attach variants & modifier groups to products with effective outlet prices
    const fullProducts = activeProducts.map((p: any) => {
      const op = allOutletProducts.find((o: any) => o.productId === p.id && (!o.variantId || o.variantId === null));
      const rawPrice = op?.sellPriceOverride !== null && op?.sellPriceOverride !== undefined ? op.sellPriceOverride : (p.sellPrice || p.price);
      const effectivePrice = Number(rawPrice || 0);

      const productVars = allVariants.filter((v: any) => v.productId === p.id);

      return {
        ...p,
        price: effectivePrice,
        sellPrice: effectivePrice,
        variants: productVars.map((v: any) => {
          const opV = allOutletProducts.find((o: any) => o.productId === p.id && o.variantId === v.id);
          const rawVarPrice = opV?.sellPriceOverride !== null && opV?.sellPriceOverride !== undefined ? opV.sellPriceOverride : v.price;
          const effectiveVarPrice = Number(rawVarPrice || 0);
          return {
            ...v,
            price: effectiveVarPrice,
          };
        }),
        modifierGroups: modGroupsWithItems.filter((g: any) => g.productId === p.id),
      };
    });

    return {
      outletName: settings.storeName,
      currency: settings.currency || 'IDR',
      taxRate: Number(settings.defaultTaxRate || 0),
      taxType: settings.taxType || 'none',
      categories: allCategories,
      products: fullProducts,
      paymentMethods: settings.paymentMethods || [
        { name: 'Bayar di Kasir', code: 'cashier', enabled: true },
        { name: 'QRIS / Instant', code: 'qris', enabled: true },
      ],
    };
  });
}

export async function createSelfOrder(params: CreateSelfOrderParams) {
  return withTenantDb(async (tx) => {
    // 1. Resolve effective settings & verify self-order enabled
    const settings = await outletSettingsService.resolveEffectiveSettings(params.outletId, tx);
    if (!settings.enableSelfOrder) {
      throw new HttpError(404, 'Self-Order tidak diaktifkan untuk outlet ini.');
    }

    // 2. Fetch active session
    const activeSessions = await tx
      .select()
      .from(cashierSessions)
      .where(and(eq(cashierSessions.outletId, params.outletId), eq(cashierSessions.status, 'OPEN')))
      .orderBy(cashierSessions.openedAt);

    if (activeSessions.length === 0) {
      throw new HttpError(400, 'Outlet belum membuka shift kasir. Silakan pesan langsung ke kasir.');
    }

    const session = activeSessions[0];
    const primaryTerminalName = session.terminalName || 'Kasir Utama';

    // 3. Generate Order Number & Idempotency Key
    const orderNum = `QR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
    const idempotencyKey = `selforder_${crypto.randomUUID()}`;

    const orderStatus = params.paymentMethod === 'qris' ? 'completed' : 'pending_cashier';
    const payMethodName = params.paymentMethod === 'qris' ? 'QRIS' : 'BAYAR_DI_KASIR';

    const [createdOrder] = await tx
      .insert(orders)
      .values({
        idempotencyKey,
        outletId: params.outletId,
        sessionId: session.id,
        subtotal: params.subtotal.toString(),
        taxAmount: params.taxAmount.toString(),
        discountAmount: (params.discountAmount || 0).toString(),
        totalAmount: params.totalAmount.toString(),
        paymentMethod: payMethodName,
        amountPaid: params.paymentMethod === 'qris' ? params.totalAmount.toString() : '0',
        changeAmount: '0',
        tableNumber: params.tableNumber || null,
        cashierName: `Self-Order (${params.customerName})`,
        orderNumber: orderNum,
        status: orderStatus,
      })
      .returning();

    // 4. Insert items
    const createdItems = [];
    for (const item of params.items) {
      const itemSubtotal = item.price * item.quantity;
      const notesObj = {
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        variantName: item.variantName,
        modifiers: item.selectedModifiers,
        addOns: item.selectedAddOns,
        customNotes: item.notes,
      };

      const [insItem] = await tx
        .insert(orderItems)
        .values({
          orderId: createdOrder.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price.toString(),
          subtotal: itemSubtotal.toString(),
          notes: JSON.stringify(notesObj),
        })
        .returning();

      createdItems.push(insItem);
    }

    const fullOrder = {
      ...createdOrder,
      items: createdItems,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      tableNumber: params.tableNumber,
    };

    // 5. Emit Socket.IO Events
    emitToOutlet(params.outletId, 'qr_order:created', fullOrder);
    if (params.paymentMethod === 'qris') {
      emitToOutlet(params.outletId, 'qr_order:paid_qris', {
        order: fullOrder,
        primaryTerminalName,
      });
    }

    return fullOrder;
  });
}

export async function getPendingQROrders(outletId: string) {
  return withTenantDb(async (tx) => {
    const pendingList = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.outletId, outletId), eq(orders.status, 'pending_cashier')))
      .orderBy(desc(orders.createdAt));

    const result = [];
    for (const ord of pendingList) {
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, ord.id));

      result.push({
        ...ord,
        items,
      });
    }

    return result;
  });
}

export async function claimPendingQROrder(orderId: string, outletId: string, cashierId: string, cashierName: string) {
  return withTenantDb(async (tx) => {
    // Atomic update status from pending_cashier to claimed
    const [updated] = await tx
      .update(orders)
      .set({
        status: 'claimed',
        cashierId,
        cashierName,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'pending_cashier')))
      .returning();

    if (!updated) {
      throw new HttpError(409, 'Pesanan QR Order ini sudah diproses/diklaim oleh kasir di terminal lain.');
    }

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, updated.id));

    const fullOrder = { ...updated, items };

    // Emit event so other terminals instantly remove it from their pending UI
    emitToOutlet(outletId, 'qr_order:claimed', {
      orderId: updated.id,
      claimedBy: cashierName,
    });

    return fullOrder;
  });
}
