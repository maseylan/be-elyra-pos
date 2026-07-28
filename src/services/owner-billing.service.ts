import { eq, sql, desc, like, and } from 'drizzle-orm';
import { publicDb } from '../db/poolManager';
import { tenants, subscriptionPlans, invoices, paymentTransactions } from '../db/schema';
import { HttpError } from '../utils/errors';

export async function getSubscription(tenantId: string) {
  const [tenant] = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

  let plan = null;
  if (tenant.subscriptionType) {
    [plan] = await publicDb.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, tenant.subscriptionType));
  }

  const now = new Date();
  const daysRemaining = tenant.subscriptionEnd
    ? Math.max(0, Math.ceil((tenant.subscriptionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      ownerName: tenant.ownerName,
      whatsappNumber: tenant.whatsappNumber,
      subdomain: tenant.subdomain,
    },
    plan,
    subscriptionType: tenant.subscriptionType,
    subscriptionStart: tenant.subscriptionStart,
    subscriptionEnd: tenant.subscriptionEnd,
    daysRemaining,
    applicationStatus: tenant.applicationStatus,
    isActive: tenant.isActive,
  };
}

export async function getAvailablePlans(tenantId: string) {
  const [tenant] = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

  const allPlans = await publicDb
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.sortOrder);

  return allPlans.map(plan => ({
    ...plan,
    isCurrentPlan: plan.id === tenant.subscriptionType,
  }));
}

export async function getInvoices(tenantId: string, page = 1, limit = 15) {
  const offset = (page - 1) * limit;

  const [countResult] = await publicDb
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(eq(invoices.tenantId, tenantId));

  const total = Number(countResult?.count || 0);
  const totalPages = Math.ceil(total / limit);

  const items = await publicDb
    .select({
      invoice: invoices,
      planName: subscriptionPlans.name,
    })
    .from(invoices)
    .leftJoin(subscriptionPlans, eq(invoices.planId, subscriptionPlans.id))
    .where(eq(invoices.tenantId, tenantId))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: items.map(i => ({ ...i.invoice, planName: i.planName || '' })),
    total,
    page,
    limit,
    totalPages,
  };
}

export async function getInvoiceDetail(invoiceId: string, tenantId: string) {
  const [invoice] = await publicDb
    .select({
      invoice: invoices,
      planName: subscriptionPlans.name,
    })
    .from(invoices)
    .leftJoin(subscriptionPlans, eq(invoices.planId, subscriptionPlans.id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

  if (!invoice) throw new HttpError(404, 'Invoice tidak ditemukan');

  const payments = await publicDb
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.invoiceId, invoiceId))
    .orderBy(desc(paymentTransactions.createdAt));

  return { ...invoice.invoice, planName: invoice.planName || '', payments };
}

export async function upgradePlan(tenantId: string, newPlanId: string) {
  const [tenant] = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

  const [plan] = await publicDb.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, newPlanId));
  if (!plan || !plan.isActive) throw new HttpError(404, 'Plan tidak ditemukan atau tidak aktif');

  if (plan.id === tenant.subscriptionType) {
    throw new HttpError(409, 'Anda sudah menggunakan plan ini');
  }

  if (plan.id === 'enterprise') {
    await publicDb.update(tenants)
      .set({ subscriptionType: 'enterprise' })
      .where(eq(tenants.id, tenantId));

    return {
      redirectToContact: true,
      message: 'Hubungi tim sales kami untuk aktivasi Enterprise plan',
      contact: { email: 'sales@elyrapos.com', whatsapp: '6281234567890' },
    };
  }

  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await publicDb.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id: invoiceId,
      tenantId,
      planId: newPlanId,
      amount: plan.priceMonthly,
      status: 'pending',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      periodStart: now,
      periodEnd,
    });

    await tx.update(tenants)
      .set({
        subscriptionType: newPlanId,
        subscriptionStart: now,
        subscriptionEnd: periodEnd,
        applicationStatus: 'provisioned',
      })
      .where(eq(tenants.id, tenantId));
  });

  return {
    redirectToContact: false,
    message: 'Berhasil upgrade plan. Invoice sedang diproses.',
    invoiceId,
  };
}
