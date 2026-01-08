import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InvoiceDetail, InvoiceFee } from '../services/invoice-detail-service';

export interface InvoicePDFOptions {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  logoUrl?: string;
}

interface ParsedLineItem {
  style: string;
  color: string;
  description: string;
  sizes: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

function parseLineItemDescription(description: string, rawData?: any): ParsedLineItem {
  let style = '';
  let color = '';
  let sizes = '';
  let cleanDescription = description || '';

  if (rawData) {
    style = rawData.style || rawData.styleName || rawData.product?.style || '';
    color = rawData.color || rawData.colorName || rawData.product?.color || '';

    if (rawData.sizes && typeof rawData.sizes === 'object') {
      const sizeEntries = Object.entries(rawData.sizes)
        .filter(([_, qty]) => qty && Number(qty) > 0)
        .map(([size, qty]) => `${size}:${qty}`);
      sizes = sizeEntries.join(', ');
    } else if (rawData.sizeBreakdown) {
      sizes = rawData.sizeBreakdown;
    }
  }

  if (!style || !color) {
    const styleColorMatch = description.match(/^([A-Za-z0-9\s]+?)\s*[-–]\s*([A-Za-z\s]+?)(?:\s*[-–]|$)/);
    if (styleColorMatch) {
      if (!style) style = styleColorMatch[1].trim();
      if (!color) color = styleColorMatch[2].trim();
    }

    const gildenMatch = description.match(/(Gildan|Next Level|Bella\+Canvas|Hanes|Fruit of the Loom|Champion|Comfort Colors|Port & Company|District|American Apparel)\s*([A-Za-z0-9]+)/i);
    if (gildenMatch && !style) {
      style = `${gildenMatch[1]} ${gildenMatch[2]}`;
    }
  }

  if (!sizes) {
    const sizesMatch = description.match(/\b((?:(?:2?X?S|S|M|L|2?X?L|3XL|4XL|5XL|YS|YM|YL)(?:\s*:\s*\d+)?(?:\s*,\s*)?)+)\b/i);
    if (sizesMatch) {
      sizes = sizesMatch[1];
    }
  }

  if (style || color) {
    cleanDescription = description
      .replace(new RegExp(`^${style}\\s*[-–]?\\s*`, 'i'), '')
      .replace(new RegExp(`^${color}\\s*[-–]?\\s*`, 'i'), '')
      .trim();
  }

  return {
    style: style || '-',
    color: color || '-',
    description: cleanDescription || description || 'Line Item',
    sizes: sizes || '-',
    quantity: 0,
    unitPrice: 0,
    total: 0,
  };
}

export function generateInvoicePDF(
  invoice: InvoiceDetail,
  options: InvoicePDFOptions = {}
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPosition = 15;

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', margin, 22);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${invoice.visualId}`, margin, 30);

  if (options.companyName) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const companyX = pageWidth - margin - doc.getTextWidth(options.companyName);
    doc.text(options.companyName, companyX, 22);
  }

  yPosition = 45;

  doc.setFillColor(249, 250, 251);
  doc.rect(margin, yPosition, pageWidth - margin * 2, 50, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.rect(margin, yPosition, pageWidth - margin * 2, 50, 'S');

  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 10;

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', col1X, yPosition + 8);

  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoice.contact.name || 'Customer', col1X, yPosition + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let billToY = yPosition + 21;

  if (invoice.contact.company) {
    doc.text(invoice.contact.company, col1X, billToY);
    billToY += 5;
  }
  if (invoice.contact.email) {
    doc.text(invoice.contact.email, col1X, billToY);
    billToY += 5;
  }
  if (invoice.contact.phone) {
    doc.text(invoice.contact.phone, col1X, billToY);
  }

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS:', col2X, yPosition + 8);

  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const detailsData = [
    ['Invoice Date:', formatDate(invoice.invoiceDate)],
    ['Due Date:', formatDate(invoice.dueDate)],
    ['Status:', invoice.status],
  ];

  if (invoice.customerPO) {
    detailsData.push(['Customer PO:', invoice.customerPO]);
  }

  let detailY = yPosition + 15;
  detailsData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(label, col2X, detailY);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(value, col2X + 30, detailY);
    detailY += 5;
  });

  yPosition = 105;

  const lineItemsData = invoice.lineItems.map((item) => {
    const parsed = parseLineItemDescription(item.description, (item as any).rawData);
    return [
      parsed.style,
      parsed.color,
      parsed.description.substring(0, 40) + (parsed.description.length > 40 ? '...' : ''),
      parsed.sizes !== '-' ? parsed.sizes : String(item.quantity),
      item.quantity.toString(),
      `$${item.unitPrice.toFixed(2)}`,
      `$${item.totalPrice.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Style', 'Color', 'Description', 'Sizes', 'Qty', 'Unit Price', 'Total']],
    body: lineItemsData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 20 },
      2: { cellWidth: 45 },
      3: { cellWidth: 30 },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  });

  let finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;

  if (invoice.fees.length > 0) {
    finalY += 5;

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'bold');
    doc.text('FEES & ADDITIONAL CHARGES', margin, finalY);
    finalY += 5;

    const feesData = invoice.fees.map((fee: InvoiceFee) => [
      fee.name,
      fee.description !== fee.name ? fee.description : '',
      fee.taxable ? 'Yes' : 'No',
      `$${fee.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [['Fee Name', 'Description', 'Taxable', 'Amount']],
      body: feesData,
      theme: 'grid',
      headStyles: {
        fillColor: [75, 85, 99],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 70 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    });

    finalY = (doc as any).lastAutoTable?.finalY || finalY + 20;
  }

  finalY += 10;

  const totalsX = pageWidth - margin - 80;
  const totalsWidth = 80;

  doc.setFillColor(249, 250, 251);
  doc.rect(totalsX - 5, finalY - 3, totalsWidth + 10, 55, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.rect(totalsX - 5, finalY - 3, totalsWidth + 10, 55, 'S');

  const totalsData = [
    { label: 'Subtotal:', value: `$${invoice.subtotal.toFixed(2)}`, bold: false },
  ];

  if (invoice.feesTotal > 0) {
    totalsData.push({ label: 'Fees:', value: `$${invoice.feesTotal.toFixed(2)}`, bold: false });
  }

  if (invoice.discounts > 0) {
    totalsData.push({ label: 'Discounts:', value: `-$${invoice.discounts.toFixed(2)}`, bold: false });
  }

  totalsData.push({ label: 'Tax:', value: `$${invoice.tax.toFixed(2)}`, bold: false });
  totalsData.push({ label: 'Total:', value: `$${invoice.total.toFixed(2)}`, bold: true });

  if (invoice.amountPaid > 0) {
    totalsData.push({ label: 'Paid:', value: `-$${invoice.amountPaid.toFixed(2)}`, bold: false });
    totalsData.push({ label: 'Balance Due:', value: `$${invoice.amountOutstanding.toFixed(2)}`, bold: true });
  }

  let totalsY = finalY;
  totalsData.forEach((item, index) => {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
    doc.text(item.label, totalsX, totalsY + 5);

    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
    if (item.bold) doc.setFontSize(11);
    const valueWidth = doc.getTextWidth(item.value);
    doc.text(item.value, totalsX + totalsWidth - valueWidth, totalsY + 5);
    totalsY += 7;
  });

  if (invoice.notes) {
    const notesY = Math.max(finalY + 60, totalsY + 15);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES:', margin, notesY);

    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, notesY + 6);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`,
    margin,
    pageHeight - 10
  );

  doc.save(`Invoice-${invoice.visualId}.pdf`);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
}
