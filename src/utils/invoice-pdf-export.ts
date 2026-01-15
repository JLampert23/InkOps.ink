import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InvoiceDetail, InvoiceFee } from '../services/invoice-detail-service';

export interface InvoicePDFOptions {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  invoiceTerms?: string;
}

/**
 * Generates a clean, modern, professional PDF invoice
 * Following Stripe/Shopify/QuickBooks modern design aesthetics
 */
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
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // ========================================
  // HEADER: Company Info (Left) + Invoice Details (Right)
  // ========================================

  // LEFT SIDE: Company Information
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39); // gray-900
  doc.setFont('helvetica', 'bold');
  doc.text(options.companyName || 'Company Name', margin, yPosition);
  yPosition += 7;

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // gray-500
  doc.setFont('helvetica', 'normal');

  if (options.companyAddress) {
    const addressLines = options.companyAddress.split('\n');
    addressLines.forEach(line => {
      doc.text(line, margin, yPosition);
      yPosition += 4.5;
    });
  }

  if (options.companyPhone) {
    doc.text(options.companyPhone, margin, yPosition);
    yPosition += 4.5;
  }

  if (options.companyEmail) {
    doc.text(options.companyEmail, margin, yPosition);
    yPosition += 4.5;
  }

  // RIGHT SIDE: Invoice Details
  const rightColX = pageWidth - margin - 60;
  let rightY = margin;

  doc.setFontSize(28);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  const invoiceTitleWidth = doc.getTextWidth('INVOICE');
  doc.text('INVOICE', pageWidth - margin - invoiceTitleWidth, rightY);
  rightY += 10;

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');

  const invoiceDetails = [
    ['Invoice Number:', `#${invoice.visualId}`],
    ['Invoice Date:', formatDate(invoice.invoiceDate)],
    ['Due Date:', formatDate(invoice.dueDate)],
    ['Status:', capitalizeStatus(invoice.status)],
  ];

  invoiceDetails.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(label, rightColX, rightY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, pageWidth - margin - valueWidth, rightY);
    rightY += 5;
  });

  yPosition = Math.max(yPosition, rightY) + 10;

  // Subtle divider line
  doc.setDrawColor(229, 231, 235); // gray-200
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 12;

  // ========================================
  // BILL TO SECTION
  // ========================================

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', margin, yPosition);
  yPosition += 6;

  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.contact.name || 'Customer', margin, yPosition);
  yPosition += 5.5;

  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99); // gray-600
  doc.setFont('helvetica', 'normal');

  if (invoice.contact.company) {
    doc.text(invoice.contact.company, margin, yPosition);
    yPosition += 4.5;
  }

  if (invoice.billingAddress?.line1 || invoice.billingAddress?.city) {
    if (invoice.billingAddress.line1) {
      doc.text(invoice.billingAddress.line1, margin, yPosition);
      yPosition += 4.5;
    }
    if (invoice.billingAddress.line2) {
      doc.text(invoice.billingAddress.line2, margin, yPosition);
      yPosition += 4.5;
    }

    const cityStateZip: string[] = [];
    if (invoice.billingAddress.city) cityStateZip.push(invoice.billingAddress.city);
    if (invoice.billingAddress.state) cityStateZip.push(invoice.billingAddress.state);
    if (invoice.billingAddress.zip) cityStateZip.push(invoice.billingAddress.zip);

    if (cityStateZip.length > 0) {
      doc.text(cityStateZip.join(', '), margin, yPosition);
      yPosition += 4.5;
    }
  }

  if (invoice.contact.email) {
    doc.text(invoice.contact.email, margin, yPosition);
    yPosition += 4.5;
  }

  if (invoice.contact.phone) {
    doc.text(invoice.contact.phone, margin, yPosition);
    yPosition += 4.5;
  }

  yPosition += 10;

  // ========================================
  // LINE ITEMS TABLE
  // ========================================

  const lineItemsData = invoice.lineItems.map((item) => [
    item.description || 'Item',
    item.quantity.toString(),
    `$${item.unitPrice.toFixed(2)}`,
    `$${item.totalPrice.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Description', 'Qty', 'Unit Price', 'Line Total']],
    body: lineItemsData,
    theme: 'plain',
    headStyles: {
      fillColor: [249, 250, 251], // gray-50
      textColor: [75, 85, 99], // gray-600
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
    },
    styles: {
      fontSize: 9,
      textColor: [31, 41, 55], // gray-800
      cellPadding: { top: 5, right: 5, bottom: 5, left: 5 },
      lineColor: [229, 231, 235], // gray-200
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // gray-50 (very subtle)
    },
  });

  let finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;

  // ========================================
  // FEES SECTION (if applicable)
  // ========================================

  if (invoice.fees && invoice.fees.length > 0) {
    finalY += 8;

    const feesData = invoice.fees.map((fee: InvoiceFee) => [
      fee.name,
      `$${fee.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [['Additional Charges', 'Amount']],
      body: feesData,
      theme: 'plain',
      headStyles: {
        fillColor: [249, 250, 251],
        textColor: [75, 85, 99],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      },
      styles: {
        fontSize: 9,
        textColor: [31, 41, 55],
        cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 150 },
        1: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
    });

    finalY = (doc as any).lastAutoTable?.finalY || finalY + 20;
  }

  finalY += 15;

  // ========================================
  // TOTALS SECTION (Right-aligned)
  // ========================================

  const totalsX = pageWidth - margin - 60;
  const labelX = totalsX - 35;

  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');

  const totalsData: Array<{ label: string; value: string; bold?: boolean; large?: boolean }> = [
    { label: 'Subtotal', value: `$${invoice.subtotal.toFixed(2)}` },
  ];

  if (invoice.feesTotal > 0) {
    totalsData.push({ label: 'Fees', value: `$${invoice.feesTotal.toFixed(2)}` });
  }

  if (invoice.discounts > 0) {
    totalsData.push({ label: 'Discount', value: `-$${invoice.discounts.toFixed(2)}` });
  }

  if (invoice.tax > 0) {
    totalsData.push({ label: 'Tax', value: `$${invoice.tax.toFixed(2)}` });
  }

  totalsData.push({ label: 'Total', value: `$${invoice.total.toFixed(2)}`, bold: true, large: true });

  if (invoice.amountPaid > 0) {
    totalsData.push({ label: 'Payments Applied', value: `-$${invoice.amountPaid.toFixed(2)}` });
  }

  if (invoice.amountOutstanding > 0) {
    totalsData.push({
      label: 'Balance Due',
      value: `$${invoice.amountOutstanding.toFixed(2)}`,
      bold: true,
      large: true
    });
  }

  let totalsY = finalY;

  totalsData.forEach((item, index) => {
    const fontSize = item.large ? 11 : 9;
    const fontStyle = item.bold ? 'bold' : 'normal';

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(item.bold ? 17 : 75, item.bold ? 24 : 85, item.bold ? 39 : 99);

    doc.text(item.label, labelX, totalsY);
    const valueWidth = doc.getTextWidth(item.value);
    doc.text(item.value, pageWidth - margin - valueWidth, totalsY);

    // Add subtle line above Total and Balance Due
    if (item.bold && index > 0) {
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(labelX, totalsY - 3, pageWidth - margin, totalsY - 3);
    }

    totalsY += item.large ? 8 : 6;
  });

  // ========================================
  // PAYMENT HISTORY SECTION
  // ========================================

  const allPayments = [
    ...invoice.stripePayments.map(p => ({
      date: p.createdAt,
      method: 'Stripe',
      amount: p.refundAmount > 0 ? -p.refundAmount : p.amount,
      transactionId: p.stripePaymentIntentId?.substring(0, 20) || p.id.substring(0, 20),
      status: p.status,
    })),
    ...invoice.manualPayments.map(p => ({
      date: p.paymentDate,
      method: p.paymentType === 'cash' ? 'Cash' : p.paymentType === 'check' ? `Check ${p.checkNumber || ''}` : 'Manual',
      amount: p.amount,
      transactionId: p.notes || '-',
      status: 'completed',
    })),
    ...invoice.printavoPayments.map(p => ({
      date: p.paymentDate,
      method: p.paymentMethod || 'Payment',
      amount: p.amount,
      transactionId: p.notes || '-',
      status: 'completed',
    })),
  ];

  if (allPayments.length > 0) {
    const paymentStartY = Math.max(totalsY + 10, finalY + 60);

    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Summary', margin, paymentStartY);

    const paymentRows = allPayments.map(p => [
      formatDate(p.date),
      p.method,
      `$${Math.abs(p.amount).toFixed(2)}`,
      p.transactionId.substring(0, 25),
      capitalizeStatus(p.status),
    ]);

    autoTable(doc, {
      startY: paymentStartY + 5,
      head: [['Date', 'Method', 'Amount', 'Transaction ID', 'Status']],
      body: paymentRows,
      theme: 'plain',
      headStyles: {
        fillColor: [249, 250, 251],
        textColor: [75, 85, 99],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      },
      styles: {
        fontSize: 8,
        textColor: [31, 41, 55],
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 50 },
        4: { cellWidth: 25 },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    });

    finalY = (doc as any).lastAutoTable?.finalY || paymentStartY + 30;
  }

  // ========================================
  // NOTES SECTION
  // ========================================

  if (invoice.notes) {
    finalY += 15;

    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', margin, finalY);
    finalY += 6;

    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, finalY);
    finalY += notesLines.length * 4.5 + 5;
  }

  // ========================================
  // TERMS SECTION
  // ========================================

  if (options.invoiceTerms) {
    finalY += 10;

    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms', margin, finalY);
    finalY += 6;

    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'normal');
    const termsLines = doc.splitTextToSize(options.invoiceTerms, pageWidth - margin * 2);
    doc.text(termsLines, margin, finalY);
  }

  // ========================================
  // FOOTER
  // ========================================

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');

  const footerY = pageHeight - 15;
  const thankYouText = 'Thank you for your business.';
  const thankYouWidth = doc.getTextWidth(thankYouText);
  doc.text(thankYouText, (pageWidth - thankYouWidth) / 2, footerY);

  if (options.companyWebsite) {
    doc.setFontSize(8);
    const websiteWidth = doc.getTextWidth(options.companyWebsite);
    doc.text(options.companyWebsite, (pageWidth - websiteWidth) / 2, footerY + 5);
  }

  // ========================================
  // SAVE PDF
  // ========================================

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

function capitalizeStatus(status: string): string {
  if (!status) return '-';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}
