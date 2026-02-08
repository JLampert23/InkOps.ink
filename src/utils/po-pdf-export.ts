import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface POLineItem {
  style_number: string;
  product_name: string;
  color: string;
  size: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  extended_cost: number;
}

interface POVendor {
  vendor_name: string;
  vendor_type: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
}

interface POData {
  po_number: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  total_cost: number;
  notes_to_vendor: string | null;
  internal_notes: string | null;
  expected_delivery_date: string | null;
  sent_at: string | null;
  created_at: string;
  vendor: POVendor;
}

interface POPDFOptions {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

const SIZE_ORDER = ['XS', '2XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', '6XL', 'YXS', 'YS', 'YM', 'YL', 'YXL'];

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    confirmed: 'Confirmed',
    in_transit: 'In Transit',
    partially_received: 'Partially Received',
    fully_received: 'Fully Received',
    closed: 'Closed',
  };
  return map[status] || status;
}

export function generatePurchaseOrderPDF(
  po: POData,
  lineItems: POLineItem[],
  options: POPDFOptions = {}
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  doc.setFontSize(22);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', margin, y);

  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235);
  const poNumWidth = doc.getTextWidth(po.po_number);
  doc.text(po.po_number, pageWidth - margin - poNumWidth, y);
  y += 4;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');

  if (options.companyName) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.text(options.companyName, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
  }
  if (options.companyAddress) {
    options.companyAddress.split('\n').forEach((line) => {
      doc.text(line, margin, y);
      y += 4;
    });
  }
  if (options.companyPhone) {
    doc.text(options.companyPhone, margin, y);
    y += 4;
  }
  if (options.companyEmail) {
    doc.text(options.companyEmail, margin, y);
    y += 4;
  }

  const rightCol = pageWidth / 2 + 10;
  let yRight = y - (options.companyName ? 17 : 8);

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(rightCol - 4, yRight - 4, pageWidth - margin - rightCol + 4, 36, 2, 2, 'F');

  const drawField = (label: string, value: string, xPos: number, yPos: number) => {
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(label, xPos, yPos);
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(value, xPos, yPos + 4.5);
  };

  drawField('Date', format(new Date(po.created_at), 'MMM dd, yyyy'), rightCol, yRight);
  drawField('Status', statusLabel(po.status), rightCol + 50, yRight);
  yRight += 14;
  if (po.expected_delivery_date) {
    drawField('Expected Delivery', format(new Date(po.expected_delivery_date), 'MMM dd, yyyy'), rightCol, yRight);
  }
  if (po.sent_at) {
    drawField('Sent', format(new Date(po.sent_at), 'MMM dd, yyyy'), rightCol + 50, yRight);
  }

  y = Math.max(y, yRight + 14) + 6;

  doc.setFillColor(37, 99, 235);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 8, 1.5, 1.5, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('VENDOR', margin + 4, y + 5.5);
  y += 12;

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(11);
  doc.text(po.vendor.vendor_name, margin + 4, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  if (po.vendor.contact_name) {
    doc.text(po.vendor.contact_name, margin + 4, y);
    y += 4;
  }
  if (po.vendor.contact_email) {
    doc.text(po.vendor.contact_email, margin + 4, y);
    y += 4;
  }
  if (po.vendor.contact_phone) {
    doc.text(po.vendor.contact_phone, margin + 4, y);
    y += 4;
  }
  y += 6;

  const grouped = lineItems.reduce((acc, item) => {
    const key = `${item.style_number || item.product_name}|||${item.color}`;
    if (!acc[key]) {
      acc[key] = {
        style_number: item.style_number,
        product_name: item.product_name,
        color: item.color,
        unit_cost: item.unit_cost,
        sizes: [],
      };
    }
    acc[key].sizes.push({
      size: item.size || 'N/A',
      qty: item.quantity_ordered,
      received: item.quantity_received,
      cost: item.extended_cost,
    });
    return acc;
  }, {} as Record<string, { style_number: string; product_name: string; color: string; unit_cost: number; sizes: Array<{ size: string; qty: number; received: number; cost: number }> }>);

  const tableBody = Object.values(grouped).map((g) => {
    const sorted = [...g.sizes].sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a.size);
      const bi = SIZE_ORDER.indexOf(b.size);
      if (ai === -1 && bi === -1) return a.size.localeCompare(b.size);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    const sizeStr = sorted.map((s) => `${s.size}: ${s.qty}`).join('  ');
    const totalQty = sorted.reduce((s, x) => s + x.qty, 0);
    const totalCost = sorted.reduce((s, x) => s + x.cost, 0);
    return [
      g.style_number || '-',
      g.product_name,
      g.color || '-',
      sizeStr,
      totalQty.toString(),
      `$${g.unit_cost.toFixed(2)}`,
      `$${totalCost.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Style', 'Description', 'Color', 'Size Breakdown', 'Qty', 'Unit Cost', 'Total']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [237, 237, 237],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 40 },
      2: { cellWidth: 22 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 14, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  const costX = pageWidth - margin - 70;
  const costValX = pageWidth - margin;

  const drawCostLine = (label: string, value: string, bold = false) => {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    if (bold) doc.setTextColor(17, 24, 39);
    doc.text(label, costX, y);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    if (bold) doc.setFontSize(11);
    const valWidth = doc.getTextWidth(value);
    doc.text(value, costValX - valWidth, y);
    y += bold ? 7 : 5;
  };

  drawCostLine('Subtotal', `$${po.subtotal.toFixed(2)}`);
  if (po.tax_amount > 0) drawCostLine('Tax', `$${po.tax_amount.toFixed(2)}`);
  if (po.shipping_cost > 0) drawCostLine('Shipping', `$${po.shipping_cost.toFixed(2)}`);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(costX, y - 2, costValX, y - 2);
  y += 2;

  drawCostLine('Total', `$${po.total_cost.toFixed(2)}`, true);

  if (po.notes_to_vendor) {
    y += 4;
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = margin;
    }
    doc.setFillColor(239, 246, 255);
    const noteLines = doc.splitTextToSize(po.notes_to_vendor, pageWidth - margin * 2 - 12);
    const noteH = noteLines.length * 4 + 12;
    doc.roundedRect(margin, y, pageWidth - margin * 2, noteH, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes to Vendor:', margin + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(noteLines, margin + 4, y + 10);
  }

  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated ${format(new Date(), 'MMM dd, yyyy h:mm a')}`,
    margin,
    footerY
  );
  const pageStr = `Page 1 of ${(doc as any).internal.getNumberOfPages()}`;
  const pageStrW = doc.getTextWidth(pageStr);
  doc.text(pageStr, pageWidth - margin - pageStrW, footerY);

  doc.save(`${po.po_number}.pdf`);
}
