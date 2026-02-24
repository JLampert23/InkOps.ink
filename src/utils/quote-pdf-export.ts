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
  payment_due_date?: string | null;
  invoice_date?: string | null;
  company_name: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  company_phone: string | null;
  company_website: string | null;
  company_email: string | null;
  company_logo_url: string | null;
  company_logo_secondary_url?: string | null;
  line_items: Array<{
    line_type: string;
    item_number?: string;
    description: string;
    unit_price: number;
    total_price: number;
    color?: string;
    notes?: string;
    quantity?: number;
    group_label?: string;
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
    garment_front_image_url?: string | null;
    garment_back_image_url?: string | null;
    garment_sleeve_image_url?: string | null;
    garment_image_url?: string | null;
  }>;
  imprints?: Array<{
    id?: string;
    type_of_work: string;
    location: string;
    num_colors?: number;
    description?: string;
    details?: string;
    artwork_description?: string;
    thread_ink_color?: string;
    artwork_url?: string;
    artwork_images?: string[];
    mockups?: any[];
    group_label?: string;
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

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function imageToBase64(url: string): Promise<string | null> {
  try {
    const img = await loadImage(url);
    if (!img) return null;

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function generateQuotePDF(quote: QuotePDFData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  const logoUrl = quote.company_logo_url || quote.company_logo_secondary_url;
  let logoBase64: string | null = null;
  if (logoUrl) {
    logoBase64 = await imageToBase64(logoUrl);
  }

  if (logoBase64) {
    try {
      const logoHeight = 18;
      const logoWidth = 50;
      doc.addImage(logoBase64, 'PNG', margin, yPosition, logoWidth, logoHeight);
    } catch (error) {
      console.warn('Failed to add logo to PDF');
    }
  }

  const companyInfoX = logoBase64 ? margin + 55 : margin;
  let companyY = yPosition;

  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  if (quote.company_name) {
    doc.text(quote.company_name, companyInfoX, companyY);
    companyY += 5;
  }

  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');

  if (quote.company_address) {
    doc.text(quote.company_address, companyInfoX, companyY);
    companyY += 4;
  }

  if (quote.company_city && quote.company_state && quote.company_zip) {
    doc.text(`${quote.company_city}, ${quote.company_state} ${quote.company_zip}`, companyInfoX, companyY);
    companyY += 4;
  }

  if (quote.company_phone) {
    doc.text(quote.company_phone, companyInfoX, companyY);
    companyY += 4;
  }

  if (quote.company_email) {
    doc.text(quote.company_email, companyInfoX, companyY);
    companyY += 4;
  }

  if (quote.company_website) {
    doc.text(quote.company_website, companyInfoX, companyY);
    companyY += 4;
  }

  const rightColX = pageWidth - margin - 50;
  let rightY = yPosition;

  doc.setFontSize(22);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  const quoteTitleWidth = doc.getTextWidth('QUOTE');
  doc.text('QUOTE', pageWidth - margin - quoteTitleWidth, rightY);
  rightY += 8;

  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');

  const quoteDetails: [string, string][] = [
    ['Quote #:', quote.quote_number],
  ];

  if (quote.nickname) {
    quoteDetails.push(['Job Name:', quote.nickname]);
  }

  quoteDetails.push(['Date:', formatDate(quote.created_date || quote.created_at)]);
  quoteDetails.push(['Valid Until:', formatDate(quote.valid_until)]);

  quoteDetails.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text(label, rightColX, rightY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, pageWidth - margin - valueWidth, rightY);
    rightY += 4.5;
  });

  yPosition = Math.max(companyY, rightY) + 8;

  doc.setDrawColor(209, 213, 219);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  const colWidth = (pageWidth - 2 * margin - 10) / 3;
  const billToX = margin;
  const shipToX = margin + colWidth + 5;
  const detailsX = margin + 2 * colWidth + 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('CUSTOMER BILLING', billToX, yPosition);
  doc.text('CUSTOMER SHIPPING', shipToX, yPosition);
  doc.text('QUOTE DETAILS', detailsX, yPosition);
  yPosition += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  let billY = yPosition;
  let shipY = yPosition;
  let detailY = yPosition;

  if (quote.bill_company) {
    doc.setFont('helvetica', 'bold');
    doc.text(quote.bill_company, billToX, billY);
    billY += 3.5;
    doc.setFont('helvetica', 'normal');
  }
  if (quote.bill_name) {
    doc.text(quote.bill_name, billToX, billY);
    billY += 3.5;
  }
  if (quote.bill_address_1) {
    doc.text(quote.bill_address_1, billToX, billY);
    billY += 3.5;
  }
  if (quote.bill_address_2) {
    doc.text(quote.bill_address_2, billToX, billY);
    billY += 3.5;
  }
  if (quote.bill_city && quote.bill_state && quote.bill_zip) {
    doc.text(`${quote.bill_city}, ${quote.bill_state} ${quote.bill_zip}`, billToX, billY);
    billY += 3.5;
  }
  if (quote.bill_email || quote.customer_email) {
    doc.setTextColor(37, 99, 235);
    doc.text(quote.bill_email || quote.customer_email, billToX, billY);
    doc.setTextColor(17, 24, 39);
    billY += 3.5;
  }
  if (quote.bill_phone || quote.customer_phone) {
    doc.text(quote.bill_phone || quote.customer_phone, billToX, billY);
    billY += 3.5;
  }
  if (!quote.bill_company && !quote.bill_name && !quote.bill_address_1) {
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'italic');
    doc.text('No billing address provided', billToX, billY);
    billY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
  }

  if (quote.ship_company) {
    doc.setFont('helvetica', 'bold');
    doc.text(quote.ship_company, shipToX, shipY);
    shipY += 3.5;
    doc.setFont('helvetica', 'normal');
  }
  if (quote.ship_name) {
    doc.text(quote.ship_name, shipToX, shipY);
    shipY += 3.5;
  }
  if (quote.ship_address_1) {
    doc.text(quote.ship_address_1, shipToX, shipY);
    shipY += 3.5;
  }
  if (quote.ship_address_2) {
    doc.text(quote.ship_address_2, shipToX, shipY);
    shipY += 3.5;
  }
  if (quote.ship_city && quote.ship_state && quote.ship_zip) {
    doc.text(`${quote.ship_city}, ${quote.ship_state} ${quote.ship_zip}`, shipToX, shipY);
    shipY += 3.5;
  }
  if (!quote.ship_company && !quote.ship_name && !quote.ship_address_1) {
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'italic');
    doc.text('No shipping address provided', shipToX, shipY);
    shipY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
  }

  if (quote.po_number) {
    doc.setTextColor(75, 85, 99);
    doc.text('PO #:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.po_number, detailsX + 20, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.5;
  }
  if (quote.delivery_method) {
    doc.setTextColor(75, 85, 99);
    doc.text('Delivery:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.delivery_method, detailsX + 20, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.5;
  }
  if (quote.customer_due_date) {
    doc.setTextColor(75, 85, 99);
    doc.text('Customer Due:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(quote.customer_due_date), detailsX + 25, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.5;
  }
  if (quote.invoice_date) {
    doc.setTextColor(75, 85, 99);
    doc.text('Invoice Date:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(quote.invoice_date), detailsX + 25, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.5;
  }
  if (quote.payment_due_date) {
    doc.setTextColor(75, 85, 99);
    doc.text('Payment Due:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(quote.payment_due_date), detailsX + 25, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.5;
  }
  if (quote.terms) {
    doc.setTextColor(75, 85, 99);
    doc.text('Terms:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.terms, detailsX + 20, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.5;
  }

  yPosition = Math.max(billY, shipY, detailY) + 6;

  const items = quote.line_items.filter(item => item.line_type === 'item' || !item.line_type);
  const fees = quote.line_items.filter(item => item.line_type === 'fee');

  const groupedItems = items.reduce((acc, item) => {
    const groupLabel = item.group_label || '';
    if (!acc[groupLabel]) {
      acc[groupLabel] = [];
    }
    acc[groupLabel].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const itemGroups = Object.entries(groupedItems);

  const sizeColumns = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

  for (let groupIdx = 0; groupIdx < itemGroups.length; groupIdx++) {
    const [groupLabel, groupItems] = itemGroups[groupIdx];

    if (groupIdx > 0) {
      yPosition += 3;
    }

    if (groupLabel) {
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, yPosition - 2, pageWidth - 2 * margin, 7, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text(groupLabel, margin + 2, yPosition + 3);
      yPosition += 8;
    }

    const tableHead = [['Style #', 'Color', 'Description', ...sizeColumns, 'Qty', 'Items', 'Unit', 'Total']];
    const tableBody: any[][] = [];

    for (const item of groupItems) {
      const sizeQty = (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
                     (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
                     (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
                     (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
                     (item.qty_4xl || 0);
      const totalItems = sizeQty + (item.quantity || 0);

      const row = [
        item.item_number || '-',
        item.color || '-',
        item.description + (item.notes ? `\n${item.notes}` : ''),
        item.qty_yxs || '',
        item.qty_ys || '',
        item.qty_ym || '',
        item.qty_yl || '',
        item.qty_yxl || '',
        item.qty_xs || '',
        item.qty_s || '',
        item.qty_m || '',
        item.qty_l || '',
        item.qty_xl || '',
        item.qty_2xl || '',
        item.qty_3xl || '',
        item.qty_4xl || '',
        item.quantity || '',
        totalItems.toString(),
        formatCurrency(item.unit_price),
        formatCurrency(item.total_price),
      ];

      tableBody.push(row);
    }

    autoTable(doc, {
      startY: yPosition,
      head: tableHead,
      body: tableBody,
      theme: 'plain',
      styles: {
        fontSize: 6,
        cellPadding: 1.5,
        textColor: [17, 24, 39],
        lineWidth: 0.1,
        lineColor: [229, 231, 235],
      },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontStyle: 'bold',
        lineWidth: 0.2,
        lineColor: [209, 213, 219],
      },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 14 },
        2: { cellWidth: 35 },
        3: { cellWidth: 7, halign: 'center' },
        4: { cellWidth: 7, halign: 'center' },
        5: { cellWidth: 7, halign: 'center' },
        6: { cellWidth: 7, halign: 'center' },
        7: { cellWidth: 7, halign: 'center' },
        8: { cellWidth: 7, halign: 'center' },
        9: { cellWidth: 7, halign: 'center' },
        10: { cellWidth: 7, halign: 'center' },
        11: { cellWidth: 7, halign: 'center' },
        12: { cellWidth: 7, halign: 'center' },
        13: { cellWidth: 7, halign: 'center' },
        14: { cellWidth: 7, halign: 'center' },
        15: { cellWidth: 7, halign: 'center' },
        16: { cellWidth: 8, halign: 'center' },
        17: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235] },
        18: { cellWidth: 14, halign: 'right' },
        19: { cellWidth: 14, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          doc.setFontSize(8);
          doc.setTextColor(156, 163, 175);
          doc.text(`Quote ${quote.quote_number} - Page ${data.pageNumber}`, margin, 10);
        }
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 2;

    const normalizeLabel = (label: string | null | undefined) => label || '';
    const normalizedGroupLabel = normalizeLabel(groupLabel);

    let groupImprints: typeof quote.imprints = [];
    if (quote.imprints && quote.imprints.length > 0) {
      if (itemGroups.length === 1 && !groupLabel) {
        groupImprints = quote.imprints;
      } else {
        groupImprints = quote.imprints.filter(imp => {
          const imprintLabel = normalizeLabel(imp.group_label);
          return imprintLabel === normalizedGroupLabel;
        });
      }
    }

    if (groupImprints && groupImprints.length > 0) {
      const imprintsPerRow = 2;
      const imprintWidth = (pageWidth - 2 * margin - 5) / imprintsPerRow;
      let imprintX = margin;
      let imprintY = yPosition + 2;
      let maxImprintHeight = 0;

      for (let i = 0; i < groupImprints.length; i++) {
        const imprint = groupImprints[i];

        if (imprintY + 30 > pageHeight - margin) {
          doc.addPage();
          imprintY = margin;
          imprintX = margin;
        }

        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(209, 213, 219);
        doc.roundedRect(imprintX, imprintY, imprintWidth - 3, 25, 1, 1, 'FD');

        let textY = imprintY + 4;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text(`${quote.quote_number}-${String(i + 1).padStart(2, '0')}`, imprintX + 2, textY);

        doc.setFillColor(219, 234, 254);
        doc.setDrawColor(147, 197, 253);
        const typeWidth = doc.getTextWidth(imprint.type_of_work) + 4;
        doc.roundedRect(imprintX + 20, textY - 3, typeWidth, 5, 1, 1, 'FD');
        doc.setFontSize(7);
        doc.setTextColor(30, 64, 175);
        doc.text(imprint.type_of_work, imprintX + 22, textY);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text(imprint.location, imprintX + 22 + typeWidth + 2, textY);

        textY += 5;

        if (imprint.details || imprint.description) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(75, 85, 99);
          const details = imprint.details || imprint.description || '';
          const lines = doc.splitTextToSize(details, imprintWidth - 8);
          doc.text(lines.slice(0, 2), imprintX + 2, textY);
          textY += Math.min(lines.length, 2) * 3;
        }

        if (imprint.thread_ink_color) {
          doc.setFontSize(6);
          doc.setTextColor(75, 85, 99);
          doc.text(`Colors: ${imprint.thread_ink_color}`, imprintX + 2, textY);
          textY += 3;
        }

        const artworkImages = imprint.artwork_images && Array.isArray(imprint.artwork_images)
          ? imprint.artwork_images
          : imprint.artwork_url
            ? [imprint.artwork_url]
            : [];

        const mockupImages = (imprint.mockups || [])
          .map((m: any) => typeof m === 'string' ? m : m?.url)
          .filter(Boolean);

        const allImages = [...artworkImages, ...mockupImages];

        if (allImages.length > 0) {
          const imgSize = 12;
          const imgStartX = imprintX + 2;
          let imgX = imgStartX;

          for (let j = 0; j < Math.min(allImages.length, 4); j++) {
            const imgUrl = allImages[j];
            try {
              const imgBase64 = await imageToBase64(imgUrl);
              if (imgBase64) {
                doc.addImage(imgBase64, 'PNG', imgX, textY, imgSize, imgSize);
                imgX += imgSize + 2;
              }
            } catch {
              doc.setDrawColor(209, 213, 219);
              doc.rect(imgX, textY, imgSize, imgSize);
              imgX += imgSize + 2;
            }
          }
          textY += imgSize + 2;
        }

        const currentHeight = textY - imprintY + 2;
        maxImprintHeight = Math.max(maxImprintHeight, currentHeight);

        if ((i + 1) % imprintsPerRow === 0) {
          imprintX = margin;
          imprintY += maxImprintHeight + 2;
          maxImprintHeight = 0;
        } else {
          imprintX += imprintWidth;
        }
      }

      if (groupImprints.length % imprintsPerRow !== 0) {
        yPosition = imprintY + maxImprintHeight + 2;
      } else {
        yPosition = imprintY;
      }
    }
  }

  if (fees.length > 0) {
    yPosition += 5;

    if (yPosition + 40 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Additional Fees', pageWidth / 2, yPosition);
    yPosition += 4;

    const feeData = fees.map(fee => {
      const feeName = fee.description.includes(' - ') ? fee.description.split(' - ')[0] : fee.description;
      const feeDescription = fee.description.includes(' - ') ? fee.description.split(' - ').slice(1).join(' - ') : '';
      return [
        feeName,
        feeDescription || '-',
        (fee.quantity || 1).toString(),
        formatCurrency(fee.unit_price),
        formatCurrency(fee.total_price),
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Fee', 'Description', 'Qty', 'Amount', 'Total']],
      body: feeData,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [17, 24, 39],
        lineWidth: 0.1,
        lineColor: [229, 231, 235],
      },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontStyle: 'bold',
        lineWidth: 0.2,
        lineColor: [209, 213, 219],
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: pageWidth / 2, right: margin },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;
  }

  if (yPosition + 60 > pageHeight - margin) {
    doc.addPage();
    yPosition = margin;
  }

  yPosition += 5;
  const totalsX = pageWidth - margin - 70;
  const totalsValueX = pageWidth - margin;

  const totalQty = items.reduce((sum, item) => {
    return sum + (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) + (item.qty_yl || 0) +
           (item.qty_yxl || 0) + (item.qty_xs || 0) + (item.qty_s || 0) + (item.qty_m || 0) +
           (item.qty_l || 0) + (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) + (item.qty_4xl || 0);
  }, 0);

  const feesTotal = fees.reduce((sum, fee) => sum + fee.total_price, 0);

  doc.setFontSize(9);

  const totalsData: [string, string][] = [
    ['Total Quantity', totalQty.toString()],
    ['Item Total', formatCurrency(quote.subtotal)],
    ['Fees Total', formatCurrency(feesTotal)],
    ['Sub Total', formatCurrency(quote.subtotal)],
  ];

  if (quote.discount_amount > 0) {
    totalsData.push(['Discount', `-${formatCurrency(quote.discount_amount)}`]);
  }

  totalsData.push(['Tax', formatCurrency(quote.tax_amount)]);

  totalsData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(label, totalsX, yPosition);

    doc.setFont('helvetica', 'normal');
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, totalsValueX - valueWidth, yPosition);
    yPosition += 4.5;
  });

  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(totalsX, yPosition, totalsValueX, yPosition);
  yPosition += 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Total Due', totalsX, yPosition);
  const totalDueValue = formatCurrency(quote.total);
  const totalDueWidth = doc.getTextWidth(totalDueValue);
  doc.text(totalDueValue, totalsValueX - totalDueWidth, yPosition);
  yPosition += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Paid', totalsX, yPosition);
  doc.setFont('helvetica', 'normal');
  const paidValue = formatCurrency(0);
  const paidWidth = doc.getTextWidth(paidValue);
  doc.text(paidValue, totalsValueX - paidWidth, yPosition);
  yPosition += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Outstanding', totalsX, yPosition);
  doc.setTextColor(37, 99, 235);
  const outstandingValue = formatCurrency(quote.total);
  const outstandingWidth = doc.getTextWidth(outstandingValue);
  doc.text(outstandingValue, totalsValueX - outstandingWidth, yPosition);
  yPosition += 8;

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Created: ${formatDate(quote.created_date || quote.created_at)}`, margin, yPosition);

  if (yPosition + 60 < pageHeight - margin) {
    yPosition += 10;

    doc.setDrawColor(209, 213, 219);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('TERMS & CONDITIONS', margin, yPosition);
    yPosition += 5;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);

    const policies = [
      'Payment Terms: Payment is due upon receipt unless otherwise agreed in writing.',
      'Artwork Proofs: Customer approval of artwork proofs is required before production begins.',
      'Ink/Thread Colors: Colors may vary slightly from screen displays and proofs.',
      'Custom Colors: Custom PMS color matching may incur additional charges.',
      'Customer-Supplied Goods: We are not responsible for defects in customer-supplied items.',
      'Pricing Disclaimer: Prices are subject to change based on final artwork and quantity.',
      `Quote Validity: This quote is valid until ${formatDate(quote.valid_until)}.`,
    ];

    policies.forEach(policy => {
      const lines = doc.splitTextToSize(policy, pageWidth - 2 * margin);
      doc.text(lines, margin, yPosition);
      yPosition += lines.length * 3 + 1;
    });
  }

  const fileName = `Quote_${quote.quote_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(fileName);
}
