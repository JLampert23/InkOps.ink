import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFColumn {
  header: string;
  dataKey: string;
  formatter?: (value: any) => string;
}

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: PDFColumn[];
  data: Record<string, any>[];
  orientation?: 'portrait' | 'landscape';
}

export const exportToPDF = (options: PDFExportOptions): void => {
  const { title, subtitle, filename, columns, data, orientation = 'landscape' } = options;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  });

  doc.setFontSize(18);
  doc.text(title, 14, 20);

  if (subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 28);
  }

  const tableData = data.map(row => {
    const formattedRow: Record<string, string> = {};
    columns.forEach(col => {
      const value = row[col.dataKey];
      formattedRow[col.dataKey] = col.formatter ? col.formatter(value) : String(value ?? '');
    });
    return formattedRow;
  });

  autoTable(doc, {
    startY: subtitle ? 32 : 25,
    head: [columns.map(col => col.header)],
    body: tableData.map(row => columns.map(col => row[col.dataKey])),
    theme: 'striped',
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: columns.reduce((acc, col, index) => {
      if (col.header.includes('Amount') || col.header.includes('Total') || col.header.includes('Outstanding')) {
        acc[index] = { halign: 'right' };
      }
      return acc;
    }, {} as Record<number, any>)
  });

  doc.save(`${filename}.pdf`);
};
