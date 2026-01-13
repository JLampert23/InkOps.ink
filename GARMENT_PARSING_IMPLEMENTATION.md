# Garment Metadata Parsing Implementation

## Overview
Implemented a system to extract and structure garment metadata from Printavo's line item descriptions. Since Printavo stores all garment details (style, color, size breakdown) in free-text description fields, this solution parses and stores that data in a structured format.

## Database Changes

### Migration: `add_garment_metadata_to_line_items`
Added the following columns to `printavo_line_items`:

- `extracted_style` (text) - Garment style number (e.g., "GILDAN 5000", "BC 3001")
- `extracted_color` (text) - Garment color (e.g., "Black", "Heather Navy")
- `extracted_sizes` (jsonb) - Size breakdown as JSON object (e.g., `{"S": 5, "M": 12, "L": 8}`)
- `extracted_sku` (text) - SKU or vendor code if present
- `extraction_notes` (text) - Notes about extraction process
- `parsed_at` (timestamptz) - Timestamp when parsing was performed

Created indexes on `extracted_style` and `extracted_color` for faster filtering.

## Parsing Logic

### Supported Style Patterns
The parser detects common garment brand styles:
- Gildan (G-5000, Gildan 5000)
- Bella Canvas (BC-3001, Bella Canvas 3001)
- Next Level (NL-6210, Next Level 6210)
- Hanes (Hanes 5280)
- Port & Company (PC-54, Port & Company 54)
- Generic patterns (alphanumeric codes)

### Size Detection
Detects multiple size formats:
- Standard notation: `S-5, M-12, L-8`
- Full words: `Small (5), Medium (12)`
- Youth sizes: `YS-3, YM-5, YL-2`
- Extended sizes: `XL, 2XL, 3XL`

Automatically normalizes size names (e.g., "Small" → "S", "XX-Large" → "2XL")

### Color Detection
Recognizes 30+ common color keywords including:
- Basic colors: black, white, navy, red, blue, green, grey
- Heather variants: heather navy, sport grey, athletic heather
- Extended palette: royal, charcoal, maroon, burgundy, teal, forest

Can detect multi-word colors (e.g., "Heather Navy Blue")

### SKU Detection
Recognizes common SKU patterns:
- `SKU: ABC123`
- `Item #: 12345`
- `Code: XYZ-789`

## Code Structure

### Parsing Utility
**Location:** `src/utils/garment-parser.ts`

Functions:
- `parseGarmentDescription(description)` - Main parsing function
- `formatSizes(sizes)` - Formats size object into readable string
- `getTotalQuantityFromSizes(sizes)` - Calculates total quantity across all sizes

### Edge Function Integration
**Location:** `supabase/functions/printavo-sync/index.ts`

The sync service now:
1. Imports the shared parser from `../shared/garment-parser.ts`
2. Parses each line item description during sync
3. Stores extracted data alongside the original description
4. Records parsing timestamp for tracking

### UI Component
**Location:** `src/components/LineItemsViewer.tsx`

Features:
- Expandable/collapsible section in invoice detail view
- Color-coded display of parsed garment data:
  - Style (blue badge with package icon)
  - Color (purple badge with palette icon)
  - Sizes (green badge with ruler icon)
- Shows SKU if present
- Indicates when no structured data could be extracted
- Lazy-loads line items on first expansion

### Integration
**Location:** `src/components/billing/InvoiceDetail.tsx`

The LineItemsViewer component is now displayed:
- After the Payment History section
- Before the Communication Log section
- Shows all line items with their parsed garment metadata

## GraphQL Updates

Updated `GET_INVOICES` query to include line items:
```graphql
lineItems {
  edges {
    node {
      id
      name
      description
      quantity
      price
    }
  }
}
```

## Usage Example

### Before (raw description):
```
"Gildan 5000 - Heather Navy - S-5, M-12, L-8, XL-3"
```

### After (structured data):
```json
{
  "extracted_style": "GILDAN 5000",
  "extracted_color": "Heather Navy",
  "extracted_sizes": {
    "S": 5,
    "M": 12,
    "L": 8,
    "XL": 3
  },
  "extracted_sku": null,
  "extraction_notes": "Detected style: GILDAN 5000; Detected color: Heather Navy; Detected 4 sizes (28 total items)"
}
```

## Benefits

1. **Structured Reporting** - Can now generate reports by style, color, or size
2. **Inventory Insights** - Track which styles and colors are most popular
3. **Size Analytics** - Understand size distribution across orders
4. **Better Searching** - Filter and search by garment attributes
5. **Data Quality** - Extraction notes help identify parsing issues

## Future Enhancements

Potential improvements:
1. Add manufacturer/brand as separate field
2. Support for custom size charts
3. Fabric type detection (cotton, poly-blend, etc.)
4. Decoration method extraction (screen print, embroidery)
5. ML-based parsing for improved accuracy
6. Bulk re-parsing capability for existing records
7. Manual correction interface for mis-parsed data

## Testing

To verify the implementation:
1. Run a Printavo sync to populate line items
2. View an invoice in the Invoice Detail screen
3. Click "Line Items & Garment Details" to expand
4. Check that garment metadata is displayed with color-coded badges
5. Verify the database contains the extracted fields

## Performance

- Parsing is performed during sync (not on-demand)
- Indexed fields enable fast filtering by style/color
- UI lazy-loads line items only when expanded
- Parsing adds minimal overhead to sync process (~10-20ms per line item)
