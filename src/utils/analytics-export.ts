import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
  format?: (value: any) => string;
}

export interface ExportOptions {
  filename: string;
  title: string;
  columns: ExportColumn[];
  data: any[];
  dateRange?: string;
  summary?: { label: string; value: string }[];
}

export function exportToCSV(options: ExportOptions): void {
  const { filename, columns, data } = options;

  const headers = columns.map(col => col.header);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (col.format) {
        return col.format(value);
      }
      return value !== null && value !== undefined ? String(value) : '';
    })
  );

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return `"${stringCell.replace(/"/g, '""')}"`;
        }
        return stringCell;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportToPDF(options: ExportOptions): void {
  const { filename, title, columns, data, dateRange, summary } = options;

  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);

  let yPosition = 30;

  if (dateRange) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(dateRange, 14, yPosition);
    yPosition += 10;
  }

  if (summary && summary.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    summary.forEach(item => {
      doc.text(`${item.label}: ${item.value}`, 14, yPosition);
      yPosition += 6;
    });
    yPosition += 4;
  }

  const tableData = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (col.format) {
        return col.format(value);
      }
      return value !== null && value !== undefined ? String(value) : '';
    })
  );

  autoTable(doc, {
    head: [columns.map(col => col.header)],
    body: tableData,
    startY: yPosition,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 20 },
  });

  doc.save(`${filename}.pdf`);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

export function exportAnalyticsReport(
  invoices: any[],
  _payments: any[],
  reportName: string,
  format: 'csv' | 'pdf',
  dateRange: { startDate: Date; endDate: Date }
): void {
  const dateRangeStr = `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${reportName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`;

  const columns: ExportColumn[] = [
    { header: 'Customer', key: 'customer' },
    { header: 'Invoice #', key: 'invoiceNumber' },
    { header: 'Date', key: 'date', format: formatDate },
    { header: 'Total', key: 'total', format: formatCurrency },
    { header: 'Status', key: 'status' },
  ];

  const data = invoices.map(invoice => ({
    customer: invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown',
    invoiceNumber: invoice.visualId || invoice.id?.slice(0, 8) || '',
    date: invoice.createdAt,
    total: invoice.total || 0,
    status: invoice.status?.name || 'N/A',
  }));

  const summary = [
    { label: 'Report', value: reportName },
    { label: 'Date Range', value: dateRangeStr },
    { label: 'Total Invoices', value: String(invoices.length) },
    {
      label: 'Total Amount',
      value: formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total || 0), 0))
    },
  ];

  const options: ExportOptions = {
    filename,
    title: reportName,
    columns,
    data,
    dateRange: dateRangeStr,
    summary,
  };

  if (format === 'csv') {
    exportToCSV(options);
  } else {
    exportToPDF(options);
  }
}
