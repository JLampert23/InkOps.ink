# Analytics Tab Implementation

## Overview

A comprehensive Analytics tab has been added to your application with 14 on-demand report types. Reports are lazy-loaded for optimal performance and each includes PDF and CSV export capabilities.

## Folder Structure

```
src/
├── components/
│   ├── Analytics.tsx                              # Main analytics page with report list
│   └── analytics/                                 # Individual report components (lazy-loaded)
│       ├── SalesByStyleReport.tsx
│       ├── TopSellingProductsReport.tsx
│       ├── TopGarmentCategoriesReport.tsx
│       ├── RevenueByProductReport.tsx
│       ├── UnitsSoldByProductReport.tsx
│       ├── InvoiceTotalsReport.tsx
│       ├── OutstandingBalancesReport.tsx
│       ├── OverdueInvoicesReport.tsx
│       ├── InvoicesByStatusReport.tsx
│       ├── DecorationBreakdownReport.tsx
│       ├── RevenuePerOrderReport.tsx
│       ├── EstimatedMarginReport.tsx
│       ├── RevenuePerGarmentReport.tsx
│       └── RevenuePerDecorationReport.tsx
└── utils/
    └── analytics-export.ts                        # Shared export utilities
```

## Available Reports

### Sales & Revenue
1. **Sales by Style Number** - Analyze sales performance by product style
2. **Revenue by Product** - Total revenue generated per product
3. **Revenue per Order** - Average and total revenue per order
4. **Estimated Margin per Order** - Profit margin analysis for orders

### Product Performance
5. **Top-Selling Products** - Best performing products by quantity
6. **Top-Selling Garment Categories** - Most popular garment types
7. **Units Sold by Product** - Quantity of each product sold
8. **Revenue per Garment Type** - Revenue breakdown by garment type

### Invoice Analytics
9. **Invoice Totals, Subtotals, Taxes & Fees** - Complete invoice financial breakdown
10. **Outstanding Balances** - All unpaid invoice balances
11. **Overdue Invoices** - Past due invoice tracking
12. **Invoices by Status** - Invoice breakdown by current status

### Decoration & Services
13. **Decoration Type Breakdown** - Revenue by decoration method
14. **Revenue per Decoration Type** - Financial performance by decoration

## Key Features

### On-Demand Loading
- Reports are NOT rendered when the Analytics tab opens
- Each report loads only when the user selects it
- Uses React lazy loading for optimal performance
- Build output shows individual chunks for each report

### Export Capabilities
Each report includes:
- **Export CSV** button - Exports data to comma-separated values file
- **Export PDF** button - Generates professional PDF with:
  - Report title and date range
  - Summary statistics
  - Formatted table with all data
  - Professional styling

### Common Features
All reports include:
- Date range selector (start and end date)
- Generate Report button
- Clean card-based layout
- Responsive table design
- Loading states
- Empty state handling
- Consistent styling with existing design system

### Shared Utilities

Located in `src/utils/analytics-export.ts`:

```typescript
// Export functions
exportToCSV(options)
exportToPDF(options)

// Formatting functions
formatCurrency(value)
formatNumber(value)
formatPercent(value)
formatDate(date)
```

## Integration Points

### Placeholder Data Fetching

Each report contains a `generateReport()` function with placeholder data. Replace these with actual Printavo API v2 calls:

```typescript
const generateReport = () => {
  // TODO: Replace with actual Printavo API v2 call
  // Example:
  // const response = await fetch(printavoApiUrl, {
  //   method: 'POST',
  //   body: JSON.stringify({
  //     dateStart: dateRange.start,
  //     dateEnd: dateRange.end
  //   })
  // });
  // const data = await response.json();
  // setReportData(data);

  // Current placeholder data
  const mockData = [...];
  setReportData(mockData);
  setIsGenerated(true);
};
```

### TypeScript Interfaces

Each report defines its own data interface. Example:

```typescript
interface SalesByStyleData {
  styleNumber: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  averagePrice: number;
}
```

## Usage

1. Navigate to the Analytics tab in the sidebar
2. Select a report from the categorized list
3. Set date range and any filters
4. Click "Generate Report"
5. Export to CSV or PDF as needed
6. Click "Back to Reports List" to select another report

## Styling

The implementation follows your existing design system:
- Card-based layouts
- Consistent spacing (8px system)
- Professional color scheme (blue accents, not purple)
- Responsive design with breakpoints
- Hover states and transitions
- Clean typography hierarchy

## Performance

The lazy-loading implementation creates separate code chunks for each report:
- Main Analytics component: ~9KB
- Each report component: ~4-6KB (only loaded when selected)
- Shared utilities: ~2KB
- Total bundle size minimized through code splitting

## Next Steps

To complete the integration:

1. **Wire up Printavo API v2** - Replace placeholder data fetching in each report's `generateReport()` function
2. **Test with real data** - Verify data formatting and display with actual API responses
3. **Add filters** - Implement optional filters (customer, product, status) where applicable
4. **Error handling** - Add error states for failed API calls
5. **Loading states** - Enhance loading indicators during API calls

## File Locations

All new files created:
- `/src/components/Analytics.tsx`
- `/src/components/analytics/[ReportName].tsx` (14 files)
- `/src/utils/analytics-export.ts`

Updated files:
- `/src/App.tsx` - Added Analytics tab to sidebar navigation
