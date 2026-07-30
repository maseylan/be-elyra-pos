import nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { publicDb } from '../db/poolManager';
import { outgoingMails } from '../db/schema';
import { eq } from 'drizzle-orm';
dotenv.config();

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.titan.email',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }
  return transporter;
}

function loadTemplate(name: string, vars: Record<string, string>): string {
  const p = path.join(__dirname, '../templates/email', `${name}.html`);
  let html = fs.readFileSync(p, 'utf-8');
  for (const [k, v] of Object.entries(vars)) {
    html = html.replaceAll(`{${k}}`, v);
  }
  return html;
}

function fmtCurrency(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFrom(): string {
  return process.env.MAIL_FROM || '"Elyra POS" <info@elyrapos.my.id>';
}

export interface MailMeta {
  tenantId?: string;
  tenantName?: string;
  provider?: string;
  emailType?: string;
}

export async function sendMail(options: { to: string; subject: string; html: string } & MailMeta): Promise<void> {
  const t = getTransporter();

  let recordId: string | null = null;
  try {
    const id = `mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await publicDb.insert(outgoingMails).values({
      id,
      recipient: options.to,
      subject: options.subject,
      htmlContent: options.html,
      status: 'pending',
      tenantId: options.tenantId || null,
      tenantName: options.tenantName || null,
      provider: options.provider || 'titan',
      emailType: options.emailType || 'general',
    });
    recordId = id;
  } catch (e) {
    console.warn('Failed to persist outgoing mail record:', e);
  }

  try {
    await t.sendMail({
      from: getFrom(),
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    if (recordId) {
      await publicDb.update(outgoingMails)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(outgoingMails.id, recordId))
        .catch(e => console.warn('Failed to update mail status to sent:', e));
    }
  } catch (err) {
    if (recordId) {
      await publicDb.update(outgoingMails)
        .set({ status: 'failed', errorMessage: (err as Error).message })
        .where(eq(outgoingMails.id, recordId))
        .catch(e => console.warn('Failed to update mail status to failed:', e));
    }
    throw err;
  }
}

export async function sendVerificationEmail(email: string, verifyLink: string, meta?: MailMeta): Promise<void> {
  const html = loadTemplate('verify-email', { VERIFY_LINK: verifyLink });
  await sendMail({ to: email, subject: 'Verifikasi Email - Elyra POS', html, emailType: 'verification', ...meta });
}

export async function sendOtp(email: string, otp: string, meta?: MailMeta): Promise<void> {
  const html = loadTemplate('otp', { OTP: otp });
  await sendMail({ to: email, subject: 'Kode Verifikasi Elyra POS', html, emailType: 'otp', ...meta });
}

export async function sendResetPassword(email: string, resetLink: string, meta?: MailMeta): Promise<void> {
  const html = loadTemplate('reset-password', { RESET_LINK: resetLink });
  await sendMail({ to: email, subject: 'Reset Password Elyra POS', html, emailType: 'reset_password', ...meta });
}

export async function sendBillingInvoice(email: string, vars: Record<string, string>, meta?: MailMeta): Promise<void> {
  const html = loadTemplate('billing-invoice', vars);
  await sendMail({ to: email, subject: 'Invoice Langganan - Elyra POS', html, emailType: 'billing', ...meta });
}

export interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
}

export interface InvoiceData {
  orderNumber: string;
  outletName: string;
  outletAddress: string;
  date: Date;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
}

export async function sendInvoice(email: string, data: InvoiceData, meta?: MailMeta): Promise<void> {
  const tableRows = data.items.map(it => `
    <tr>
      <td>${it.name}</td>
      <td align="center">${it.qty}</td>
      <td align="right">${fmtCurrency(it.price)}</td>
      <td align="right">${fmtCurrency(it.price * it.qty)}</td>
    </tr>
  `).join('');

  const html = loadTemplate('invoice', {
    ORDER_NUMBER: data.orderNumber,
    OUTLET_NAME: data.outletName,
    OUTLET_ADDRESS: data.outletAddress,
    DATE: fmtDate(data.date),
    ITEMS_ROWS: tableRows,
    SUBTOTAL: fmtCurrency(data.subtotal),
    TAX: fmtCurrency(data.tax),
    DISCOUNT: fmtCurrency(data.discount),
    TOTAL: fmtCurrency(data.total),
    PAYMENT_METHOD: data.paymentMethod,
    AMOUNT_PAID: fmtCurrency(data.amountPaid),
    CHANGE: fmtCurrency(data.change),
  });
  await sendMail({ to: email, subject: `Invoice ${data.orderNumber} - Elyra POS`, html, emailType: 'invoice', ...meta });
}
