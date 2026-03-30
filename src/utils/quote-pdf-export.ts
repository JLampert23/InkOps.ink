import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { renderHtmlToPdf, htmlToPlainText } from './html-to-pdf';

export interface QuotePDFData {
  quote_number: string;
  nickname?: string;
  customer_name: string;
  customer_email: string;
  customer_company: string;
  customer_phone: string;
  bill_company?: string;
  bill_name?: string;
  bill_first_name?: string;
  bill_last_name?: string;
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
  quote_terms?: string | null;
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

interface ImageDimensions {
  base64: string;
  width: number;
  height: number;
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

async function imageToBase64(url: string): Promise<string | null> {
  const result = await imageToBase64WithDimensions(url);
  return result ? result.base64 : null;
}

export async function generateQuotePDF(quote: QuotePDFData): Promise<void> {
  console.log('generateQuotePDF called with company data:', {
    company_name: quote.company_name,
    company_logo_url: quote.company_logo_url,
    company_logo_secondary_url: quote.company_logo_secondary_url,
    company_address: quote.company_address,
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
  const marginBottom = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let yPosition = marginTop;

  const logoUrl = quote.company_logo_url || quote.company_logo_secondary_url;
  console.log('Logo URL to load:', logoUrl);
  let logoData: ImageDimensions | null = null;
  if (logoUrl) {
    logoData = await imageToBase64WithDimensions(logoUrl);
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
  if (quote.company_name) {
    doc.text(quote.company_name, marginLeft, companyY);
    companyY += 4;
  }

  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');

  if (quote.company_address) {
    const addressLines = quote.company_address.split('\n');
    for (const line of addressLines) {
      doc.text(line, marginLeft, companyY);
      companyY += 3.5;
    }
  }

  if (quote.company_city || quote.company_state || quote.company_zip) {
    const cityStateZip = [quote.company_city, quote.company_state].filter(Boolean).join(', ') + (quote.company_zip ? ' ' + quote.company_zip : '');
    if (cityStateZip.trim()) {
      doc.text(cityStateZip, marginLeft, companyY);
      companyY += 3.5;
    }
  }

  if (quote.company_phone) {
    doc.text(quote.company_phone, marginLeft, companyY);
    companyY += 3.5;
  }

  if (quote.company_email) {
    doc.text(quote.company_email, marginLeft, companyY);
    companyY += 3.5;
  }

  if (quote.company_website) {
    doc.text(quote.company_website, marginLeft, companyY);
    companyY += 3.5;
  }

  const rightEdge = marginLeft + contentWidth;
  let rightY = yPosition;

  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  const quoteTitleWidth = doc.getTextWidth('QUOTE');
  doc.text('QUOTE', rightEdge - quoteTitleWidth, rightY + 2);
  rightY += 8;

  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');

  const quoteMetaX = rightEdge - 55;

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
    doc.text(label, quoteMetaX, rightY);

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

  const colWidth = (contentWidth - 8) / 3;
  const billToX = marginLeft;
  const shipToX = marginLeft + colWidth + 4;
  const detailsX = marginLeft + 2 * colWidth + 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('CUSTOMER BILLING', billToX, yPosition);
  doc.text('CUSTOMER SHIPPING', shipToX, yPosition);
  doc.text('QUOTE DETAILS', detailsX, yPosition);
  yPosition += 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  let billY = yPosition;
  let shipY = yPosition;
  let detailY = yPosition;

  if (quote.bill_company) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(quote.bill_company, billToX, billY);
    billY += 3.2;
    doc.setFont('helvetica', 'normal');
  }
  if (quote.bill_first_name || quote.bill_last_name) {
    doc.setTextColor(55, 65, 81);
    doc.text(`${quote.bill_first_name || ''} ${quote.bill_last_name || ''}`.trim(), billToX, billY);
    billY += 3.2;
  } else if (quote.bill_name) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.bill_name, billToX, billY);
    billY += 3.2;
  }
  if (quote.bill_address_1) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.bill_address_1, billToX, billY);
    billY += 3.2;
  }
  if (quote.bill_address_2) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.bill_address_2, billToX, billY);
    billY += 3.2;
  }
  if (quote.bill_city && quote.bill_state && quote.bill_zip) {
    doc.setTextColor(55, 65, 81);
    doc.text(`${quote.bill_city}, ${quote.bill_state} ${quote.bill_zip}`, billToX, billY);
    billY += 3.2;
  }
  if (quote.bill_email || quote.customer_email) {
    doc.setTextColor(37, 99, 235);
    doc.text(quote.bill_email || quote.customer_email, billToX, billY);
    billY += 3.2;
  }
  if (quote.bill_phone || quote.customer_phone) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.bill_phone || quote.customer_phone, billToX, billY);
    billY += 3.2;
  }
  if (!quote.bill_company && !quote.bill_name && !quote.bill_first_name && !quote.bill_last_name && !quote.bill_address_1) {
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'italic');
    doc.text('No billing address provided', billToX, billY);
    billY += 3.2;
    doc.setFont('helvetica', 'normal');
  }

  if (quote.ship_company) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(quote.ship_company, shipToX, shipY);
    shipY += 3.2;
    doc.setFont('helvetica', 'normal');
  }
  if (quote.ship_name) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.ship_name, shipToX, shipY);
    shipY += 3.2;
  }
  if (quote.ship_address_1) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.ship_address_1, shipToX, shipY);
    shipY += 3.2;
  }
  if (quote.ship_address_2) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.ship_address_2, shipToX, shipY);
    shipY += 3.2;
  }
  if (quote.ship_city && quote.ship_state && quote.ship_zip) {
    doc.setTextColor(55, 65, 81);
    doc.text(`${quote.ship_city}, ${quote.ship_state} ${quote.ship_zip}`, shipToX, shipY);
    shipY += 3.2;
  }
  if (!quote.ship_company && !quote.ship_name && !quote.ship_address_1) {
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'italic');
    doc.text('No shipping address provided', shipToX, shipY);
    shipY += 3.2;
    doc.setFont('helvetica', 'normal');
  }

  doc.setTextColor(55, 65, 81);
  if (quote.po_number) {
    doc.setTextColor(107, 114, 128);
    doc.text('PO #:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.po_number, detailsX + 18, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }
  if (quote.delivery_method) {
    doc.setTextColor(107, 114, 128);
    doc.text('Delivery:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.delivery_method, detailsX + 18, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }
  if (quote.customer_due_date) {
    doc.setTextColor(107, 114, 128);
    doc.text('Due:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(quote.customer_due_date), detailsX + 18, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }
  if (quote.invoice_date) {
    doc.setTextColor(107, 114, 128);
    doc.text('Invoice:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(quote.invoice_date), detailsX + 18, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }
  if (quote.payment_due_date) {
    doc.setTextColor(107, 114, 128);
    doc.text('Pay Due:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(quote.payment_due_date), detailsX + 18, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }
  if (quote.terms) {
    doc.setTextColor(107, 114, 128);
    doc.text('Terms:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.terms, detailsX + 18, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }

  yPosition = Math.max(billY, shipY, detailY) + 5;

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

  const totalTableWidth = contentWidth;
  const styleWidth = 12;
  const colorWidth = 12;
  const descWidth = 28;
  const sizeWidth = 6;
  const qtyWidth = 7;
  const itemsWidth = 8;
  const unitWidth = 12;
  const totalWidth = 12;
  const remainingWidth = totalTableWidth - styleWidth - colorWidth - descWidth - (sizeColumns.length * sizeWidth) - qtyWidth - itemsWidth - unitWidth - totalWidth;
  const adjustedDescWidth = descWidth + remainingWidth;

  for (let groupIdx = 0; groupIdx < itemGroups.length; groupIdx++) {
    const [groupLabel, groupItems] = itemGroups[groupIdx];

    if (groupIdx > 0) {
      yPosition += 4;
    }

    if (groupLabel) {
      if (yPosition + 12 > pageHeight - marginBottom) {
        doc.addPage();
        yPosition = marginTop;
      }

      doc.setFillColor(241, 245, 249);
      doc.rect(marginLeft, yPosition - 1, contentWidth, 6, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(groupLabel, marginLeft + 2, yPosition + 3);
      yPosition += 7;
    }

    const tableHead = [['Style', 'Color', 'Description', ...sizeColumns, 'Qty', 'Items', 'Unit', 'Total']];
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
        fontSize: 5.5,
        cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
        textColor: [17, 24, 39],
        lineWidth: 0.1,
        lineColor: [226, 232, 240],
        overflow: 'linebreak',
        minCellHeight: 5,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
        lineWidth: 0.2,
        lineColor: [203, 213, 225],
        minCellHeight: 5,
      },
      columnStyles: {
        0: { cellWidth: styleWidth, halign: 'left' },
        1: { cellWidth: colorWidth, halign: 'left' },
        2: { cellWidth: adjustedDescWidth, halign: 'left' },
        3: { cellWidth: sizeWidth, halign: 'center' },
        4: { cellWidth: sizeWidth, halign: 'center' },
        5: { cellWidth: sizeWidth, halign: 'center' },
        6: { cellWidth: sizeWidth, halign: 'center' },
        7: { cellWidth: sizeWidth, halign: 'center' },
        8: { cellWidth: sizeWidth, halign: 'center' },
        9: { cellWidth: sizeWidth, halign: 'center' },
        10: { cellWidth: sizeWidth, halign: 'center' },
        11: { cellWidth: sizeWidth, halign: 'center' },
        12: { cellWidth: sizeWidth, halign: 'center' },
        13: { cellWidth: sizeWidth, halign: 'center' },
        14: { cellWidth: sizeWidth, halign: 'center' },
        15: { cellWidth: sizeWidth, halign: 'center' },
        16: { cellWidth: qtyWidth, halign: 'center' },
        17: { cellWidth: itemsWidth, halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235] },
        18: { cellWidth: unitWidth, halign: 'right' },
        19: { cellWidth: totalWidth, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: marginLeft, right: marginRight },
      tableWidth: contentWidth,
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          doc.setFontSize(7);
          doc.setTextColor(156, 163, 175);
          doc.text(`Quote ${quote.quote_number} - Page ${data.pageNumber}`, marginLeft, 10);
        }
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 3;

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
      const imprintGap = 4;
      const imprintWidth = (contentWidth - imprintGap) / imprintsPerRow;
      let imprintX = marginLeft;
      let imprintY = yPosition;
      let maxImprintHeight = 0;

      for (let i = 0; i < groupImprints.length; i++) {
        const imprint = groupImprints[i];

        let estimatedHeight = 28;
        const artworkImages = imprint.artwork_images && Array.isArray(imprint.artwork_images)
          ? imprint.artwork_images
          : imprint.artwork_url
            ? [imprint.artwork_url]
            : [];
        const mockupImages = (imprint.mockups || [])
          .map((m: any) => typeof m === 'string' ? m : m?.url)
          .filter(Boolean);
        if (artworkImages.length > 0 || mockupImages.length > 0) {
          estimatedHeight += 22;
        }

        if (imprintY + estimatedHeight > pageHeight - marginBottom) {
          doc.addPage();
          imprintY = marginTop;
          imprintX = marginLeft;
          maxImprintHeight = 0;
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.roundedRect(imprintX, imprintY, imprintWidth - 2, estimatedHeight, 1.5, 1.5, 'FD');

        let textY = imprintY + 4;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text(`${quote.quote_number}-${String(i + 1).padStart(2, '0')}`, imprintX + 2, textY);

        doc.setFillColor(219, 234, 254);
        doc.setDrawColor(191, 219, 254);
        const typeText = imprint.type_of_work;
        const typeWidth = doc.getTextWidth(typeText) + 3;
        doc.roundedRect(imprintX + 18, textY - 2.5, typeWidth, 4, 0.8, 0.8, 'FD');
        doc.setFontSize(6);
        doc.setTextColor(30, 64, 175);
        doc.text(typeText, imprintX + 19.5, textY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(17, 24, 39);
        doc.text(imprint.location, imprintX + 20 + typeWidth + 1, textY);

        textY += 4.5;

        if (imprint.details || imprint.description) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          const details = imprint.details || imprint.description || '';
          const lines = doc.splitTextToSize(details, imprintWidth - 8);
          doc.text(lines.slice(0, 2), imprintX + 2, textY);
          textY += Math.min(lines.length, 2) * 2.8;
        }

        if (imprint.thread_ink_color) {
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          doc.text(`Colors: ${imprint.thread_ink_color}`, imprintX + 2, textY);
          textY += 3;
        }

        const allImages = [...artworkImages, ...mockupImages];

        if (allImages.length > 0) {
          textY += 1;
          const imgSize = 18;
          const imgGap = 3;
          let imgX = imprintX + 2;

          for (let j = 0; j < Math.min(allImages.length, 4); j++) {
            const imgUrl = allImages[j];
            try {
              const imgBase64 = await imageToBase64(imgUrl);
              if (imgBase64) {
                doc.addImage(imgBase64, 'PNG', imgX, textY, imgSize, imgSize);
                imgX += imgSize + imgGap;
              }
            } catch {
              doc.setDrawColor(226, 232, 240);
              doc.setLineWidth(0.1);
              doc.rect(imgX, textY, imgSize, imgSize);
              imgX += imgSize + imgGap;
            }
          }
          textY += imgSize + 2;
        }

        const currentHeight = textY - imprintY + 2;
        maxImprintHeight = Math.max(maxImprintHeight, currentHeight, estimatedHeight);

        if ((i + 1) % imprintsPerRow === 0) {
          imprintX = marginLeft;
          imprintY += maxImprintHeight + 2;
          maxImprintHeight = 0;
        } else {
          imprintX += imprintWidth;
        }
      }

      if (groupImprints.length % imprintsPerRow !== 0) {
        yPosition = imprintY + maxImprintHeight + 3;
      } else {
        yPosition = imprintY + 2;
      }
    }
  }

  if (fees.length > 0) {
    yPosition += 4;

    if (yPosition + 30 > pageHeight - marginBottom) {
      doc.addPage();
      yPosition = marginTop;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Additional Fees', marginLeft + contentWidth / 2, yPosition);
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
        fontSize: 7,
        cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
        textColor: [17, 24, 39],
        lineWidth: 0.1,
        lineColor: [226, 232, 240],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
        lineWidth: 0.2,
        lineColor: [203, 213, 225],
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: marginLeft + contentWidth / 2, right: marginRight },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 4;
  }

  if (yPosition + 50 > pageHeight - marginBottom) {
    doc.addPage();
    yPosition = marginTop;
  }

  yPosition += 4;
  const totalsWidth = 65;
  const totalsX = marginLeft + contentWidth - totalsWidth;
  const totalsValueX = marginLeft + contentWidth;

  const totalQty = items.reduce((sum, item) => {
    return sum + (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) + (item.qty_yl || 0) +
           (item.qty_yxl || 0) + (item.qty_xs || 0) + (item.qty_s || 0) + (item.qty_m || 0) +
           (item.qty_l || 0) + (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) + (item.qty_4xl || 0);
  }, 0);

  const feesTotal = fees.reduce((sum, fee) => sum + fee.total_price, 0);

  doc.setFontSize(8);

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
    doc.setTextColor(55, 65, 81);
    doc.text(label, totalsX, yPosition);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, totalsValueX - valueWidth, yPosition);
    yPosition += 4;
  });

  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.4);
  doc.line(totalsX, yPosition, totalsValueX, yPosition);
  yPosition += 4.5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Total Due', totalsX, yPosition);
  const totalDueValue = formatCurrency(quote.total);
  const totalDueWidth = doc.getTextWidth(totalDueValue);
  doc.text(totalDueValue, totalsValueX - totalDueWidth, yPosition);
  yPosition += 4.5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('Paid', totalsX, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  const paidValue = formatCurrency(0);
  const paidWidth = doc.getTextWidth(paidValue);
  doc.text(paidValue, totalsValueX - paidWidth, yPosition);
  yPosition += 4.5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('Outstanding', totalsX, yPosition);
  doc.setTextColor(37, 99, 235);
  const outstandingValue = formatCurrency(quote.total);
  const outstandingWidth = doc.getTextWidth(outstandingValue);
  doc.text(outstandingValue, totalsValueX - outstandingWidth, yPosition);
  yPosition += 6;

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Created: ${formatDate(quote.created_date || quote.created_at)}`, marginLeft, yPosition);

  const hasQuoteTerms = quote.quote_terms && quote.quote_terms.trim() && quote.quote_terms !== '<p><br></p>';

  if (yPosition + 45 < pageHeight - marginBottom) {
    yPosition += 8;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, yPosition, rightEdge, yPosition);
    yPosition += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('TERMS & CONDITIONS', marginLeft, yPosition);
    yPosition += 4;

    if (hasQuoteTerms) {
      const result = renderHtmlToPdf(doc, quote.quote_terms!, {
        fontSize: 6.5,
        lineHeight: 2.8,
        maxWidth: contentWidth,
        startY: yPosition,
        marginLeft,
        pageHeight,
        marginBottom,
        textColor: [100, 116, 139],
        boldColor: [55, 65, 81]
      });
      yPosition = result.finalY;
    } else {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);

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
        if (yPosition + 4 > pageHeight - marginBottom) return;
        const lines = doc.splitTextToSize(policy, contentWidth);
        doc.text(lines, marginLeft, yPosition);
        yPosition += lines.length * 2.8 + 0.8;
      });
    }
  }

  const fileName = `Quote_${quote.quote_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(fileName);
}
