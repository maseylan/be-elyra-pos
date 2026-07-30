import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as ownerBillingService from '../services/owner-billing.service';
import * as pdfService from '../services/pdf.service';

const upgradeSchema = z.object({
  storageGb: z.number().min(0.1).max(100),
});

export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.auth!.tenantId!;
    const data = await ownerBillingService.getSubscription(tenantId);
    res.json(data);
  } catch (e) { next(e); }
}

export async function getAvailablePlans(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.auth!.tenantId!;
    const plans = await ownerBillingService.getAvailablePlans(tenantId);
    res.json(plans);
  } catch (e) { next(e); }
}

export async function getInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.auth!.tenantId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const data = await ownerBillingService.getInvoices(tenantId, page, limit);
    res.json(data);
  } catch (e) { next(e); }
}

export async function getInvoiceDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.auth!.tenantId!;
    const data = await ownerBillingService.getInvoiceDetail(req.params.id as string, tenantId);
    res.json(data);
  } catch (e) { next(e); }
}

export async function getInvoicePdf(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.auth!.tenantId!;
    const invoice = await ownerBillingService.getInvoiceDetail(req.params.id as string, tenantId);
    const tenantData = await ownerBillingService.getSubscription(tenantId);

    const pdfBuffer = await pdfService.generateInvoicePdf({
      invoice,
      tenant: tenantData.tenant,
      planName: invoice.planName || '',
      payments: invoice.payments || [],
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id as string}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) { next(e); }
}

export async function upgradePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.auth!.tenantId!;
    const { storageGb } = upgradeSchema.parse(req.body);
    const result = await ownerBillingService.upgradePlan(tenantId, storageGb);
    res.json(result);
  } catch (e) { next(e); }
}
