import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InvoiceDetail, InvoiceFee } from '../services/invoice-detail-service';

export interface InvoicePDFOptions {
  companyName?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  invoiceTerms?: string;
}

interface ImageDimensions {
  base64: string;
  width: number;
  height: number;
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function capitalizeStatus(status: string): string {
  if (!status) return '-';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => {
      console.warn('Failed to load image:', url, e);
      resolve(null);
    };
    const timestamp = Date.now();
    img.src = url.includes('?') ? `${url}&_t=${timestamp}` : `${url}?_t=${timestamp}`;
  });
}

async function imageToBase64WithDimensions(url: string): Promise<ImageDimensions | null> {
  try {
    const img = await loadImage(url);
    if (!img) return null;

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    return {
      base64: canvas.toDataURL('image/png'),
      width: img.width,
      height: img.height,
    };
  } catch {
    return null;
  }
}

export async function generateInvoicePDF(
  invoice: InvoiceDetail,
  options: InvoicePDFOptions = {}
): Promise<void> {
  console.log('generateInvoicePDF called with company data:', {
    company_name: options.companyName,
    company_logo_url: options.companyLogoUrl,
    company_address: options.companyAddress,
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 16;
  const marginRight = 16;
  const marginTop = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let yPosition = marginTop;

  let logoData: ImageDimensions | null = null;
  if (options.companyLogoUrl) {
    console.log('Attempting to load logo from:', options.companyLogoUrl);
    logoData = await imageToBase64WithDimensions(options.companyLogoUrl);
    console.log('Logo data loaded:', logoData ? 'success' : 'failed');
  }

  const maxLogoHeight = 28;
  const maxLogoWidth = 60;
  let actualLogoWidth = 0;
  let actualLogoHeight = 0;

  if (logoData) {
    const aspectRatio = logoData.width / logoData.height;

    if (logoData.height > logoData.width) {
      actualLogoHeight = Math.min(maxLogoHeight, logoData.height * 0.264583);
      actualLogoWidth = actualLogoHeight * aspectRatio;
    } else {
      actualLogoWidth = Math.min(maxLogoWidth, logoData.width * 0.264583);
      actualLogoHeight = actualLogoWidth / aspectRatio;
    }

    if (actualLogoHeight > maxLogoHeight) {
      actualLogoHeight = maxLogoHeight;
      actualLogoWidth = actualLogoHeight * aspectRatio;
    }
    if (actualLogoWidth > maxLogoWidth) {
      actualLogoWidth = maxLogoWidth;
      actualLogoHeight = actualLogoWidth / aspectRatio;
    }

    try {
      doc.addImage(logoData.base64, 'PNG', marginLeft, yPosition, actualLogoWidth, actualLogoHeight);
    } catch (error) {
      console.warn('Failed to add logo to PDF');
      actualLogoWidth = 0;
      actualLogoHeight = 0;
    }
  }

  let companyY = yPosition + actualLogoHeight + 3;

  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  if (options.companyName) {
    doc.text(options.companyName, marginLeft, companyY);
    companyY += 4;
  }

  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');

  if (options.companyAddress) {
    const addressLines = options.companyAddress.split('\n');
    for (const line of addressLines) {
      doc.text(line, marginLeft, companyY);
      companyY += 3.5;
    }
  }

  if (options.companyCity || options.companyState || options.companyZip) {
    const cityStateZip = [options.companyCity, options.companyState].filter(Boolean).join(', ') + (options.companyZip ? ' ' + options.companyZip : '');
    if (cityStateZip.trim()) {
      doc.text(cityStateZip, marginLeft, companyY);
      companyY += 3.5;
    }
  }

  if (options.companyPhone) {
    doc.text(options.companyPhone, marginLeft, companyY);
    companyY += 3.5;
  }

  if (options.companyEmail) {
    doc.text(options.companyEmail, marginLeft, companyY);
    companyY += 3.5;
  }

  if (options.companyWebsite) {
    doc.text(options.companyWebsite, marginLeft, companyY);
    companyY += 3.5;
  }

  const rightEdge = marginLeft + contentWidth;
  let rightY = yPosition;

  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  const invoiceTitleWidth = doc.getTextWidth('INVOICE');
  doc.text('INVOICE', rightEdge - invoiceTitleWidth, rightY + 2);
  rightY += 8;

  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');

  const metaX = rightEdge - 55;

  const invoiceDetails: [string, string][] = [
    ['Invoice #:', `#${invoice.visualId}`],
    ['Invoice Date:', formatDate(invoice.invoiceDate)],
    ['Due Date:', formatDate(invoice.dueDate)],
    ['Status:', capitalizeStatus(invoice.status)],
  ];

  invoiceDetails.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text(label, metaX, rightY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, rightEdge - valueWidth, rightY);
    rightY += 4;
  });

  const headerHeight = Math.max(companyY - yPosition, rightY - yPosition, actualLogoHeight);
  yPosition += headerHeight + 6;

  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, rightEdge, yPosition);
  yPosition += 6;

  const colWidth = (contentWidth - 4) / 2;
  const billToX = marginLeft;
  const detailsX = marginLeft + colWidth + 4;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('BILL TO', billToX, yPosition);
  doc.text('INVOICE DETAILS', detailsX, yPosition);
  yPosition += 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  let billY = yPosition;
  let detailY = yPosition;

  if (invoice.contact.name) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(invoice.contact.name, billToX, billY);
    billY += 3.2;
    doc.setFont('helvetica', 'normal');
  }

  if (invoice.contact.company) {
    doc.setTextColor(55, 65, 81);
    doc.text(invoice.contact.company, billToX, billY);
    billY += 3.2;
  }

  if (invoice.billingAddress?.line1) {
    doc.setTextColor(55, 65, 81);
    doc.text(invoice.billingAddress.line1, billToX, billY);
    billY += 3.2;
  }

  if (invoice.billingAddress?.line2) {
    doc.setTextColor(55, 65, 81);
    doc.text(invoice.billingAddress.line2, billToX, billY);
    billY += 3.2;
  }

  if (invoice.billingAddress?.city || invoice.billingAddress?.state || invoice.billingAddress?.zip) {
    const cityStateZip = [invoice.billingAddress.city, invoice.billingAddress.state].filter(Boolean).join(', ') + (invoice.billingAddress.zip ? ' ' + invoice.billingAddress.zip : '');
    doc.setTextColor(55, 65, 81);
    doc.text(cityStateZip, billToX, billY);
    billY += 3.2;
  }

  if (invoice.contact.email) {
    doc.setTextColor(55, 65, 81);
    doc.text(invoice.contact.email, billToX, billY);
    billY += 3.2;
  }

  if (invoice.contact.phone) {
    doc.setTextColor(55, 65, 81);
    doc.text(invoice.contact.phone, billToX, billY);
    billY += 3.2;
  }

  const detailItems: [string, string][] = [
    ['Terms:', invoice.terms || 'Due on Receipt'],
  ];

  if (invoice.poNumber) {
    detailItems.push(['PO Number:', invoice.poNumber]);
  }

  detailItems.forEach(([label, value]) => {
    doc.setTextColor(75, 85, 99);
    doc.setFont('helvetica', 'normal');
    doc.text(label, detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(value, detailsX + 22, detailY);
    detailY += 3.5;
  });

  yPosition = Math.max(billY, detailY) + 8;

  const lineItemsData = invoice.lineItems.map((item) => [
    item.description || 'Item',
    item.quantity.toString(),
    formatCurrency(item.unitPrice),
    formatCurrency(item.totalPrice),
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Description', 'Qty', 'Unit Price', 'Line Total']],
    body: lineItemsData,
    theme: 'plain',
    margin: { left: marginLeft, right: marginRight },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [55, 65, 81],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
    },
    styles: {
      fontSize: 8,
      textColor: [31, 41, 55],
      cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  });

  let finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;

  if (invoice.fees && invoice.fees.length > 0) {
    finalY += 6;

    const feesData = invoice.fees.map((fee: InvoiceFee) => [
      fee.name,
      formatCurrency(fee.amount),
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [['Additional Charges', 'Amount']],
      body: feesData,
      theme: 'plain',
      margin: { left: marginLeft, right: marginRight },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [55, 65, 81],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      },
      styles: {
        fontSize: 8,
        textColor: [31, 41, 55],
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
    });

    finalY = (doc as any).lastAutoTable?.finalY || finalY + 20;
  }

  finalY += 10;

  const totalsWidth = 70;
  const totalsX = rightEdge - totalsWidth;
  let totalsY = finalY;

  doc.setFontSize(8);

  const drawTotalsRow = (label: string, value: string, isBold: boolean = false, isLarge: boolean = false) => {
    const fontSize = isLarge ? 10 : 8;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(isBold ? 17 : 75, isBold ? 24 : 85, isBold ? 39 : 99);

    doc.text(label, totalsX, totalsY);
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, rightEdge - valueWidth, totalsY);
    totalsY += isLarge ? 6 : 4.5;
  };

  drawTotalsRow('Subtotal', formatCurrency(invoice.subtotal));

  if (invoice.feesTotal > 0) {
    drawTotalsRow('Fees', formatCurrency(invoice.feesTotal));
  }

  if (invoice.discounts > 0) {
    drawTotalsRow('Discount', `-${formatCurrency(invoice.discounts)}`);
  }

  if (invoice.tax > 0) {
    drawTotalsRow('Tax', formatCurrency(invoice.tax));
  }

  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.line(totalsX, totalsY, rightEdge, totalsY);
  totalsY += 3;

  drawTotalsRow('Total', formatCurrency(invoice.total), true, true);

  if (invoice.amountPaid > 0) {
    drawTotalsRow('Payments Applied', `-${formatCurrency(invoice.amountPaid)}`);
  }

  if (invoice.amountOutstanding > 0) {
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.3);
    doc.line(totalsX, totalsY, rightEdge, totalsY);
    totalsY += 3;

    doc.setFillColor(243, 244, 246);
    doc.rect(totalsX - 2, totalsY - 3, totalsWidth + 4, 8, 'F');
    drawTotalsRow('Balance Due', formatCurrency(invoice.amountOutstanding), true, true);
  }

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
    const paymentStartY = Math.max(totalsY + 12, finalY + 50);

    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT SUMMARY', marginLeft, paymentStartY);

    const paymentRows = allPayments.map(p => [
      formatDate(p.date),
      p.method,
      p.amount < 0 ? `-${formatCurrency(Math.abs(p.amount))}` : formatCurrency(p.amount),
      p.transactionId.substring(0, 25),
      capitalizeStatus(p.status),
    ]);

    autoTable(doc, {
      startY: paymentStartY + 4,
      head: [['Date', 'Method', 'Amount', 'Transaction ID', 'Status']],
      body: paymentRows,
      theme: 'plain',
      margin: { left: marginLeft, right: marginRight },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [55, 65, 81],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      },
      styles: {
        fontSize: 7,
        textColor: [31, 41, 55],
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 28 },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 22 },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    });

    finalY = (doc as any).lastAutoTable?.finalY || paymentStartY + 30;
  } else {
    finalY = totalsY;
  }

  if (invoice.notes) {
    finalY += 12;

    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES', marginLeft, finalY);
    finalY += 4;

    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(invoice.notes, contentWidth);
    doc.text(notesLines, marginLeft, finalY);
    finalY += notesLines.length * 3.5 + 4;
  }

  if (options.invoiceTerms) {
    finalY += 8;

    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMS & CONDITIONS', marginLeft, finalY);
    finalY += 4;

    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'normal');
    const termsLines = doc.splitTextToSize(options.invoiceTerms, contentWidth);
    doc.text(termsLines, marginLeft, finalY);
  }

  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');

  const footerY = pageHeight - 12;
  const thankYouText = 'Thank you for your business.';
  const thankYouWidth = doc.getTextWidth(thankYouText);
  doc.text(thankYouText, (pageWidth - thankYouWidth) / 2, footerY);

  if (options.companyWebsite) {
    doc.setFontSize(7);
    const websiteWidth = doc.getTextWidth(options.companyWebsite);
    doc.text(options.companyWebsite, (pageWidth - websiteWidth) / 2, footerY + 4);
  }

  doc.save(`Invoice-${invoice.visualId}.pdf`);
}
