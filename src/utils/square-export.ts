import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
  format?: (value: any) => string;
}

export interface SquareExportOptions {
  filename: string;
  title: string;
  columns: ExportColumn[];
  data: any[];
  dateRange?: string;
  summary?: { label: string; value: string }[];
}

export function exportToCSV(options: SquareExportOptions): void {
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

export function exportToPDF(options: SquareExportOptions): void {
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
      fillColor: [34, 197, 94],
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

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}
