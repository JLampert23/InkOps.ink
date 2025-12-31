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
  summary?: { label: string; value: string }[];
}

export const exportToPDF = (options: PDFExportOptions): void => {
  const { title, subtitle, filename, columns, data, orientation = 'landscape', summary } = options;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let yPosition = 20;

  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 12, 'F');

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 9);

  yPosition = 22;

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');

    const subtitleLines = doc.splitTextToSize(subtitle, pageWidth - (margin * 2));
    doc.text(subtitleLines, margin, yPosition);
    yPosition += (subtitleLines.length * 5) + 5;
  } else {
    yPosition += 3;
  }

  if (summary && summary.length > 0) {
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, yPosition, pageWidth - (margin * 2), 8 + (Math.ceil(summary.length / 4) * 8), 'F');

    doc.setDrawColor(229, 231, 235);
    doc.rect(margin, yPosition, pageWidth - (margin * 2), 8 + (Math.ceil(summary.length / 4) * 8), 'S');

    yPosition += 6;

    const summaryItemWidth = (pageWidth - (margin * 2)) / Math.min(summary.length, 4);
    summary.forEach((item, index) => {
      const xPos = margin + (index % 4) * summaryItemWidth + 3;
      const yPos = yPosition + Math.floor(index / 4) * 8;

      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      doc.text(item.label, xPos, yPos);

      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, xPos, yPos + 4);
    });

    yPosition += (Math.ceil(summary.length / 4) * 8) + 5;
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
    startY: yPosition,
    head: [columns.map(col => col.header)],
    body: tableData.map(row => columns.map(col => row[col.dataKey])),
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 10,
      cellPadding: 4
    },
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      lineColor: [229, 231, 235],
      lineWidth: 0.1
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    columnStyles: columns.reduce((acc, col, index) => {
      if (col.header.includes('Amount') || col.header.includes('Total') || col.header.includes('Outstanding') || col.header.includes('Paid') || col.header.includes('Revenue')) {
        acc[index] = { halign: 'right', fontStyle: 'bold' };
      } else if (col.header.includes('Date') || col.header.includes('Invoice')) {
        acc[index] = { halign: 'center' };
      }
      return acc;
    }, {} as Record<number, any>),
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.setFont('helvetica', 'normal');

      const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();

      const footerText = `Page ${pageNumber} of ${totalPages}`;
      const footerX = pageWidth - margin - doc.getTextWidth(footerText);
      doc.text(footerText, footerX, pageHeight - 10);

      const generatedText = `Generated on ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      doc.text(generatedText, margin, pageHeight - 10);
    }
  });

  doc.save(`${filename}.pdf`);
};
