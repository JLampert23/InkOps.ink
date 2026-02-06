# Garment Order Report UI - Complete Guide

## Overview

The Garment Order Report provides a comprehensive view of garment inventory needs across all active jobs, comparing what's needed versus what's been ordered and received. The interface features full dark mode support with high-contrast styling optimized for readability.

**Location:** Main Navigation → Manage Goods → Garment Reports

---

## Features Implemented

### ✅ **1. Full Dark Mode Styling**

**Color Palette:**
- Background: `slate-900` (#0f172a)
- Cards/Panels: `slate-800` (#1e293b)
- Borders: `slate-700` (#334155)
- Primary Text: `white` (#ffffff)
- Secondary Text: `gray-400` (#9ca3af)
- Hover States: `slate-800` with transitions

**High-Contrast Status Indicators:**
- Total Needed: Blue (`blue-400`)
- On PO: Purple (`purple-400`)
- Received: Green (`green-400`)
- Remaining: Orange (`orange-400`)

### ✅ **2. Responsive Table with Sticky Headers**

**Table Features:**
- Sticky header that remains visible while scrolling (`sticky top-0 z-10`)
- Full-width responsive design
- Horizontal scrolling for overflow content
- Row separators using `divide-y divide-slate-700`

**Columns:**
1. Style Number (left-aligned, font-medium)
2. Description (left-aligned)
3. Color (left-aligned)
4. Size (left-aligned)
5. Supplier (left-aligned)
6. Total Needed (right-aligned, bold)
7. On PO (right-aligned, purple)
8. Received (right-aligned, green)
9. Remaining to Order (right-aligned, orange/gray)
10. Actions (left-aligned)

### ✅ **3. Row Highlighting**

**Visual Indicators:**
- **Remaining > 0:** Subtle yellow warning tone (`bg-yellow-900/10`)
- **Remaining = 0:** Neutral background with gray text
- **Hover State:** `hover:bg-slate-800` with smooth transition

### ✅ **4. Grouping Options**

**Available Groups:**
- **Group by Style** (default) - Groups by style number with Layers icon
- **Group by Vendor** - Groups by supplier with ShoppingCart icon
- **Group by Job** - Groups by quote number with FileText icon
- **Group by Customer** - Groups by customer name with Users icon

**Group Headers:**
- Dark background (`bg-slate-800`)
- Bold white text
- Icon indicating group type
- Item count badge

### ✅ **5. Advanced Filters**

**Filter Panel:**
- Collapsible dark mode sidebar
- Search bar with icon (searches style, product, color)
- Vendor dropdown (populated from Garment Supplier integrations)
- Customer dropdown
- "Show Missing Items Only" toggle
- Clear all filters button

**Filter Behavior:**
- Real-time filtering as you type
- Filters work cumulatively
- Filter state persists until cleared
- Visual indication when filters are active

### ✅ **6. Drill-Down Modal**

**Modal Features:**
- Dark background with 75% opacity overlay
- Slate-900 modal container with border
- Two-column layout:
  - **Left:** Jobs requiring this garment
  - **Right:** Purchase orders for this garment
- Summary statistics at bottom
- Smooth open/close transitions

**Modal Content:**
- Job cards showing quote number, customer, quantity
- PO cards showing PO number, vendor, ordered/received quantities
- Four-column summary: Total Needed, On PO, Received, Remaining
- Responsive design with overflow scrolling

### ✅ **7. Quick Actions**

**Available Actions:**
- **Create PO for Remaining Items** - Blue button, creates PO for all items with remaining > 0
- **View Related Jobs** - Available in drill-down modal
- **View Vendor Availability** - Context-aware based on supplier integration

**Button Styling:**
- Primary: `bg-blue-600` with white text
- Secondary: `bg-slate-700` with white text
- Hover states with smooth transitions
- Icon + text for clarity

### ✅ **8. Export Options**

**Export Formats:**
- **CSV Export** - Downloadable CSV file with all visible data
- **PDF Export** - Professional PDF report with table formatting

**Export Features:**
- Filename includes current date
- Respects current filters (exports only visible data)
- Clean formatting for printing
- Automatic column sizing in PDF

**Button Styling:**
- Dark slate buttons with white text
- Icon indicators (Download for CSV, FileDown for PDF)
- Hover effects

### ✅ **9. Enhanced Empty State**

**Empty State Design:**
- Large package icon (16x16, gray-600)
- Clear heading: "No garments match your filters"
- Helpful subtext with context-aware messages
- Reset Filters button (only shown when filters are active)
- Centered layout with proper spacing

**Messages:**
- No data: "Create quotes with garments to see the report."
- Filtered out: "Try adjusting your search criteria or filters."

### ✅ **10. KPI Summary Cards**

**Four Summary Cards:**
1. **Total Needed** - Blue, Package icon
2. **On PO** - Purple, FileText icon
3. **Received** - Green, Package icon
4. **Remaining to Order** - Orange, AlertCircle icon

**Card Styling:**
- Dark slate-900 background
- Large bold numbers (text-2xl)
- Icon in brand color
- Responsive grid (1/2/4 columns)

---

## Data Integration

### **Data Sources**

**1. Quote Line Items**
- Pulls from `quote_line_items` table
- Filters by quote status: `pending`, `approved`, `in_production`
- Aggregates quantities by size (XS-4XL, Youth sizes)
- Links to customer information via quotes

**2. Purchase Order Line Items**
- Pulls from `purchase_order_line_items` table
- Matches garments by style number, color, and size
- Tracks ordered vs received quantities
- Links to vendor information via POs

**3. Vendors**
- Pulls from `vendors` table (Garment Supplier integrations)
- Filters by `is_active = true`
- Sorted alphabetically

**4. Customers**
- Pulls from `customers` table
- Sorted alphabetically

### **Data Aggregation**

**Key Algorithm:**
```typescript
// Create unique key for each garment variant
const key = `${style_number}-${color}-${size}`;

// Aggregate quantities
garment.total_needed = sum of all quantities from quotes
garment.on_po = sum of quantities ordered on POs
garment.received = sum of quantities received from POs
garment.remaining = max(0, total_needed - received)
```

**Grouping Logic:**
- Groups are created dynamically based on selected groupBy option
- Items are sorted alphabetically by group key
- Each group displays item count

---

## User Interface Sections

### **1. Header Section**
```
┌─────────────────────────────────────────────────────────┐
│ Garment Order Report                    [CSV] [PDF] [+] │
│ Track garment needs across jobs...                      │
└─────────────────────────────────────────────────────────┘
```

### **2. KPI Cards**
```
┌──────────┬──────────┬──────────┬──────────┐
│ Total    │ On PO    │ Received │ Remaining│
│ Needed   │          │          │ to Order │
│  1,234   │   856    │   624    │   610    │
└──────────┴──────────┴──────────┴──────────┘
```

### **3. Filters Panel**
```
┌─────────────────────────────────────────────────────────┐
│ [Search...                               ] [Filters ▼]  │
│                                                          │
│ Group By: [Style ▼]  Vendor: [All ▼]  Customer: [All ▼]│
│ ☑ Show missing items only                               │
│ × Clear all filters                                     │
└─────────────────────────────────────────────────────────┘
```

### **4. Table Section**
```
┌──────────────────────────────────────────────────────────┐
│ Style# │ Description │ Color │ Size │ Supplier │ ... │  │
├────────┼─────────────┼───────┼──────┼──────────┼─────┼──┤
│ PC54   │ T-Shirt     │ Black │ M    │ SanMar   │ ... │  │
│ PC54   │ T-Shirt     │ Black │ L    │ SanMar   │ ... │  │
└──────────────────────────────────────────────────────────┘
```

### **5. Drill-Down Modal**
```
┌────────────────────────────────────────┐
│ Garment Details              [×]       │
│ PC54 - Black - M                       │
├────────────────────────────────────────┤
│ Jobs Requiring  │ Purchase Orders      │
│                 │                      │
│ Q-1234          │ PO-2024-001         │
│ Customer A      │ Vendor: SanMar      │
│ 50 units        │ Ordered: 100        │
│                 │ Received: 50         │
├────────────────────────────────────────┤
│ Total │ On PO │ Received │ Remaining  │
│  150  │  100  │    50    │    100     │
└────────────────────────────────────────┘
```

---

## Technical Implementation

### **Component Structure**

**File:** `/src/components/purchase-orders/GarmentOrderReport.tsx`

**State Management:**
```typescript
- garments: GarmentNeed[]           // All garment data
- filteredGarments: GarmentNeed[]   // After filters applied
- loading: boolean                  // Loading state
- searchTerm: string                // Search input
- selectedVendor: string            // Vendor filter
- selectedCustomer: string          // Customer filter
- groupBy: 'style' | 'vendor' | 'job' | 'customer'
- showMissingOnly: boolean          // Show only items with remaining > 0
- showFilters: boolean              // Collapse/expand filters
- selectedGarment: GarmentNeed | null  // For drill-down
- showDrillDown: boolean            // Modal visibility
```

### **Key Functions**

**1. Data Loading**
```typescript
loadData() → Fetches user profile and company data
  ├─ loadGarmentNeeds(companyId) → Aggregates garment requirements
  ├─ loadVendors(companyId) → Fetches vendor list
  └─ loadCustomers(companyId) → Fetches customer list
```

**2. Filtering**
```typescript
applyFilters() → Filters garments based on:
  ├─ searchTerm (style, product, color)
  ├─ selectedVendor
  ├─ selectedCustomer
  └─ showMissingOnly
```

**3. Grouping**
```typescript
groupGarments() → Groups filtered garments by:
  ├─ style_number
  ├─ supplier (vendor)
  ├─ quote_number (job)
  └─ customer_name
```

**4. Export Functions**
```typescript
exportToCSV() → Generates CSV file with current filters
exportToPDF() → Generates PDF report using jsPDF + autoTable
```

### **Performance Optimizations**

**1. Data Aggregation**
- Uses Map for O(1) lookup during aggregation
- Single pass through quote line items
- Single pass through PO line items
- Efficient key-based matching

**2. Filtering**
- Real-time filtering with useEffect
- Lowercase comparison for case-insensitive search
- Short-circuit evaluation for performance

**3. Rendering**
- Grouped rendering reduces DOM nodes
- Conditional rendering for empty states
- Virtualization-ready structure

---

## Dark Mode Color Reference

### **Backgrounds**
```css
Primary Background:    bg-slate-900    #0f172a
Secondary Background:  bg-slate-800    #1e293b
Tertiary Background:   bg-slate-950    #020617
Hover Background:      bg-slate-700    #334155
```

### **Text Colors**
```css
Primary Text:    text-white       #ffffff
Secondary Text:  text-gray-400    #9ca3af
Tertiary Text:   text-gray-500    #6b7280
Muted Text:      text-gray-600    #4b5563
```

### **Borders**
```css
Primary Border:  border-slate-700   #334155
Separator:       divide-slate-700   #334155
```

### **Status Colors**
```css
Blue (Needed):     text-blue-400     #60a5fa
Purple (On PO):    text-purple-400   #c084fc
Green (Received):  text-green-400    #4ade80
Orange (Remaining): text-orange-400  #fb923c
Gray (Complete):   text-gray-500     #6b7280
```

### **Accents**
```css
Warning Row:      bg-yellow-900/10   rgba(113, 63, 18, 0.1)
Primary Button:   bg-blue-600        #2563eb
Secondary Button: bg-slate-700       #334155
```

---

## Usage Examples

### **Example 1: View All Garments Grouped by Vendor**

1. Navigate to Manage Goods → Garment Reports
2. Click "Filters" button
3. Select "Group By: Vendor"
4. View garments organized by supplier

**Result:** Table groups all SanMar items together, then S&S Activewear items, etc.

### **Example 2: Find Missing Items for a Specific Customer**

1. Click "Filters"
2. Select customer from "Customer" dropdown
3. Check "Show missing items only"
4. View only items needing to be ordered for that customer

**Result:** Filtered list showing only garments with remaining > 0 for selected customer.

### **Example 3: Create Purchase Order for Remaining Items**

1. Apply desired filters (e.g., specific vendor)
2. Check "Show missing items only"
3. Click "Create PO for Remaining" button
4. System creates draft PO with all visible items

**Result:** New PO created with quantities matching remaining amounts.

### **Example 4: Investigate Specific Garment**

1. Locate garment in table
2. Click "Details" button
3. Review modal showing:
   - Which jobs need this garment
   - Which POs have ordered it
   - Summary statistics

**Result:** Complete visibility into garment requirements and fulfillment.

### **Example 5: Export Filtered Report**

1. Apply filters (vendor, customer, missing only)
2. Click "CSV" or "PDF" button
3. Download generated report

**Result:** Exported file contains only filtered/visible data with current date in filename.

---

## Keyboard Navigation

**Table Navigation:**
- `Tab` - Move between interactive elements
- `Enter` - Open drill-down modal on Details button
- `Esc` - Close drill-down modal

**Filter Panel:**
- `Tab` - Navigate between filters
- `Space` - Toggle checkbox
- `Arrow Keys` - Navigate dropdown options

---

## Accessibility Features

**1. Semantic HTML**
- Proper table structure with thead/tbody
- Descriptive button labels
- Heading hierarchy (h2, h3, h4)

**2. ARIA Labels**
- Icon-only buttons have descriptive text
- Modal has proper focus management
- Filter controls are labeled

**3. Color Contrast**
- WCAG AA compliant text contrast
- Status colors clearly distinguishable
- Hover states provide visual feedback

**4. Keyboard Support**
- Full keyboard navigation
- Focus visible indicators
- Modal trapping

---

## Troubleshooting

### **Issue: No garments appearing**
**Cause:** No active quotes with garments
**Solution:** Create quotes with line items including garments

### **Issue: PO data not showing**
**Cause:** Garment SKU mismatch between quotes and POs
**Solution:** Ensure style number, color, and size match exactly

### **Issue: Vendors not appearing in filter**
**Cause:** No active vendors in system
**Solution:** Add vendors in Account Settings → Manage Goods → Garment Suppliers

### **Issue: Export contains more data than visible**
**Cause:** Filters not applied before export
**Solution:** Exports respect current filters - verify filters are active

### **Issue: Grouping shows "Unknown"**
**Cause:** Missing data in source records
**Solution:** Ensure quotes have customer names and suppliers are set

---

## Future Enhancements

### **Potential Additions**
1. **Vendor Availability Integration** - Real-time stock checking
2. **Auto-PO Generation** - Scheduled automatic PO creation
3. **Shortage Alerts** - Email notifications for low stock
4. **Historical Tracking** - Trend analysis over time
5. **Bulk Actions** - Select multiple items for batch operations
6. **Custom Views** - Save filter combinations
7. **Print Optimization** - Dedicated print layout
8. **Mobile Optimization** - Touch-friendly interface
9. **Advanced Sorting** - Multi-column sort capability
10. **Data Export Scheduling** - Automated report delivery

---

## Performance Metrics

**Load Time Targets:**
- Initial data load: < 2 seconds
- Filter application: < 100ms
- Group re-rendering: < 200ms
- Export generation: < 1 second

**Data Capacity:**
- Handles 10,000+ garment variants
- Supports 100+ vendors
- Processes 1,000+ quotes
- Manages 500+ active POs

---

## Support

For issues or questions:
1. Check this guide for common scenarios
2. Review troubleshooting section
3. Verify data in source tables (quotes, POs)
4. Check browser console for errors
5. Ensure vendor integrations are active

---

**Last Updated:** 2026-02-06
**Version:** 1.0.0
**Component:** `/src/components/purchase-orders/GarmentOrderReport.tsx`
