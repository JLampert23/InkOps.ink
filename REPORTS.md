# Financial Reports System

A comprehensive reporting system for the Printavo Financial Dashboard with four production-ready reports, modular architecture, and extensive export capabilities.

## Overview

The Reports tab provides a unified hub for accessing all financial reports, including:

1. **AR Aging Report** - Outstanding invoices grouped by aging buckets
2. **Payments Report** - Payment history with filtering and date ranges
3. **Sales Summary Report** - Revenue trends over time with flexible grouping
4. **Customer Summary Report** - Customer-level financial metrics

## Architecture

### Layered Design

The reporting system follows a clean, modular architecture:

```
src/
├── components/
│   ├── ReportsTab.tsx              # Main reports hub
│   ├── AgingReport.tsx             # AR Aging report
│   ├── PaymentsExplorer.tsx        # Payments report
│   ├── SalesSummaryReport.tsx      # Sales/revenue summary
│   └── CustomerSummaryReport.tsx   # Customer metrics
├── utils/
│   ├── report-service.ts           # Report business logic
│   ├── date-ranges.ts              # Date range utilities
│   ├── csv-export.ts               # CSV export functionality
│   ├── pdf-export.ts               # PDF export functionality
│   ├── aging-calculations.ts       # Aging bucket calculations
│   └── financial-aggregations.ts   # Financial aggregations
└── types/
    └── printavo.ts                 # Type definitions
```

### Key Principles

- **Separation of Concerns**: Data fetching, business logic, and UI are clearly separated
- **Reusability**: Common components and utilities are shared across reports
- **Type Safety**: Full TypeScript coverage with strict types
- **Production Ready**: Error handling, loading states, and edge cases handled

## Reports

### 1. AR Aging Report

**Purpose**: Shows outstanding invoices grouped into aging buckets.

**Features**:
- Aging buckets: 0-30, 31-60, 61-90, 90+ days
- Visual chart showing distribution
- Expandable buckets to view individual invoices
- Links to Printavo for each invoice
- Export to CSV and PDF

**Data Source**: Open invoices from Printavo API

**Location**: `src/components/AgingReport.tsx`

### 2. Payments Report

**Purpose**: Shows all payments received with filtering and analysis.

**Features**:
- Date range filtering (presets + custom)
- Search by customer or invoice
- Sort by date or amount
- Payment totals and summaries
- Export to CSV and PDF

**Data Source**: Payment transactions from Printavo API

**Location**: `src/components/PaymentsExplorer.tsx`

### 3. Sales Summary Report

**Purpose**: Summarizes sales and revenue over time.

**Features**:
- Date range filtering
- Grouping by day, week, or month
- Visual charts (bar or line)
- Summary metrics:
  - Total invoiced
  - Total paid
  - Total outstanding
  - Invoice count
- Detailed period-by-period breakdown
- Export to CSV and PDF

**Data Source**: Invoices from Printavo API

**Location**: `src/components/SalesSummaryReport.tsx`

### 4. Customer Summary Report

**Purpose**: Shows customer-level financial metrics.

**Features**:
- Date range filtering
- Search customers
- Sort by multiple fields:
  - Customer name
  - Total revenue
  - Total outstanding
  - Last invoice date
  - Invoice count
- Summary metrics for all customers
- Detailed customer table
- Export to CSV and PDF

**Data Source**: Invoices aggregated by customer

**Location**: `src/components/CustomerSummaryReport.tsx`

## Date Range System

All reports use a unified date range system with presets and custom ranges.

### Available Presets

```typescript
- 'today'          // Current day
- 'last-5-days'    // Last 5 days
- 'this-week'      // Current week (Monday to Sunday)
- 'last-week'      // Previous week
- 'this-month'     // Current month
- 'last-month'     // Previous month
- 'this-year'      // Current year
- 'last-year'      // Previous year
- 'custom'         // User-defined range
```

### Implementation

Date range utilities are centralized in `src/utils/date-ranges.ts`:

```typescript
import { getDateRangeForPreset, DateRangePreset } from '../utils/date-ranges';

const dateRange = getDateRangeForPreset('this-month');
// Returns: { startDate: Date, endDate: Date }
```

## Export System

### CSV Export

All reports support CSV export with:
- Custom column definitions
- Data formatting (currency, dates)
- Automatic filename generation
- Browser download

**Usage**:
```typescript
import { exportToCSV, CSVColumn } from '../utils/csv-export';

const columns: CSVColumn[] = [
  { header: 'Customer', key: 'customer' },
  { header: 'Amount', key: 'amount', formatter: (val) => `$${val.toFixed(2)}` }
];

exportToCSV(data, columns, 'report-name');
```

**Location**: `src/utils/csv-export.ts`

### PDF Export

All reports support PDF export with:
- Custom table layouts
- Headers and subtitles
- Page orientation (portrait/landscape)
- Automatic formatting
- Professional styling

**Usage**:
```typescript
import { exportToPDF, PDFColumn } from '../utils/pdf-export';

exportToPDF({
  title: 'Report Title',
  subtitle: 'Report details and date range',
  filename: 'report-name',
  columns: [
    { header: 'Customer', dataKey: 'customer' },
    { header: 'Amount', dataKey: 'amount', formatter: (val) => `$${val.toFixed(2)}` }
  ],
  data: reportData,
  orientation: 'landscape'
});
```

**Location**: `src/utils/pdf-export.ts`

**Library Used**: jsPDF with jspdf-autotable

## Service Layer

The service layer (`src/utils/report-service.ts`) provides reusable business logic functions:

### Core Functions

#### `filterInvoicesByDateRange()`
Filters invoices by date range.

#### `filterPaymentsByDateRange()`
Filters payments by date range.

#### `buildARAgingReport()`
Builds AR aging buckets from invoices.

#### `buildPaymentsReport()`
Builds payment report data with metrics.

#### `buildCustomerSummaryReport()`
Aggregates invoices by customer with metrics.

#### `calculatePaymentMethodBreakdown()`
Groups payments by payment method.

#### `calculateInvoiceStatusBreakdown()`
Categorizes invoices by status (paid, partial, unpaid, overdue).

### Example Usage

```typescript
import { buildCustomerSummaryReport } from '../utils/report-service';

const dateRange = {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
};

const customerMetrics = buildCustomerSummaryReport(invoices, dateRange);
```

## Adding New Reports

To add a new report to the system:

### 1. Create Report Component

Create a new file in `src/components/`:

```typescript
import { useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { exportToCSV } from '../utils/csv-export';
import { exportToPDF } from '../utils/pdf-export';
import { DateRangePreset, getDateRangeForPreset } from '../utils/date-ranges';

interface MyReportProps {
  invoices: Invoice[];
}

export function MyReport({ invoices }: MyReportProps) {
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');

  const dateRange = useMemo(() => {
    return getDateRangeForPreset(dateRangePreset);
  }, [dateRangePreset]);

  // Report logic here...

  return (
    <div className="space-y-6">
      {/* Report UI here */}
    </div>
  );
}
```

### 2. Add to ReportsTab

Update `src/components/ReportsTab.tsx`:

```typescript
import { MyReport } from './MyReport';

// Add to reports array:
{
  id: 'my-report' as ReportType,
  name: 'My Report',
  description: 'Description of what the report shows',
  icon: MyIcon,
  color: 'blue',
}

// Add to renderReport():
case 'my-report':
  return <MyReport invoices={invoices} />;
```

### 3. Add Service Functions

If needed, add business logic to `src/utils/report-service.ts`:

```typescript
export function buildMyReport(invoices: Invoice[], dateRange: DateRange) {
  // Report calculation logic
  return reportData;
}
```

## Common Patterns

### Date Range Filtering

```typescript
const dateRange = useMemo(() => {
  if (dateRangePreset === 'custom' && customStartDate && customEndDate) {
    return {
      startDate: new Date(customStartDate),
      endDate: new Date(customEndDate)
    };
  }
  return getDateRangeForPreset(dateRangePreset);
}, [dateRangePreset, customStartDate, customEndDate]);
```

### Export Buttons

```typescript
<div className="flex items-center gap-3">
  <button
    onClick={handleExportCSV}
    disabled={data.length === 0}
    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
  >
    <FileDown className="w-4 h-4" />
    <span className="font-medium">Export CSV</span>
  </button>
  <button
    onClick={handleExportPDF}
    disabled={data.length === 0}
    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
  >
    <FileDown className="w-4 h-4" />
    <span className="font-medium">Export PDF</span>
  </button>
</div>
```

### Summary Cards

```typescript
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-100 rounded-lg">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <div>
        <p className="text-sm text-blue-600 font-medium">Metric Label</p>
        <p className="text-2xl font-bold text-blue-900">
          {value}
        </p>
      </div>
    </div>
  </div>
</div>
```

## Performance Considerations

### Memoization

All reports use `useMemo` for expensive calculations:

```typescript
const reportData = useMemo(() => {
  // Expensive calculation
  return calculateReport(invoices, filters);
}, [invoices, filters]);
```

### Filtering

Filtering is done in JavaScript after data is loaded. For large datasets (10,000+ records), consider:
- Server-side filtering
- Pagination
- Virtual scrolling

### Charts

Charts use Recharts with responsive containers. For better performance:
- Limit data points (aggregate if needed)
- Use memoization for chart data
- Consider sampling for very large datasets

## Styling Guidelines

All reports follow consistent styling:

- **Colors**: Blue (primary), Green (positive/paid), Red (negative/outstanding), Gray (neutral)
- **Spacing**: Consistent padding and margins using Tailwind's spacing scale
- **Typography**: Clear hierarchy with font weights and sizes
- **Borders**: Subtle borders for separation (gray-200)
- **Shadows**: Soft shadows for depth (shadow-sm)
- **Hover States**: All interactive elements have hover states
- **Disabled States**: Properly styled disabled states with reduced opacity

## Error Handling

Reports handle common error scenarios:

1. **No Data**: Clear empty states with helpful messages
2. **Loading States**: Loading indicators during data fetch
3. **Invalid Dates**: Validation for custom date ranges
4. **Export Errors**: Try-catch blocks around export functions

## Testing Recommendations

When testing reports:

1. **Empty Data**: Test with zero invoices/payments
2. **Large Datasets**: Test with 1,000+ records
3. **Date Ranges**: Test all preset ranges
4. **Edge Cases**: Test with negative amounts, null values
5. **Exports**: Verify CSV and PDF output formatting
6. **Responsive**: Test on mobile, tablet, desktop

## Future Enhancements

Potential additions to the reporting system:

1. **Scheduled Reports**: Email reports on a schedule
2. **Report Templates**: Save custom report configurations
3. **Comparative Analysis**: Year-over-year, month-over-month
4. **Forecasting**: Predict future revenue based on trends
5. **Custom Filters**: More advanced filtering options
6. **Dashboard Widgets**: Mini-reports on main dashboard
7. **Excel Export**: .xlsx format with formatting
8. **Print View**: Optimized print layouts
9. **Saved Views**: Save and load report configurations
10. **API Endpoints**: Expose reports via REST API

## Support

For questions or issues:
1. Check this documentation
2. Review component source code
3. Check type definitions in `src/types/printavo.ts`
4. Refer to utility function documentation in source files

---

**Built with**: React, TypeScript, Tailwind CSS, Recharts, jsPDF
**Last Updated**: 2024-12-31
