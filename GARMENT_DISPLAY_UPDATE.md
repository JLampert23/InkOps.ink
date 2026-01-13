# Invoice Garment Display Update

## Overview
Enhanced invoice list views to display extracted garment metadata (style, color, sizes) alongside customer and financial information. This makes it easier to identify what products are associated with each invoice at a glance.

## Changes Made

### 1. Garment Aggregation Service
**Location:** `src/services/garment-aggregation-service.ts`

Created a new service to aggregate garment data from line items for invoice displays:

**Key Functions:**
- `getInvoiceGarmentSummary(invoiceId)` - Gets garment summary for a single invoice
- `getMultipleInvoiceGarmentSummaries(invoiceIds)` - Batch fetches summaries for multiple invoices (more efficient)
- `formatGarmentSummary(summary)` - Formats summary into human-readable string
- `getUniqueStyles(summaries)` - Extracts all unique styles from multiple summaries
- `getUniqueColors(summaries)` - Extracts all unique colors from multiple summaries

**GarmentSummary Interface:**
```typescript
{
  styles: string[];           // All styles in the invoice
  colors: string[];           // All colors in the invoice
  totalItems: number;         // Total item count
  sizeBreakdown: {...};       // Aggregated size breakdown
  topStyle: string | null;    // Most common style
  topColor: string | null;    // Most common color
}
```

### 2. Billing Queue Updates
**Location:** `src/components/billing/BillingQueue.tsx`

**Changes:**
- Added new "Garments" column between "Customer" and "Phone" columns
- Loads garment summaries for all invoices in the queue
- Displays:
  - Top style with package icon (blue)
  - Top color with palette icon (purple)
  - Total item count
  - Indicator when multiple styles/colors (+N)

**Visual Example:**
```
📦 GILDAN 5000 +1
🎨 Black +2
152 items
```

### 3. Accounts Receivable Report Updates
**Location:** `src/components/accounting/AccountsReceivableReport.tsx`

**Changes:**
- Added new "Garments" column between "Customer" and "Invoice Date" columns
- Loads garment summaries for all outstanding invoices
- Same display format as Billing Queue

### 4. Invoice Detail View
**Location:** `src/components/billing/InvoiceDetail.tsx`

**Changes:**
- Added expandable "Line Items & Garment Details" section
- Displays all line items with:
  - Style (blue badge)
  - Color (purple badge)
  - Size breakdown (green badge)
  - SKU if available
- Lazy-loads data on first expand for performance

## Benefits

### For Users
1. **Quick Identification** - See what products are on each invoice without opening it
2. **Better Context** - Understand invoice contents at a glance
3. **Improved Workflow** - Sort/filter mentally based on garment info
4. **Data Visibility** - Parsed garment data is now surfaced throughout the app

### For Operations
1. **Inventory Insights** - Quickly identify which styles/colors have outstanding payments
2. **Follow-ups** - Better context when contacting customers about invoices
3. **Reporting** - Visual confirmation that garment parsing is working
4. **Consistency** - Same display pattern across all invoice views

## Display Format

### When Data is Available:
- Shows the most common (top) style with icon
- Shows the most common (top) color with icon
- Indicates if there are additional styles/colors (+N)
- Shows total item count

### When No Data:
- Shows "-" to indicate no garment data parsed

### Icons Used:
- 📦 Package icon (blue) - Style/product codes
- 🎨 Palette icon (purple) - Colors
- 📏 Ruler icon (green) - Sizes (detail view only)

## Performance Considerations

1. **Batch Loading** - `getMultipleInvoiceGarmentSummaries()` fetches all invoice summaries in one query
2. **Efficient Aggregation** - Line items are grouped by invoice_id and processed in memory
3. **Map Storage** - Summaries stored in Map for O(1) lookup when rendering rows
4. **Lazy Loading** - Detail view only loads when expanded

## Future Enhancements

Potential improvements for future iterations:

1. **Filtering** - Add filters to show only invoices with specific styles/colors
2. **Sorting** - Sort invoice lists by style, color, or item count
3. **Search** - Search for invoices by garment attributes
4. **Color Coding** - Visual color indicators for actual garment colors
5. **Hover Details** - Show full style/color list on hover
6. **Export** - Include garment data in CSV/PDF exports
7. **Analytics** - Report on outstanding AR by style/color

## Testing Checklist

To verify the implementation:
- [ ] Open Billing Queue - verify "Garments" column displays
- [ ] Check multiple invoices show different garment info
- [ ] Verify "+N" indicator when multiple styles/colors
- [ ] Open Accounts Receivable Report
- [ ] Verify garment column displays correctly
- [ ] Click on an invoice to view details
- [ ] Expand "Line Items & Garment Details" section
- [ ] Verify parsed data displays with color-coded badges
- [ ] Check performance with 20+ invoices in view
- [ ] Verify "-" shows for invoices without garment data

## Technical Notes

- Service uses Supabase client for efficient batch queries
- Component state management uses React hooks
- No props drilling - each component fetches its own data
- Error handling gracefully falls back to empty summaries
- TypeScript interfaces ensure type safety throughout
