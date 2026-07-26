import PDFDocument from 'pdfkit';

interface InvoiceData {
  id: string;
  amount: number;
  status: string;
  dueDate: Date | null;
  paidAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  notes: string | null;
  createdAt: Date | null;
  planName: string;
}

interface TenantData {
  id: string;
  name: string;
  email: string;
  ownerName: string;
  subdomain: string;
}

interface PaymentData {
  method: string | null;
  amount: number;
  status: string | null;
  paidAt: Date | null;
  reference: string | null;
}

interface GenerateParams {
  invoice: InvoiceData;
  tenant: TenantData;
  planName: string;
  payments: PaymentData[];
}

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function generateInvoicePdf(params: GenerateParams): Promise<Buffer> {
  const { invoice, tenant, planName, payments } = params;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const primaryColor = '#0D7A5F';
    const grayColor = '#6B7280';
    const lightBg = '#F3F4F6';
    const pageWidth = doc.page.width - 100;
    const leftX = 50;

    // Header
    doc.fontSize(24).font('Helvetica-Bold').fillColor(primaryColor).text('ELYRA POS', leftX, 50);
    doc.fontSize(10).font('Helvetica').fillColor(grayColor).text('Platform POS Digital untuk Bisnis Anda', leftX, 78);

    // Invoice title
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#111827').text('INVOICE', leftX, 115);

    // Invoice number & status
    const statusColors: Record<string, string> = { paid: '#059669', pending: '#D97706', overdue: '#DC2626', cancelled: '#6B7280' };
    const statusLabels: Record<string, string> = { paid: 'LUNAS', pending: 'MENUNGGU', overdue: 'TERLAMBAT', cancelled: 'DIBATALKAN' };
    const statusColor = statusColors[invoice.status] || grayColor;
    const statusLabel = statusLabels[invoice.status] || invoice.status.toUpperCase();

    doc.fontSize(10).fillColor(grayColor).text(`No. Invoice: ${invoice.id}`, leftX, 140);
    doc.fontSize(10).fillColor(grayColor).text(`Tanggal: ${formatDate(invoice.createdAt)}`, leftX, 155);

    doc.fillColor(statusColor)
      .fontSize(11).font('Helvetica-Bold')
      .text(statusLabel, pageWidth - 80, 140, { width: 80, align: 'center' });

    // Separator
    doc.moveTo(leftX, 175).lineTo(leftX + pageWidth, 175).strokeColor('#E5E7EB').stroke();

    // From / To
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Dari:', leftX, 190);
    doc.fontSize(9).font('Helvetica').fillColor('#374151').text('Elyra POS', leftX, 205);
    doc.fontSize(9).fillColor(grayColor).text('sales@elyrapos.com', leftX, 220);

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Kepada:', leftX + 250, 190);
    doc.fontSize(9).font('Helvetica').fillColor('#374151').text(tenant.name, leftX + 250, 205);
    doc.fontSize(9).fillColor(grayColor).text(`${tenant.ownerName}`, leftX + 250, 220);
    doc.fontSize(9).fillColor(grayColor).text(tenant.email, leftX + 250, 235);

    // Period
    const periodY = 260;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Periode:', leftX, periodY);
    doc.fontSize(9).font('Helvetica').fillColor('#374151').text(
      `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`,
      leftX, periodY + 15,
    );

    // Table Header
    const tableY = 300;
    doc.rect(leftX, tableY, pageWidth, 22).fill(lightBg);
    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold');
    doc.text('Deskripsi', leftX + 10, tableY + 5, { width: 300 });
    doc.text('Jumlah', leftX + pageWidth - 100, tableY + 5, { width: 90, align: 'right' });

    // Table Row
    const rowY = tableY + 25;
    doc.fillColor('#374151').fontSize(10).font('Helvetica');
    doc.text(`${planName} - ${formatDate(invoice.periodStart || invoice.createdAt)}`, leftX + 10, rowY, { width: 300 });
    doc.text(formatCurrency(invoice.amount), leftX + pageWidth - 100, rowY, { width: 90, align: 'right' });

    // Total
    const totalY = rowY + 30;
    doc.rect(leftX, totalY, pageWidth, 25).fill(lightBg);
    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold');
    doc.text('Total', leftX + 10, totalY + 6, { width: 200 });
    doc.text(formatCurrency(invoice.amount), leftX + pageWidth - 120, totalY + 6, { width: 110, align: 'right' });

    // Payment info
    let paymentY = totalY + 50;
    if (payments.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text('Pembayaran:', leftX, paymentY);
      paymentY += 18;
      for (const pm of payments) {
        doc.fontSize(9).font('Helvetica').fillColor('#374151');
        doc.text(`• ${pm.method || '-'} — ${formatCurrency(pm.amount)}`, leftX, paymentY);
        doc.fillColor(grayColor).text(formatDate(pm.paidAt), leftX + 200, paymentY);
        paymentY += 16;
      }
    }

    // Notes
    if (invoice.notes) {
      paymentY += 10;
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(grayColor).text(`Catatan: ${invoice.notes}`, leftX, paymentY);
    }

    // Footer
    const footerY = doc.page.height - 80;
    doc.moveTo(leftX, footerY).strokeColor('#E5E7EB').stroke();
    doc.fontSize(8).font('Helvetica').fillColor(grayColor).text(
      'Elyra POS — Platform POS Digital',
      leftX, footerY + 10, { align: 'center', width: pageWidth },
    );
    doc.text('sales@elyrapos.com', leftX, footerY + 22, { align: 'center', width: pageWidth });

    doc.end();
  });
}
