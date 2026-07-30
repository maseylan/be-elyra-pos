import { Request, Response, NextFunction } from 'express';
import { publicDb } from '../db/poolManager';
import { outgoingMails } from '../db/schema';
import { eq, desc, like, sql, and, gte, lte } from 'drizzle-orm';
import { sendMail } from '../services/email.service';

export async function getMailStats(req: Request, res: Response, next: NextFunction) {
  try {
    const [stats] = await publicDb
      .select({
        total: sql<number>`count(*)`,
        sent: sql<number>`count(*) filter (where ${outgoingMails.status} = 'sent')`,
        pending: sql<number>`count(*) filter (where ${outgoingMails.status} = 'pending')`,
        failed: sql<number>`count(*) filter (where ${outgoingMails.status} = 'failed')`,
      })
      .from(outgoingMails);
    res.json(stats);
  } catch (e) { next(e); }
}

export async function getOutgoingMails(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;
    const tenant = req.query.tenant as string | undefined;
    const type = req.query.type as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const conditions: any[] = [];
    if (status && ['pending', 'sent', 'failed'].includes(status)) {
      conditions.push(eq(outgoingMails.status, status));
    }
    if (q) {
      conditions.push(like(outgoingMails.recipient, `%${q}%`));
    }
    if (tenant) {
      conditions.push(eq(outgoingMails.tenantId, tenant));
    }
    if (type) {
      conditions.push(eq(outgoingMails.emailType, type));
    }
    if (from) {
      conditions.push(gte(outgoingMails.createdAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(outgoingMails.createdAt, new Date(to)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await publicDb
      .select({ count: sql<number>`count(*)` })
      .from(outgoingMails)
      .where(where);

    const total = Number(countResult?.count || 0);
    const totalPages = Math.ceil(total / limit);

    const items = await publicDb
      .select()
      .from(outgoingMails)
      .where(where)
      .orderBy(desc(outgoingMails.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    res.json({ items, total, page, limit, totalPages });
  } catch (e) { next(e); }
}

export async function retryOutgoingMail(req: Request, res: Response, next: NextFunction) {
  try {
    const [mail] = await publicDb
      .select()
      .from(outgoingMails)
      .where(eq(outgoingMails.id, req.params.id as string));

    if (!mail) return res.status(404).json({ error: 'Mail not found' });
    if (mail.status === 'sent') return res.status(400).json({ error: 'Mail already sent' });

    await sendMail({
      to: mail.recipient,
      subject: mail.subject,
      html: mail.htmlContent,
      tenantId: mail.tenantId || undefined,
      tenantName: mail.tenantName || undefined,
      provider: mail.provider || 'titan',
      emailType: mail.emailType || 'general',
    });

    await publicDb.update(outgoingMails)
      .set({ retryCount: mail.retryCount + 1, updatedAt: new Date() })
      .where(eq(outgoingMails.id, mail.id));

    res.json({ message: 'Mail resent successfully' });
  } catch (e) { next(e); }
}
