import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface ARInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  balance_remaining: number;
  days_overdue: number;
  aging_bucket: '0-30' | '31-60' | '61-90' | '90+';
}

export interface ARExportOptions {
  invoices: ARInvoice[];
  columns: string[];
  includeHeaders?: boolean;
  companyName?: string;
  logoUrl?: string;
}

export const AR_COLUMNS = {
  invoice_number: 'Invoice #',
  customer_name: 'Customer',
  invoice_date: 'Invoice Date',
  due_date: 'Due Date',
  total: 'Total Amount',
  amount_paid: 'Amount Paid',
  balance_remaining: 'Balance Remaining',
  days_overdue: 'Days Overdue',
  aging_bucket: 'Aging Bucket',
};

export function exportARToCSV(options: ARExportOptions): string {
  const { invoices, columns, includeHeaders = true } = options;

  const rows: string[] = [];

  if (includeHeaders) {
    const headers = columns.map(col => AR_COLUMNS[col as keyof typeof AR_COLUMNS] || col);
    rows.push(headers.map(h => `"${h}"`).join(','));
  }

  invoices.forEach(invoice => {
    const values = columns.map(col => {
      const value = invoice[col as keyof ARInvoice];

      if (col === 'invoice_date' || col === 'due_date') {
        return `"${format(new Date(value as string), 'MM/dd/yyyy')}"`;
      }

      if (col === 'total' || col === 'amount_paid' || col === 'balance_remaining') {
        return `"$${(value as number).toFixed(2)}"`;
      }

      return `"${value}"`;
    });

    rows.push(values.join(','));
  });

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance_remaining, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);

  rows.push('');
  rows.push('"Summary"');
  rows.push(`"Total Outstanding","$${totalOutstanding.toFixed(2)}"`);
  rows.push(`"Total Paid","$${totalPaid.toFixed(2)}"`);
  rows.push(`"Total Invoiced","$${totalInvoiced.toFixed(2)}"`);

  return rows.join('\n');
}

export function downloadCSV(csvContent: string, filename: string = 'accounts-receivable-report.csv'): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportARToPDF(options: ARExportOptions): Promise<void> {
  const { invoices, columns, companyName = 'Company Name' } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Accounts Receivable Report', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy h:mm a')}`, pageWidth / 2, yPosition, { align: 'center' });
  doc.text(companyName, pageWidth / 2, yPosition + 5, { align: 'center' });

  yPosition += 15;

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance_remaining, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Outstanding: $${totalOutstanding.toFixed(2)}`, 14, yPosition);
  doc.text(`Total Paid: $${totalPaid.toFixed(2)}`, 14, yPosition + 6);
  doc.text(`Total Invoiced: $${totalInvoiced.toFixed(2)}`, 14, yPosition + 12);
  doc.text(`Invoice Count: ${invoices.length}`, 14, yPosition + 18);

  yPosition += 25;

  const agingBuckets = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  };

  invoices.forEach(inv => {
    agingBuckets[inv.aging_bucket] += inv.balance_remaining;
  });

  doc.setFontSize(9);
  doc.text('Aging Buckets:', 14, yPosition);
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`0-30 days: $${agingBuckets['0-30'].toFixed(2)}`, 20, yPosition);
  doc.text(`31-60 days: $${agingBuckets['31-60'].toFixed(2)}`, 20, yPosition + 5);
  doc.text(`61-90 days: $${agingBuckets['61-90'].toFixed(2)}`, 20, yPosition + 10);
  doc.text(`90+ days: $${agingBuckets['90+'].toFixed(2)}`, 20, yPosition + 15);

  yPosition += 25;

  const headers = columns.map(col => AR_COLUMNS[col as keyof typeof AR_COLUMNS] || col);

  const tableData = invoices.map(invoice => {
    return columns.map(col => {
      const value = invoice[col as keyof ARInvoice];

      if (col === 'invoice_date' || col === 'due_date') {
        return format(new Date(value as string), 'MM/dd/yyyy');
      }

      if (col === 'total' || col === 'amount_paid' || col === 'balance_remaining') {
        return `$${(value as number).toFixed(2)}`;
      }

      return String(value);
    });
  });

  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: yPosition,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [51, 122, 183],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: columns.reduce((acc, col, idx) => {
      if (col === 'total' || col === 'amount_paid' || col === 'balance_remaining') {
        acc[idx] = { halign: 'right' };
      }
      if (col === 'days_overdue') {
        acc[idx] = { halign: 'center' };
      }
      return acc;
    }, {} as any),
    margin: { top: 20, right: 14, bottom: 20, left: 14 },
  });

  doc.save(`accounts-receivable-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function getDefaultARColumns(): string[] {
  return [
    'invoice_number',
    'customer_name',
    'invoice_date',
    'due_date',
    'total',
    'amount_paid',
    'balance_remaining',
    'aging_bucket',
  ];
}
