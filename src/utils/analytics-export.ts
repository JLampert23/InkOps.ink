import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
  format?: (value: any) => string;
}

export interface ExportOptions {
  filename: string;
  title: string;
  columns: ExportColumn[];
  data: any[];
  dateRange?: string;
  summary?: { label: string; value: string }[];
}

export function exportToCSV(options: ExportOptions): void {
  const { filename, columns, data } = options;

  const headers = columns.map(col => col.header);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (col.format) {
        return col.format(value);
      }
      return value !== null && value !== undefined ? String(value) : '';
    })
  );

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return `"${stringCell.replace(/"/g, '""')}"`;
        }
        return stringCell;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportToPDF(options: ExportOptions): void {
  const { filename, title, columns, data, dateRange, summary } = options;

  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);

  let yPosition = 30;

  if (dateRange) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(dateRange, 14, yPosition);
    yPosition += 10;
  }

  if (summary && summary.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    summary.forEach(item => {
      doc.text(`${item.label}: ${item.value}`, 14, yPosition);
      yPosition += 6;
    });
    yPosition += 4;
  }

  const tableData = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (col.format) {
        return col.format(value);
      }
      return value !== null && value !== undefined ? String(value) : '';
    })
  );

  autoTable(doc, {
    head: [columns.map(col => col.header)],
    body: tableData,
    startY: yPosition,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 20 },
  });

  doc.save(`${filename}.pdf`);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

function extractDecorationType(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('screen print') || lower.includes('screenprint')) return 'Screen Print';
  if (lower.includes('embroid')) return 'Embroidery';
  if (lower.includes('dtg') || lower.includes('direct to garment')) return 'DTG';
  if (lower.includes('heat transfer') || lower.includes('vinyl')) return 'Heat Transfer';
  if (lower.includes('sublimation') || lower.includes('dye sub')) return 'Sublimation';
  if (lower.includes('patch')) return 'Patches';
  if (lower.includes('printing') || lower.includes('print')) return 'Printing';
  return 'Other/Garment';
}

function extractGarmentType(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('hoodie') || lower.includes('hooded')) return 'Hoodies';
  if (lower.includes('sweatshirt') || lower.includes('fleece')) return 'Sweatshirts';
  if (lower.includes('t-shirt') || lower.includes('tee') || lower.includes('softstyle')) return 'T-Shirts';
  if (lower.includes('tank')) return 'Tank Tops';
  if (lower.includes('polo')) return 'Polo Shirts';
  if (lower.includes('jacket')) return 'Jackets';
  if (lower.includes('hat') || lower.includes('cap') || lower.includes('beanie')) return 'Headwear';
  if (lower.includes('bag') || lower.includes('tote') || lower.includes('backpack')) return 'Bags';
  if (lower.includes('long sleeve') || lower.includes('longsleeve')) return 'Long Sleeve';
  if (lower.includes('pants') || lower.includes('joggers') || lower.includes('sweatpants')) return 'Bottoms';
  return 'Other';
}

function getSalesByStyleData(invoices: any[], lineItems: any[]) {
  const invoiceIds = new Set(invoices.map(inv => inv.id));
  const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

  const productMap = new Map<string, { quantity: number; revenue: number }>();

  relevantLineItems.forEach(item => {
    const description = item.description || 'Unknown Product';
    const quantity = item.quantity || 0;
    const revenue = item.total_price || 0;

    if (!productMap.has(description)) {
      productMap.set(description, { quantity: 0, revenue: 0 });
    }

    const productData = productMap.get(description)!;
    productData.quantity += quantity;
    productData.revenue += revenue;
  });

  return Array.from(productMap.entries())
    .map(([productName, data]) => ({
      productName,
      quantitySold: data.quantity,
      totalRevenue: data.revenue,
      averagePrice: data.quantity > 0 ? data.revenue / data.quantity : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function getTopSellingProductsData(invoices: any[], lineItems: any[]) {
  const invoiceIds = new Set(invoices.map(inv => inv.id));
  const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

  const productMap = new Map<string, number>();

  relevantLineItems.forEach(item => {
    const name = item.description || 'Unknown Product';
    const qty = Number(item.quantity) || 0;
    productMap.set(name, (productMap.get(name) || 0) + qty);
  });

  const totalQuantity = Array.from(productMap.values()).reduce((sum, qty) => sum + qty, 0);

  return Array.from(productMap.entries())
    .map(([productName, qty], index) => ({
      rank: index + 1,
      productName,
      quantitySold: qty,
      percentOfTotal: totalQuantity > 0 ? (qty / totalQuantity) * 100 : 0
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold);
}

function getRevenueByProductData(invoices: any[], lineItems: any[]) {
  const invoiceIds = new Set(invoices.map(inv => inv.id));
  const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

  const productMap = new Map<string, { revenue: number; units: number }>();

  relevantLineItems.forEach(item => {
    const name = item.description || 'Unknown Product';
    const revenue = Number(item.total_price) || 0;
    const units = Number(item.quantity) || 0;

    const existing = productMap.get(name) || { revenue: 0, units: 0 };
    productMap.set(name, {
      revenue: existing.revenue + revenue,
      units: existing.units + units
    });
  });

  const totalRevenue = Array.from(productMap.values()).reduce((sum, data) => sum + data.revenue, 0);

  return Array.from(productMap.entries())
    .map(([productName, data]) => ({
      productName,
      unitsSold: data.units,
      revenue: data.revenue,
      averagePrice: data.units > 0 ? data.revenue / data.units : 0,
      percentOfTotalRevenue: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function getDecorationBreakdownData(invoices: any[], lineItems: any[]) {
  const invoiceIds = new Set(invoices.map(inv => inv.id));
  const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

  const decorationMap = new Map<string, { orders: Set<string>; units: number; revenue: number }>();

  relevantLineItems.forEach(item => {
    const type = extractDecorationType(item.description || '');
    const units = Number(item.quantity) || 0;
    const revenue = Number(item.total_price) || 0;

    if (!decorationMap.has(type)) {
      decorationMap.set(type, { orders: new Set(), units: 0, revenue: 0 });
    }

    const existing = decorationMap.get(type)!;
    existing.orders.add(item.invoice_id);
    existing.units += units;
    existing.revenue += revenue;
  });

  const totalRevenue = Array.from(decorationMap.values()).reduce((sum, data) => sum + data.revenue, 0);

  return Array.from(decorationMap.entries())
    .map(([decorationType, data]) => ({
      decorationType,
      orderCount: data.orders.size,
      unitsSold: data.units,
      revenue: data.revenue,
      percentOfRevenue: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function getTopGarmentCategoriesData(invoices: any[], lineItems: any[]) {
  const invoiceIds = new Set(invoices.map(inv => inv.id));
  const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

  const categoryMap = new Map<string, { quantity: number; revenue: number }>();

  relevantLineItems.forEach(item => {
    const category = extractGarmentType(item.description || '');
    const qty = Number(item.quantity) || 0;
    const revenue = Number(item.total_price) || 0;

    const existing = categoryMap.get(category) || { quantity: 0, revenue: 0 };
    categoryMap.set(category, {
      quantity: existing.quantity + qty,
      revenue: existing.revenue + revenue
    });
  });

  const totalQuantity = Array.from(categoryMap.values()).reduce((sum, data) => sum + data.quantity, 0);

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      quantitySold: data.quantity,
      revenue: data.revenue,
      percentOfTotal: totalQuantity > 0 ? (data.quantity / totalQuantity) * 100 : 0
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold);
}

function getRevenuePerGarmentData(invoices: any[], lineItems: any[]) {
  const invoiceIds = new Set(invoices.map(inv => inv.id));
  const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

  const garmentMap = new Map<string, { units: number; revenue: number }>();

  relevantLineItems.forEach(item => {
    const type = extractGarmentType(item.description || '');
    const units = Number(item.quantity) || 0;
    const revenue = Number(item.total_price) || 0;

    const existing = garmentMap.get(type) || { units: 0, revenue: 0 };
    garmentMap.set(type, {
      units: existing.units + units,
      revenue: existing.revenue + revenue
    });
  });

  const totalRevenue = Array.from(garmentMap.values()).reduce((sum, data) => sum + data.revenue, 0);

  return Array.from(garmentMap.entries())
    .map(([garmentType, data]) => ({
      garmentType,
      unitsSold: data.units,
      revenue: data.revenue,
      avgPricePerUnit: data.units > 0 ? data.revenue / data.units : 0,
      percentOfRevenue: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function getRevenuePerDecorationData(invoices: any[], lineItems: any[]) {
  const invoiceIds = new Set(invoices.map(inv => inv.id));
  const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

  const decorationMap = new Map<string, { orders: Set<string>; revenue: number }>();

  relevantLineItems.forEach(item => {
    const type = extractDecorationType(item.description || '');
    const revenue = Number(item.total_price) || 0;

    if (!decorationMap.has(type)) {
      decorationMap.set(type, { orders: new Set(), revenue: 0 });
    }

    const existing = decorationMap.get(type)!;
    existing.orders.add(item.invoice_id);
    existing.revenue += revenue;
  });

  const totalRevenue = Array.from(decorationMap.values()).reduce((sum, data) => sum + data.revenue, 0);

  return Array.from(decorationMap.entries())
    .map(([decorationType, data]) => ({
      decorationType,
      orderCount: data.orders.size,
      revenue: data.revenue,
      avgRevenuePerOrder: data.orders.size > 0 ? data.revenue / data.orders.size : 0,
      percentOfRevenue: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function exportAnalyticsReport(
  invoices: any[],
  _payments: any[],
  reportName: string,
  format: 'csv' | 'pdf',
  dateRange: { startDate: Date; endDate: Date },
  reportType?: string,
  lineItems?: any[]
): void {
  const dateRangeStr = `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${reportName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`;

  let columns: ExportColumn[] = [];
  let data: any[] = [];
  let summary: { label: string; value: string }[] = [];

  switch (reportType) {
    case 'sales-by-style':
      if (lineItems) {
        const styleData = getSalesByStyleData(invoices, lineItems);
        columns = [
          { header: 'Product Name', key: 'productName' },
          { header: 'Quantity Sold', key: 'quantitySold', format: formatNumber },
          { header: 'Total Revenue', key: 'totalRevenue', format: formatCurrency },
          { header: 'Average Price', key: 'averagePrice', format: formatCurrency },
        ];
        data = styleData;
        summary = [
          { label: 'Report', value: reportName },
          { label: 'Date Range', value: dateRangeStr },
          { label: 'Total Products', value: String(styleData.length) },
          {
            label: 'Total Revenue',
            value: formatCurrency(styleData.reduce((sum, item) => sum + item.totalRevenue, 0))
          },
          {
            label: 'Total Units Sold',
            value: formatNumber(styleData.reduce((sum, item) => sum + item.quantitySold, 0))
          },
        ];
      }
      break;

    case 'top-selling-products':
      if (lineItems) {
        const topProducts = getTopSellingProductsData(invoices, lineItems);
        columns = [
          { header: 'Rank', key: 'rank' },
          { header: 'Product Name', key: 'productName' },
          { header: 'Quantity Sold', key: 'quantitySold', format: formatNumber },
          { header: '% of Total', key: 'percentOfTotal', format: formatPercent },
        ];
        data = topProducts.slice(0, 20);
        summary = [
          { label: 'Report', value: reportName },
          { label: 'Date Range', value: dateRangeStr },
          {
            label: 'Total Units Sold',
            value: formatNumber(topProducts.reduce((sum, item) => sum + item.quantitySold, 0))
          },
        ];
      }
      break;

    case 'revenue-by-product':
      if (lineItems) {
        const revenueData = getRevenueByProductData(invoices, lineItems);
        columns = [
          { header: 'Product Name', key: 'productName' },
          { header: 'Units Sold', key: 'unitsSold', format: formatNumber },
          { header: 'Total Revenue', key: 'revenue', format: formatCurrency },
          { header: '% of Total Revenue', key: 'percentOfTotalRevenue', format: formatPercent },
          { header: 'Avg Price', key: 'averagePrice', format: formatCurrency },
        ];
        data = revenueData;
        summary = [
          { label: 'Report', value: reportName },
          { label: 'Date Range', value: dateRangeStr },
          {
            label: 'Total Revenue',
            value: formatCurrency(revenueData.reduce((sum, item) => sum + item.revenue, 0))
          },
        ];
      }
      break;

    case 'units-sold-by-product':
      if (lineItems) {
        const unitsData = getTopSellingProductsData(invoices, lineItems);
        columns = [
          { header: 'Product Name', key: 'productName' },
          { header: 'Units Sold', key: 'quantitySold', format: formatNumber },
          { header: '% of Total', key: 'percentOfTotal', format: formatPercent },
        ];
        data = unitsData;
        summary = [
          { label: 'Report', value: reportName },
          { label: 'Date Range', value: dateRangeStr },
          {
            label: 'Total Units Sold',
            value: formatNumber(unitsData.reduce((sum, item) => sum + item.quantitySold, 0))
          },
        ];
      }
      break;

    case 'decoration-breakdown':
      if (lineItems) {
        const decorationData = getDecorationBreakdownData(invoices, lineItems);
        columns = [
          { header: 'Decoration Type', key: 'decorationType' },
          { header: 'Orders', key: 'orderCount', format: formatNumber },
          { header: 'Units', key: 'unitsSold', format: formatNumber },
          { header: 'Revenue', key: 'revenue', format: formatCurrency },
          { header: '% of Revenue', key: 'percentOfRevenue', format: formatPercent },
        ];
        data = decorationData;
        summary = [
          { label: 'Report', value: reportName },
          { label: 'Date Range', value: dateRangeStr },
          {
            label: 'Total Revenue',
            value: formatCurrency(decorationData.reduce((sum, item) => sum + item.revenue, 0))
          },
        ];
      }
      break;

    case 'top-garment-categories':
      if (lineItems) {
        const garmentData = getTopGarmentCategoriesData(invoices, lineItems);
        columns = [
          { header: 'Category', key: 'category' },
          { header: 'Quantity Sold', key: 'quantitySold', format: formatNumber },
          { header: 'Revenue', key: 'revenue', format: formatCurrency },
          { header: '% of Total', key: 'percentOfTotal', format: formatPercent },
        ];
        data = garmentData;
        summary = [
          { label: 'Report', value: reportName },
          { label: 'Date Range', value: dateRangeStr },
          {
            label: 'Total Units Sold',
            value: formatNumber(garmentData.reduce((sum, item) => sum + item.quantitySold, 0))
          },
          {
            label: 'Total Revenue',
            value: formatCurrency(garmentData.reduce((sum, item) => sum + item.revenue, 0))
          },
        ];
      }
      break;

    case 'revenue-per-garment':
      if (lineItems) {
        const garmentRevenueData = getRevenuePerGarmentData(invoices, lineItems);
        columns = [
          { header: 'Garment Type', key: 'garmentType' },
          { header: 'Units Sold', key: 'unitsSold', format: formatNumber },
          { header: 'Revenue', key: 'revenue', format: formatCurrency },
          { header: 'Avg Price Per Unit', key: 'avgPricePerUnit', format: formatCurrency },
          { header: '% of Revenue', key: 'percentOfRevenue', format: formatPercent },
        ];
        data = garmentRevenueData;
        summary = [
          { label: 'Report', value: reportName },
          { label: 'Date Range', value: dateRangeStr },
          {
            label: 'Total Revenue',
            value: formatCurrency(garmentRevenueData.reduce((sum, item) => sum + item.revenue, 0))
          },
          {
            label: 'Total Units',
            value: formatNumber(garmentRevenueData.reduce((sum, item) => sum + item.unitsSold, 0))
          },
        ];
      }
      break;

    case 'revenue-per-decoration':
      if (lineItems) {
        const decorationRevenueData = getRevenuePerDecorationData(invoices, lineItems);
        columns = [
          { header: 'Decoration Type', key: 'decorationType' },
          { header: 'Order Count', key: 'orderCount', format: formatNumber },
          { header: 'Revenue', key: 'revenue', format: formatCurrency },
          { header: 'Avg Revenue Per Order', key: 'avgRevenuePerOrder', format: formatCurrency },
          { header: '% of Revenue', key: 'percentOfRevenue', format: formatPercent },
        ];
        data = decorationRevenueData;
        summary = [
          { label: 'Report', value: reportName },
          { label: 'Date Range', value: dateRangeStr },
          {
            label: 'Total Revenue',
            value: formatCurrency(decorationRevenueData.reduce((sum, item) => sum + item.revenue, 0))
          },
          {
            label: 'Total Orders',
            value: formatNumber(decorationRevenueData.reduce((sum, item) => sum + item.orderCount, 0))
          },
        ];
      }
      break;

    default:
      columns = [
        { header: 'Customer', key: 'customer' },
        { header: 'Invoice #', key: 'invoiceNumber' },
        { header: 'Date', key: 'date', format: formatDate },
        { header: 'Total', key: 'total', format: formatCurrency },
        { header: 'Status', key: 'status' },
      ];
      data = invoices.map(invoice => ({
        customer: invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown',
        invoiceNumber: invoice.visualId || invoice.id?.slice(0, 8) || '',
        date: invoice.createdAt,
        total: invoice.total || 0,
        status: invoice.status?.name || 'N/A',
      }));
      summary = [
        { label: 'Report', value: reportName },
        { label: 'Date Range', value: dateRangeStr },
        { label: 'Total Invoices', value: String(invoices.length) },
        {
          label: 'Total Amount',
          value: formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total || 0), 0))
        },
      ];
  }

  const options: ExportOptions = {
    filename,
    title: reportName,
    columns,
    data,
    dateRange: dateRangeStr,
    summary,
  };

  if (format === 'csv') {
    exportToCSV(options);
  } else {
    exportToPDF(options);
  }
}
