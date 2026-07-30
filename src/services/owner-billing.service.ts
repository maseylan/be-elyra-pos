import { eq, sql, desc, and } from 'drizzle-orm';
import { publicDb } from '../db/poolManager';
import { tenants, invoices, paymentTransactions } from '../db/schema';
import { HttpError } from '../utils/errors';

const STORAGE_TIERS = [
  { id: '100mb', name: '100 MB', storageGb: 0.1, priceMonthly: 0 },
  { id: '1gb', name: '1 GB', storageGb: 1, priceMonthly: 99000 },
  { id: '5gb', name: '5 GB', storageGb: 5, priceMonthly: 99000 },
  { id: '10gb', name: '10 GB', storageGb: 10, priceMonthly: 149000 },
  { id: '25gb', name: '25 GB', storageGb: 25, priceMonthly: 249000 },
  { id: '50gb', name: '50 GB', storageGb: 50, priceMonthly: 399000 },
  { id: '100gb', name: '100 GB', storageGb: 100, priceMonthly: 599000 },
];

export async function getSubscription(tenantId: string) {
  const [tenant] = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

  const currentTier = STORAGE_TIERS.find(t => Math.abs(t.storageGb - Number(tenant.storageGb)) < 0.01) || STORAGE_TIERS[0];

  const now = new Date();
  const daysRemaining = tenant.nextBillingCycle
    ? Math.max(0, Math.ceil((tenant.nextBillingCycle.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
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
    storageGb: Number(tenant.storageGb),
    storageTier: currentTier,
    priceMonthly: currentTier.priceMonthly,
    subscriptionType: tenant.subscriptionType,
    subscriptionStart: tenant.subscriptionStart,
    nextBillingCycle: tenant.nextBillingCycle,
    daysRemaining,
    applicationStatus: tenant.applicationStatus,
    isActive: tenant.isActive,
  };
}

export async function getAvailablePlans(tenantId: string) {
  const [tenant] = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

  return STORAGE_TIERS.map(t => ({
    ...t,
    isCurrentPlan: Math.abs(t.storageGb - Number(tenant.storageGb)) < 0.01,
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
    .select()
    .from(invoices)
    .where(eq(invoices.tenantId, tenantId))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total,
    page,
    limit,
    totalPages,
  };
}

export async function getInvoiceDetail(invoiceId: string, tenantId: string) {
  const [invoice] = await publicDb
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

  if (!invoice) throw new HttpError(404, 'Invoice tidak ditemukan');

  const payments = await publicDb
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.invoiceId, invoiceId))
    .orderBy(desc(paymentTransactions.createdAt));

  return { ...invoice, planName: '', payments };
}

export async function upgradePlan(tenantId: string, newStorageGb: number) {
  const [tenant] = await publicDb.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

  const tier = STORAGE_TIERS.find(t => Math.abs(t.storageGb - newStorageGb) < 0.01);
  if (!tier) throw new HttpError(404, 'Storage tier tidak valid');

  if (Math.abs(tier.storageGb - Number(tenant.storageGb)) < 0.01) {
    throw new HttpError(409, 'Anda sudah menggunakan storage tier ini');
  }

  if (tier.priceMonthly === 0) {
    await publicDb.update(tenants)
      .set({ storageGb: tier.storageGb.toString() })
      .where(eq(tenants.id, tenantId));
    return { redirectToContact: false, message: 'Berhasil downgrade ke storage 100 MB (Free).' };
  }

  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await publicDb.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id: invoiceId,
      tenantId,
      planId: `storage_${tier.id}`,
      amount: tier.priceMonthly,
      status: 'pending',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      periodStart: now,
      periodEnd,
      notes: `Upgrade storage to ${tier.name}`,
    });

    await tx.update(tenants)
      .set({
        storageGb: tier.storageGb.toString(),
        subscriptionStart: now,
        nextBillingCycle: periodEnd,
        applicationStatus: 'provisioned',
      })
      .where(eq(tenants.id, tenantId));
  });

  return {
    redirectToContact: false,
    message: `Berhasil upgrade ke ${tier.name}. Invoice sedang diproses.`,
    invoiceId,
  };
}
