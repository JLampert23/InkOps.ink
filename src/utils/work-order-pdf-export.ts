import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface WorkOrderPDFData {
  work_order_number: string;
  quote_number?: string;
  nickname?: string;
  customer_name: string;
  status: string;
  total_quantity: number;
  production_due_date: string | null;
  customer_due_date: string | null;
  notes: string | null;
  created_at: string;
  quote?: {
    customer_email?: string;
    customer_phone?: string;
    bill_company?: string;
    bill_name?: string;
    bill_address_1?: string;
    bill_address_2?: string;
    bill_city?: string;
    bill_state?: string;
    bill_zip?: string;
    bill_email?: string;
    bill_phone?: string;
    ship_company?: string;
    ship_name?: string;
    ship_address_1?: string;
    ship_address_2?: string;
    ship_city?: string;
    ship_state?: string;
    ship_zip?: string;
    po_number?: string;
    delivery_method?: string;
    terms?: string;
    notes?: string;
    production_notes?: string;
  };
  line_items: Array<{
    item_number?: string;
    description: string;
    color?: string;
    notes?: string;
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
  }>;
  imprints: Array<{
    id?: string;
    type_of_work: string;
    location: string;
    num_colors?: number;
    details?: string;
    thread_ink_color?: string;
    artwork_url?: string;
    artwork_images?: string[];
    mockups?: any[];
    group_label?: string | null;
    imprint_number?: string;
  }>;
  company_name: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
  company_logo_url: string | null;
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

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
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

const SIZE_LABELS = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

function getSizeValues(item: WorkOrderPDFData['line_items'][0]): (number | null)[] {
  return [
    item.qty_yxs, item.qty_ys, item.qty_ym, item.qty_yl, item.qty_yxl,
    item.qty_xs, item.qty_s, item.qty_m, item.qty_l, item.qty_xl,
    item.qty_2xl, item.qty_3xl, item.qty_4xl,
  ];
}

function getItemQty(item: WorkOrderPDFData['line_items'][0]): number {
  return (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) + (item.qty_yl || 0) +
         (item.qty_yxl || 0) + (item.qty_xs || 0) + (item.qty_s || 0) + (item.qty_m || 0) +
         (item.qty_l || 0) + (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
         (item.qty_4xl || 0);
}

export async function generateWorkOrderPDF(data: WorkOrderPDFData): Promise<void> {
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

  let logoData: ImageDimensions | null = null;
  if (data.company_logo_url) {
    logoData = await imageToBase64WithDimensions(data.company_logo_url);
  }

  const maxLogoHeight = 20;
  const maxLogoWidth = 45;
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

  const companyInfoX = logoData && actualLogoWidth > 0 ? marginLeft + actualLogoWidth + 4 : marginLeft;
  let companyY = yPosition + 1;

  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  if (data.company_name) {
    doc.text(data.company_name, companyInfoX, companyY);
    companyY += 4.5;
  }

  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');

  if (data.company_address) {
    doc.text(data.company_address, companyInfoX, companyY);
    companyY += 3.5;
  }

  if (data.company_city && data.company_state && data.company_zip) {
    doc.text(`${data.company_city}, ${data.company_state} ${data.company_zip}`, companyInfoX, companyY);
    companyY += 3.5;
  }

  if (data.company_phone) {
    doc.text(data.company_phone, companyInfoX, companyY);
    companyY += 3.5;
  }

  if (data.company_email) {
    doc.text(data.company_email, companyInfoX, companyY);
    companyY += 3.5;
  }

  if (data.company_website) {
    doc.text(data.company_website, companyInfoX, companyY);
    companyY += 3.5;
  }

  const rightEdge = marginLeft + contentWidth;
  let rightY = yPosition;

  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  const titleText = 'WORK ORDER';
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, rightEdge - titleWidth, rightY + 2);
  rightY += 8;

  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');

  const metaX = rightEdge - 60;

  const metaDetails: [string, string][] = [
    ['Work Order #:', data.work_order_number],
  ];

  if (data.quote_number) {
    metaDetails.push(['Quote #:', data.quote_number]);
  }

  if (data.nickname) {
    metaDetails.push(['Job Name:', data.nickname]);
  }

  metaDetails.push(['Date:', formatDate(data.created_at)]);
  metaDetails.push(['Status:', data.status]);

  metaDetails.forEach(([label, value]) => {
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

  const colWidth = (contentWidth - 8) / 3;
  const billToX = marginLeft;
  const shipToX = marginLeft + colWidth + 4;
  const detailsX = marginLeft + 2 * colWidth + 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('CUSTOMER BILLING', billToX, yPosition);
  doc.text('CUSTOMER SHIPPING', shipToX, yPosition);
  doc.text('WORK ORDER DETAILS', detailsX, yPosition);
  yPosition += 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  let billY = yPosition;
  let shipY = yPosition;
  let detailY = yPosition;

  const quote = data.quote;

  if (quote?.bill_company) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(quote.bill_company, billToX, billY);
    billY += 3.2;
    doc.setFont('helvetica', 'normal');
  }
  if (quote?.bill_name) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.bill_name, billToX, billY);
    billY += 3.2;
  }
  if (quote?.bill_address_1) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.bill_address_1, billToX, billY);
    billY += 3.2;
  }
  if (quote?.bill_address_2) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.bill_address_2, billToX, billY);
    billY += 3.2;
  }
  if (quote?.bill_city && quote?.bill_state && quote?.bill_zip) {
    doc.setTextColor(55, 65, 81);
    doc.text(`${quote.bill_city}, ${quote.bill_state} ${quote.bill_zip}`, billToX, billY);
    billY += 3.2;
  }
  if (quote?.bill_email || quote?.customer_email) {
    doc.setTextColor(37, 99, 235);
    doc.text(quote.bill_email || quote.customer_email || '', billToX, billY);
    billY += 3.2;
  }
  if (quote?.bill_phone || quote?.customer_phone) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.bill_phone || quote.customer_phone || '', billToX, billY);
    billY += 3.2;
  }
  if (!quote?.bill_company && !quote?.bill_name && !quote?.bill_address_1) {
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'italic');
    doc.text('No billing address provided', billToX, billY);
    billY += 3.2;
    doc.setFont('helvetica', 'normal');
  }

  if (quote?.ship_company) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(quote.ship_company, shipToX, shipY);
    shipY += 3.2;
    doc.setFont('helvetica', 'normal');
  }
  if (quote?.ship_name) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.ship_name, shipToX, shipY);
    shipY += 3.2;
  }
  if (quote?.ship_address_1) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.ship_address_1, shipToX, shipY);
    shipY += 3.2;
  }
  if (quote?.ship_address_2) {
    doc.setTextColor(55, 65, 81);
    doc.text(quote.ship_address_2, shipToX, shipY);
    shipY += 3.2;
  }
  if (quote?.ship_city && quote?.ship_state && quote?.ship_zip) {
    doc.setTextColor(55, 65, 81);
    doc.text(`${quote.ship_city}, ${quote.ship_state} ${quote.ship_zip}`, shipToX, shipY);
    shipY += 3.2;
  }
  if (!quote?.ship_company && !quote?.ship_name && !quote?.ship_address_1) {
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'italic');
    doc.text('No shipping address provided', shipToX, shipY);
    shipY += 3.2;
    doc.setFont('helvetica', 'normal');
  }

  doc.setTextColor(55, 65, 81);
  if (quote?.po_number) {
    doc.setTextColor(107, 114, 128);
    doc.text('PO #:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.po_number, detailsX + 20, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }
  if (quote?.delivery_method) {
    doc.setTextColor(107, 114, 128);
    doc.text('Delivery:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.delivery_method, detailsX + 20, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }
  if (data.customer_due_date) {
    doc.setTextColor(107, 114, 128);
    doc.text('Customer Due:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(data.customer_due_date), detailsX + 25, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }
  if (data.production_due_date) {
    doc.setTextColor(107, 114, 128);
    doc.text('Production Due:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(data.production_due_date), detailsX + 25, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }
  if (quote?.terms) {
    doc.setTextColor(107, 114, 128);
    doc.text('Terms:', detailsX, detailY);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.terms, detailsX + 20, detailY);
    doc.setFont('helvetica', 'normal');
    detailY += 3.2;
  }

  yPosition = Math.max(billY, shipY, detailY) + 5;

  const items = data.line_items;
  const groupedItems = items.reduce((acc, item) => {
    const groupLabel = item.group_label || '';
    if (!acc[groupLabel]) {
      acc[groupLabel] = [];
    }
    acc[groupLabel].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const itemGroups = Object.entries(groupedItems);

  const totalTableWidth = contentWidth;
  const styleWidth = 14;
  const colorWidth = 14;
  const descWidth = 30;
  const sizeWidth = 6;
  const qtyWidth = 9;
  const remainingWidth = totalTableWidth - styleWidth - colorWidth - descWidth - (SIZE_LABELS.length * sizeWidth) - qtyWidth;
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

    const tableHead = [['Style #', 'Color', 'Description', ...SIZE_LABELS, 'Qty']];
    const tableBody: any[][] = [];

    for (const item of groupItems) {
      const totalQty = getItemQty(item);
      const sizeValues = getSizeValues(item);

      const row = [
        item.item_number || '-',
        item.color || '-',
        item.description + (item.notes ? `\n${item.notes}` : ''),
        ...sizeValues.map(v => v || ''),
        totalQty.toString(),
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
        16: { cellWidth: qtyWidth, halign: 'center', fontStyle: 'bold' },
      },
      margin: { left: marginLeft, right: marginRight },
      tableWidth: contentWidth,
      didDrawPage: (tableData: any) => {
        if (tableData.pageNumber > 1) {
          doc.setFontSize(7);
          doc.setTextColor(156, 163, 175);
          doc.text(`Work Order ${data.work_order_number} - Page ${tableData.pageNumber}`, marginLeft, 10);
        }
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 3;

    const normalizeLabel = (label: string | null | undefined) => label || '';
    const normalizedGroupLabel = normalizeLabel(groupLabel);

    let groupImprints: typeof data.imprints = [];
    if (data.imprints && data.imprints.length > 0) {
      if (itemGroups.length === 1 && !groupLabel) {
        groupImprints = data.imprints;
      } else {
        groupImprints = data.imprints.filter(imp => {
          const imprintLabel = normalizeLabel(imp.group_label);
          return imprintLabel === normalizedGroupLabel;
        });
      }
    }

    if (groupImprints && groupImprints.length > 0) {
      const imprintsPerRow = 3;
      const imprintGap = 3;
      const imprintWidth = (contentWidth - (imprintGap * (imprintsPerRow - 1))) / imprintsPerRow;
      let imprintX = marginLeft;
      let imprintY = yPosition;
      let maxImprintHeight = 0;

      for (let i = 0; i < groupImprints.length; i++) {
        const imprint = groupImprints[i];

        let estimatedHeight = 26;
        const artworkImages = imprint.artwork_images && Array.isArray(imprint.artwork_images)
          ? imprint.artwork_images
          : imprint.artwork_url
            ? [imprint.artwork_url]
            : [];
        const mockupImages = (imprint.mockups || [])
          .map((m: any) => typeof m === 'string' ? m : m?.url)
          .filter(Boolean);
        if (artworkImages.length > 0 || mockupImages.length > 0) {
          estimatedHeight += 20;
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
        doc.roundedRect(imprintX, imprintY, imprintWidth, estimatedHeight, 1.5, 1.5, 'FD');

        let textY = imprintY + 4;

        const imprintLabel = imprint.imprint_number || `${data.quote_number || data.work_order_number}-${String(i + 1).padStart(2, '0')}`;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text(imprintLabel, imprintX + 2, textY);

        doc.setFillColor(219, 234, 254);
        doc.setDrawColor(191, 219, 254);
        const typeText = imprint.type_of_work;
        const typeWidth = doc.getTextWidth(typeText) + 3;
        doc.roundedRect(imprintX + 2, textY + 1.5, typeWidth, 4, 0.8, 0.8, 'FD');
        doc.setFontSize(6);
        doc.setTextColor(30, 64, 175);
        doc.text(typeText, imprintX + 3.5, textY + 4);

        textY += 7;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(17, 24, 39);
        doc.text(imprint.location, imprintX + 2, textY);
        textY += 3.5;

        if (imprint.thread_ink_color) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          const colorText = `Colors: ${imprint.thread_ink_color}${imprint.num_colors ? ` (${imprint.num_colors} color${imprint.num_colors > 1 ? 's' : ''})` : ''}`;
          const lines = doc.splitTextToSize(colorText, imprintWidth - 6);
          doc.text(lines.slice(0, 2), imprintX + 2, textY);
          textY += Math.min(lines.length, 2) * 2.5;
        }

        if (imprint.details) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          const lines = doc.splitTextToSize(imprint.details, imprintWidth - 6);
          doc.text(lines.slice(0, 2), imprintX + 2, textY);
          textY += Math.min(lines.length, 2) * 2.5;
        }

        const allImages = [...artworkImages, ...mockupImages];

        if (allImages.length > 0) {
          textY += 1;
          const imgSize = 16;
          const imgGap = 2;
          let imgX = imprintX + 2;
          const maxImagesPerRow = Math.floor((imprintWidth - 4) / (imgSize + imgGap));

          for (let j = 0; j < Math.min(allImages.length, maxImagesPerRow); j++) {
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
          imprintX += imprintWidth + imprintGap;
        }
      }

      if (groupImprints.length % imprintsPerRow !== 0) {
        yPosition = imprintY + maxImprintHeight + 3;
      } else {
        yPosition = imprintY + 2;
      }
    }
  }

  if (yPosition + 30 > pageHeight - marginBottom) {
    doc.addPage();
    yPosition = marginTop;
  }

  yPosition += 4;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPosition, rightEdge, yPosition);
  yPosition += 6;

  const totalQty = items.reduce((sum, item) => sum + getItemQty(item), 0);

  const totalsWidth = 55;
  const totalsX = marginLeft + contentWidth - totalsWidth;
  const totalsValueX = marginLeft + contentWidth;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Total Quantity', totalsX, yPosition);
  const qtyValue = (totalQty || data.total_quantity).toString();
  const qtyValueWidth = doc.getTextWidth(qtyValue);
  doc.text(qtyValue, totalsValueX - qtyValueWidth, yPosition);
  yPosition += 8;

  const hasNotes = data.notes || quote?.production_notes || quote?.notes;
  if (hasNotes) {
    if (yPosition + 30 > pageHeight - marginBottom) {
      doc.addPage();
      yPosition = marginTop;
    }

    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, yPosition, rightEdge, yPosition);
    yPosition += 6;

    if (data.notes) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Production Notes', marginLeft, yPosition);
      yPosition += 4;

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      const notesLines = doc.splitTextToSize(data.notes, contentWidth);
      doc.text(notesLines, marginLeft, yPosition);
      yPosition += notesLines.length * 3 + 4;
    }

    if (quote?.production_notes && quote.production_notes !== data.notes) {
      if (yPosition + 15 > pageHeight - marginBottom) {
        doc.addPage();
        yPosition = marginTop;
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Quote Production Notes', marginLeft, yPosition);
      yPosition += 4;

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      const notesLines = doc.splitTextToSize(quote.production_notes, contentWidth);
      doc.text(notesLines, marginLeft, yPosition);
      yPosition += notesLines.length * 3 + 4;
    }

    if (quote?.notes) {
      if (yPosition + 15 > pageHeight - marginBottom) {
        doc.addPage();
        yPosition = marginTop;
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Customer Notes', marginLeft, yPosition);
      yPosition += 4;

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      const notesLines = doc.splitTextToSize(quote.notes, contentWidth);
      doc.text(notesLines, marginLeft, yPosition);
      yPosition += notesLines.length * 3 + 4;
    }
  }

  yPosition += 4;
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Created: ${formatDate(data.created_at)}`, marginLeft, yPosition);

  const fileName = `WorkOrder_${data.work_order_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(fileName);
}
