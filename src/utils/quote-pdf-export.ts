import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface QuotePDFData {
  quote_number: string;
  nickname?: string;
  customer_name: string;
  customer_email: string;
  customer_company: string;
  customer_phone: string;
  bill_company?: string;
  bill_name?: string;
  bill_address_1?: string;
  bill_address_2?: string;
  bill_city?: string;
  bill_state?: string;
  bill_zip?: string;
  bill_phone?: string;
  bill_email?: string;
  ship_company?: string;
  ship_name?: string;
  ship_address_1?: string;
  ship_address_2?: string;
  ship_city?: string;
  ship_state?: string;
  ship_zip?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  discount_type?: string;
  total: number;
  status: string;
  valid_until: string | null;
  created_at: string;
  created_date?: string;
  customer_due_date?: string;
  production_due_date?: string;
  customer_notes: string | null;
  notes: string | null;
  production_notes?: string | null;
  delivery_method: string | null;
  po_number: string | null;
  terms: string | null;
  company_name: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  company_phone: string | null;
  company_website: string | null;
  company_email: string | null;
  company_logo_url: string | null;
  line_items: Array<{
    line_type: string;
    item_number?: string;
    description: string;
    unit_price: number;
    total_price: number;
    color?: string;
    notes?: string;
    qty_yxs: number | null;
    qty_ys: number | null;
    qty_ym: number | null;
    qty_yl: number | null;
    qty_yxl: number | null;
    qty_xs: number | null;
    qty_s: number | null;
    qty_m: number | null;
    qty_l: number | null;
    qty_xl: number | null;
    qty_2xl: number | null;
    qty_3xl: number | null;
    qty_4xl: number | null;
    qty_5xl: number | null;
    qty_6xl: number | null;
    qty_custom_1?: number | null;
    qty_custom_2?: number | null;
    qty_custom_3?: number | null;
    custom_size_1_name?: string | null;
    custom_size_2_name?: string | null;
    custom_size_3_name?: string | null;
  }>;
  imprints?: Array<{
    type_of_work: string;
    location: string;
    num_colors: number;
    description: string;
    artwork_description?: string;
  }>;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'N/A';
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function capitalizeStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function generateQuotePDF(quote: QuotePDFData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // HEADER: Company Info (Left) + Quote Details (Right)
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.text(quote.company_name || 'Company Name', margin, yPosition);
  yPosition += 7;

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');

  if (quote.company_address) {
    doc.text(quote.company_address, margin, yPosition);
    yPosition += 4.5;
  }

  if (quote.company_city && quote.company_state && quote.company_zip) {
    doc.text(`${quote.company_city}, ${quote.company_state} ${quote.company_zip}`, margin, yPosition);
    yPosition += 4.5;
  }

  if (quote.company_phone) {
    doc.text(quote.company_phone, margin, yPosition);
    yPosition += 4.5;
  }

  if (quote.company_email) {
    doc.text(quote.company_email, margin, yPosition);
    yPosition += 4.5;
  }

  // RIGHT SIDE: Quote Details
  const rightColX = pageWidth - margin - 60;
  let rightY = margin;

  doc.setFontSize(28);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  const quoteTitleWidth = doc.getTextWidth('QUOTE');
  doc.text('QUOTE', pageWidth - margin - quoteTitleWidth, rightY);
  rightY += 10;

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');

  const quoteDetails = [
    ['Quote Number:', quote.quote_number],
    ['Date:', formatDate(quote.created_date || quote.created_at)],
    ['Valid Until:', formatDate(quote.valid_until)],
    ['Status:', capitalizeStatus(quote.status)],
  ];

  if (quote.nickname) {
    quoteDetails.splice(1, 0, ['Nickname:', quote.nickname]);
  }

  quoteDetails.forEach(([label, value]) => {
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

  // BILL TO and SHIP TO sections
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  const billToX = margin;
  const shipToX = pageWidth / 2 + 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('BILL TO', billToX, yPosition);
  doc.text('SHIP TO', shipToX, yPosition);
  yPosition += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  let billY = yPosition;
  let shipY = yPosition;

  if (quote.bill_name || quote.customer_name) {
    doc.text(quote.bill_name || quote.customer_name, billToX, billY);
    billY += 4.5;
  }

  if (quote.bill_company || quote.customer_company) {
    doc.text(quote.bill_company || quote.customer_company, billToX, billY);
    billY += 4.5;
  }

  if (quote.bill_address_1) {
    doc.text(quote.bill_address_1, billToX, billY);
    billY += 4.5;
  }

  if (quote.bill_address_2) {
    doc.text(quote.bill_address_2, billToX, billY);
    billY += 4.5;
  }

  if (quote.bill_city && quote.bill_state && quote.bill_zip) {
    doc.text(`${quote.bill_city}, ${quote.bill_state} ${quote.bill_zip}`, billToX, billY);
    billY += 4.5;
  }

  if (quote.bill_phone || quote.customer_phone) {
    doc.text(quote.bill_phone || quote.customer_phone, billToX, billY);
    billY += 4.5;
  }

  if (quote.bill_email || quote.customer_email) {
    doc.text(quote.bill_email || quote.customer_email, billToX, billY);
    billY += 4.5;
  }

  if (quote.ship_name) {
    doc.text(quote.ship_name, shipToX, shipY);
    shipY += 4.5;
  }

  if (quote.ship_company) {
    doc.text(quote.ship_company, shipToX, shipY);
    shipY += 4.5;
  }

  if (quote.ship_address_1) {
    doc.text(quote.ship_address_1, shipToX, shipY);
    shipY += 4.5;
  }

  if (quote.ship_address_2) {
    doc.text(quote.ship_address_2, shipToX, shipY);
    shipY += 4.5;
  }

  if (quote.ship_city && quote.ship_state && quote.ship_zip) {
    doc.text(`${quote.ship_city}, ${quote.ship_state} ${quote.ship_zip}`, shipToX, shipY);
    shipY += 4.5;
  }

  yPosition = Math.max(billY, shipY) + 8;

  // LINE ITEMS TABLE
  const tableData = quote.line_items.map((item) => {
    const sizes: string[] = [];
    const sizeFields = [
      { qty: item.qty_yxs, label: 'YXS' },
      { qty: item.qty_ys, label: 'YS' },
      { qty: item.qty_ym, label: 'YM' },
      { qty: item.qty_yl, label: 'YL' },
      { qty: item.qty_yxl, label: 'YXL' },
      { qty: item.qty_xs, label: 'XS' },
      { qty: item.qty_s, label: 'S' },
      { qty: item.qty_m, label: 'M' },
      { qty: item.qty_l, label: 'L' },
      { qty: item.qty_xl, label: 'XL' },
      { qty: item.qty_2xl, label: '2XL' },
      { qty: item.qty_3xl, label: '3XL' },
      { qty: item.qty_4xl, label: '4XL' },
      { qty: item.qty_5xl, label: '5XL' },
      { qty: item.qty_6xl, label: '6XL' },
    ];

    sizeFields.forEach(({ qty, label }) => {
      if (qty && qty > 0) sizes.push(`${label}: ${qty}`);
    });

    if (item.qty_custom_1 && item.custom_size_1_name) {
      sizes.push(`${item.custom_size_1_name}: ${item.qty_custom_1}`);
    }
    if (item.qty_custom_2 && item.custom_size_2_name) {
      sizes.push(`${item.custom_size_2_name}: ${item.qty_custom_2}`);
    }
    if (item.qty_custom_3 && item.custom_size_3_name) {
      sizes.push(`${item.custom_size_3_name}: ${item.qty_custom_3}`);
    }

    let description = item.description;
    if (item.item_number) description = `${item.item_number} - ${description}`;
    if (item.color) description += ` (${item.color})`;
    if (sizes.length > 0) description += `\nSizes: ${sizes.join(', ')}`;
    if (item.notes) description += `\nNotes: ${item.notes}`;

    return [
      description,
      formatCurrency(item.unit_price),
      formatCurrency(item.total_price),
    ];
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Description', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [17, 24, 39],
    },
    headStyles: {
      fillColor: [249, 250, 251],
      textColor: [107, 114, 128],
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [229, 231, 235],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // IMPRINTS SECTION
  if (quote.imprints && quote.imprints.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Decoration Details', margin, yPosition);
    yPosition += 6;

    const imprintData = quote.imprints.map((imprint) => [
      imprint.location,
      imprint.type_of_work,
      `${imprint.num_colors} color(s)`,
      imprint.description,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Location', 'Type', 'Colors', 'Description']],
      body: imprintData,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [17, 24, 39],
      },
      headStyles: {
        fillColor: [249, 250, 251],
        textColor: [107, 114, 128],
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: [229, 231, 235],
      },
      margin: { left: margin, right: margin },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // TOTALS SECTION
  const totalsX = pageWidth - margin - 60;
  yPosition += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);

  const totals = [
    ['Subtotal:', formatCurrency(quote.subtotal)],
  ];

  if (quote.discount_amount > 0) {
    const discountLabel = quote.discount_type === 'percentage'
      ? `Discount (${quote.discount_amount}%):`
      : 'Discount:';
    totals.push([discountLabel, `-${formatCurrency(quote.discount_amount)}`]);
  }

  if (quote.tax_amount > 0) {
    totals.push([`Tax (${quote.tax_rate}%):`, formatCurrency(quote.tax_amount)]);
  }

  totals.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(label, totalsX, yPosition);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, pageWidth - margin - valueWidth, yPosition);
    yPosition += 5;
  });

  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(totalsX, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Total:', totalsX, yPosition);

  const totalValue = formatCurrency(quote.total);
  const totalValueWidth = doc.getTextWidth(totalValue);
  doc.text(totalValue, pageWidth - margin - totalValueWidth, yPosition);

  yPosition += 10;

  // NOTES SECTION
  if (quote.notes || quote.customer_notes || quote.production_notes) {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Notes', margin, yPosition);
    yPosition += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);

    if (quote.customer_notes) {
      doc.text('Customer Notes:', margin, yPosition);
      yPosition += 4.5;
      const lines = doc.splitTextToSize(quote.customer_notes, pageWidth - 2 * margin);
      doc.text(lines, margin + 5, yPosition);
      yPosition += lines.length * 4.5 + 3;
    }

    if (quote.notes) {
      doc.text('Internal Notes:', margin, yPosition);
      yPosition += 4.5;
      const lines = doc.splitTextToSize(quote.notes, pageWidth - 2 * margin);
      doc.text(lines, margin + 5, yPosition);
      yPosition += lines.length * 4.5 + 3;
    }

    if (quote.production_notes) {
      doc.text('Production Notes:', margin, yPosition);
      yPosition += 4.5;
      const lines = doc.splitTextToSize(quote.production_notes, pageWidth - 2 * margin);
      doc.text(lines, margin + 5, yPosition);
      yPosition += lines.length * 4.5 + 3;
    }
  }

  // TERMS
  if (quote.terms) {
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
    }

    yPosition += 5;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Terms & Conditions', margin, yPosition);
    yPosition += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    const termLines = doc.splitTextToSize(quote.terms, pageWidth - 2 * margin);
    doc.text(termLines, margin, yPosition);
  }

  const fileName = `Quote_${quote.quote_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(fileName);
}
