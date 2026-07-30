import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as orderService from '../services/order.service';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';
// import { sendInvoice, InvoiceData } from '../services/email.service';
// import { withTenantDb } from '../db/with-tenant-db';
// import * as tenantSchema from '../db/tenant_schema';
// import { eq, and } from 'drizzle-orm';

const createOrderSchema = z.object({
  idempotencyKey: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    productName: z.string().optional(),
    selectedVariant: z.any().optional(),
    selectedModifiers: z.any().optional(),
    selectedAddOns: z.any().optional(),
    quantity: z.number().int().min(1),
    price: z.number().min(0),
    subtotal: z.number().min(0),
    notes: z.string().optional(),
  })).min(1),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0),
  discountAmount: z.number().min(0),
  totalAmount: z.number().min(0),
  roundingAmount: z.number().default(0),
  paymentMethod: z.string().min(1),
  amountPaid: z.number().min(0),
  changeAmount: z.number().min(0),
  tableNumber: z.string().optional(),
  cashierId: z.string().uuid().optional(),
  cashierName: z.string().optional(),
  memberId: z.string().uuid().optional(),
  couponCode: z.string().optional(),
  redeemedRewardId: z.string().uuid().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  memberId: z.string().uuid().optional(),
});

const paramSchema = z.object({
  id: z.string().uuid(),
});

const summaryQuerySchema = z.object({
  period: z.enum(['today', '7days', '30days']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  tz: z.string().optional(),
});

const refundSchema = z.object({
  reason: z.string().min(1),
  refundedBy: z.string().optional(),
});

export const createOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const outletId = (req as any).outletId;
  if (!outletId) {
    return res.status(400).json({ error: 'Outlet context required' });
  }

  const authUserId = req.auth?.userId || req.user?.userId || (req.user as any)?.id;
  const authUserName = req.auth?.name || (req.user as any)?.name || req.auth?.email || 'Kasir';

  const payload = {
    ...parsed.data,
    cashierId: parsed.data.cashierId || authUserId,
    cashierName: parsed.data.cashierName && parsed.data.cashierName !== 'Kasir Default' ? parsed.data.cashierName : authUserName,
  };

  try {
    const order = await orderService.createOrder(outletId, payload);
    res.status(201).json(order);
  } catch (error: any) {
    if (error?.message?.includes('idempotency_key')) throw new HttpError(409, error.message);
    throw error;
  }
});

export const listOrders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: 'Invalid query', details: query.error.flatten() });
  }

  const queryOutlet = req.query.outletId as string | undefined;
  let targetOutletId: string | undefined = undefined;

  if (queryOutlet && queryOutlet !== '' && queryOutlet !== 'all') {
    targetOutletId = queryOutlet;
  } else if (!queryOutlet && (req as any).outletId && req.baseUrl.includes('/outlets/')) {
    targetOutletId = (req as any).outletId;
  }

  const result = await orderService.listOrders({ ...query.data, outletId: targetOutletId });
  res.json(result);
});

export const getOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const outletId = (req as any).outletId;

  const order = await orderService.getOrderById(params.data.id, outletId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

export const getOrderSummary = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const query = summaryQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: 'Invalid query', details: query.error.flatten() });
  }

  const queryOutlet = req.query.outletId as string | undefined;
  let targetOutletId: string | undefined = undefined;

  if (queryOutlet && queryOutlet !== '' && queryOutlet !== 'all') {
    targetOutletId = queryOutlet;
  } else if (!queryOutlet && (req as any).outletId && req.baseUrl.includes('/outlets/')) {
    targetOutletId = (req as any).outletId;
  }

  const result = await orderService.getOrderSummary({ ...query.data, outletId: targetOutletId });
  res.json(result);
});

/* ponytail: invoice email, enable when needed
async function sendInvoiceEmail(order: any, outletId: string, input: any) {
  if (!order.memberId) return;
  const customerEmail = await withTenantDb(async (tx) => {
    const [member] = await tx
      .select({ customerId: tenantSchema.loyaltyMembers.customerId })
      .from(tenantSchema.loyaltyMembers)
      .where(eq(tenantSchema.loyaltyMembers.id, order.memberId))
      .limit(1);
    if (!member) return null;
    const [customer] = await tx
      .select({ email: tenantSchema.customers.email })
      .from(tenantSchema.customers)
      .where(eq(tenantSchema.customers.id, member.customerId))
      .limit(1);
    return customer?.email || null;
  });
  if (!customerEmail) return;

  const [outlet] = await withTenantDb(async (tx) =>
    tx.select({ name: tenantSchema.outlets.name, address: tenantSchema.outlets.address })
      .from(tenantSchema.outlets)
      .where(eq(tenantSchema.outlets.id, outletId))
      .limit(1)
  );

  const data: InvoiceData = {
    orderNumber: order.orderNumber || order.id,
    outletName: outlet?.name || 'Outlet',
    outletAddress: outlet?.address || '',
    date: order.createdAt || new Date(),
    items: input.items.map((it: any) => ({
      name: it.productName || 'Item',
      qty: it.quantity,
      price: it.price,
    })),
    subtotal: input.subtotal,
    tax: input.taxAmount,
    discount: input.discountAmount,
    total: input.totalAmount,
    paymentMethod: input.paymentMethod || 'Tunai',
    amountPaid: input.amountPaid,
    change: input.changeAmount,
  };
  await sendInvoice(customerEmail, data);
}
*/

export const refundOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const body = refundSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  }

  try {
    const order = await orderService.refundOrder(params.data.id, body.data.reason, body.data.refundedBy);
    res.json(order);
  } catch (error: any) {
    if (error?.message?.includes('not found')) throw new HttpError(404, error.message);
    if (error?.message?.includes('already refunded') || error?.message?.includes('Cannot refund')) throw new HttpError(400, error.message);
    throw error;
  }
});
