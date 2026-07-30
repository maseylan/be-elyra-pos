import { Request, Response } from 'express';
import { z } from 'zod';
import * as tenantService from '../services/tenant.service';
import { generateVerificationToken, verifyEmailToken } from '../services/otp.service';
import { sendVerificationEmail, sendBillingInvoice } from '../services/email.service';
import { publicDb } from '../db/poolManager';
import { tenants, superAdmins, invoices } from '../db/schema';
import { eq } from 'drizzle-orm';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

const registerSchema = z.object({
  name: z.string().min(1),
  subdomain: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  ownerName: z.string().min(1),
  whatsappNumber: z.string().optional(),
});

export const registerTenant = asyncHandler(async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const tenant = await tenantService.registerTenant(data);
    const token = await generateVerificationToken(data.email);
    const rootDomain = process.env.ROOT_DOMAIN || 'elyrapos.my.id';
    const verifyLink = `https://${rootDomain}/verify-email?token=${token}&email=${encodeURIComponent(data.email)}`;
    sendVerificationEmail(data.email, verifyLink, { tenantId: tenant.id, tenantName: tenant.name }).catch(e => console.warn('Verification email failed:', e));
    res.status(201).json({
      message: 'Pendaftaran berhasil. Silakan cek email untuk verifikasi.',
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    if (error.message === 'SUBDOMAIN_TAKEN') throw new HttpError(400, error.message);
    throw error;
  }
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, token } = z.object({ email: z.string().email(), token: z.string().min(1) }).parse(req.body);
  const valid = await verifyEmailToken(email, token);
  if (!valid) {
    return res.status(400).json({ error: 'Token tidak valid atau sudah kedaluwarsa' });
  }
  await publicDb.update(tenants).set({ emailVerified: true }).where(eq(tenants.email, email)).catch(() => {});
  await publicDb.update(superAdmins).set({ emailVerified: true }).where(eq(superAdmins.email, email)).catch(() => {});

  // create registration invoice async
  const [tenant] = await publicDb.select().from(tenants).where(eq(tenants.email, email)).catch(() => []);
  if (tenant) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await publicDb.insert(invoices).values({
      id, tenantId: tenant.id, planId: tenant.subscriptionType || 'starter',
      amount: 0, status: 'pending', dueDate: now,
      periodStart: now, periodEnd, notes: 'Registrasi akun Elyra POS',
    }).catch(e => console.error('Invoice creation failed:', e));

    sendBillingInvoice(tenant.email, {
      STATUS: 'Pending',
      TENANT_NAME: tenant.name,
      TENANT_EMAIL: tenant.email,
      TENANT_SUBDOMAIN: tenant.subdomain,
      PLAN_NAME: (tenant.subscriptionType || 'Starter').toUpperCase(),
      STORAGE: `${Number(tenant.storageGb) < 1 ? '100 MB' : tenant.storageGb + ' GB'}`,
      PERIOD: `${now.toLocaleDateString('id-ID')} - ${periodEnd.toLocaleDateString('id-ID')}`,
      AMOUNT: 'Rp 0 (Gratis)',
    }, { tenantId: tenant.id, tenantName: tenant.name }).catch(e => console.error('Billing invoice email failed:', e));
  }

  res.json({ message: 'Email berhasil diverifikasi. Silakan login.' });
});

export const provisionTenant = asyncHandler(async (req, res) => {
  const tenantId = req.params.tenantId as string;
  const { plan } = req.body;
  const result = await tenantService.provisionTenant(tenantId, plan);
  res.json(result);
});

export const resolveTenant = asyncHandler(async (req, res) => {
  try {
    const subdomain = req.query.subdomain as string;
    if (!subdomain) return res.status(400).json({ error: 'Subdomain required' });
    const tenant = await tenantService.resolveTenant(subdomain);
    res.json(tenant);
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') throw new HttpError(404, error.message);
    if (error.message === 'TENANT_DEACTIVATED') throw new HttpError(403, error.message);
    if (error.message === 'TENANT_EXPIRED') throw new HttpError(402, error.message);
    if (error.message === 'TENANT_NOT_PROVISIONED') throw new HttpError(400, error.message);
    throw error;
  }
});

export const getAllTenants = asyncHandler(async (req, res) => {
  const tenantsList = await tenantService.getAllTenants();
  res.json(tenantsList);
});

export const getTenantDetails = asyncHandler(async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.tenantId as string);
    res.json(tenant);
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') throw new HttpError(404, error.message);
    throw error;
  }
});

export const setupDatabase = asyncHandler(async (req, res) => {
  const tenantId = (req.params.tenantId as string) || req.body.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  const result = await tenantService.setupDatabase(tenantId);
  res.json(result);
});

export const toggleTenantStatus = asyncHandler(async (req, res) => {
  try {
    const { isActive } = req.body;
    const tenant = await tenantService.toggleTenantStatus(req.params.tenantId as string, isActive);
    res.json(tenant);
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') throw new HttpError(404, error.message);
    throw error;
  }
});

export const updateTenantPlan = asyncHandler(async (req, res) => {
  try {
    const { plan } = req.body;
    const result = await tenantService.updateTenantPlan(req.params.tenantId as string, plan);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') throw new HttpError(404, error.message);
    throw error;
  }
});

export const getTenantDbInfo = asyncHandler(async (req, res) => {
  try {
    const info = await tenantService.getTenantDbInfo(req.params.tenantId as string);
    res.json(info);
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') throw new HttpError(404, error.message);
    throw error;
  }
});

export const checkTenantDbConnection = asyncHandler(async (req, res) => {
  try {
    const result = await tenantService.checkTenantDbConnection(req.params.tenantId as string);
    if (result.status) {
      await publicDb.update(tenants)
        .set({ lastHealthCheckStatus: result.status, lastHealthCheckAt: new Date() })
        .where(eq(tenants.id, req.params.tenantId as string))
        .catch(() => {});
    }
    res.json(result);
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') throw new HttpError(404, error.message);
    throw error;
  }
});

export const getTenantSystemInfo = asyncHandler(async (req, res) => {
  try {
    const info = await tenantService.getTenantSystemInfo(req.params.tenantId as string);
    res.json(info);
  } catch (error: any) {
    if (error.message === 'TENANT_NOT_FOUND') throw new HttpError(404, error.message);
    throw error;
  }
});

export const platformHealthCheck = asyncHandler(async (req, res) => {
  const result = await tenantService.platformHealthCheck();
  res.json(result);
});

export const clearPlatformCache = asyncHandler(async (req, res) => {
  const result = await tenantService.clearPlatformCache();
  res.json(result);
});

export const getPlatformStats = asyncHandler(async (req, res) => {
  const stats = await tenantService.getPlatformStats();
  res.json(stats);
});

export const checkAvailability = asyncHandler(async (req, res) => {
  const { subdomain, email } = req.query;
  const result: Record<string, boolean> = {};
  if (typeof subdomain === 'string') {
    const existing = await publicDb.select({ id: tenants.id }).from(tenants).where(eq(tenants.subdomain, subdomain)).limit(1);
    result.subdomain = existing.length === 0;
  }
  if (typeof email === 'string') {
    const existing = await publicDb.select({ id: tenants.id }).from(tenants).where(eq(tenants.email, email)).limit(1);
    result.email = existing.length === 0;
  }
  res.json(result);
});
