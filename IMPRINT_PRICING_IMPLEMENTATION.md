# Imprint-Based Pricing System Implementation

## Overview
Implemented a comprehensive pricing system where line item unit prices are calculated as the sum of all imprint prices. All items in a line item group share the same unit_price, and each imprint's price is based on the total quantity of garments in the group.

## Pricing Rules

### 1. Unit Price = SUM of All Imprint Prices
Each line item's `unit_price` is calculated as the sum of all associated imprint prices.

**Example:**
- Front imprint: $1.68
- Back imprint: $1.68
- **Total unit_price: $3.36**

### 2. Group-Based Pricing
- All items in the same line item group receive the **same unit_price**
- Imprint prices are calculated using the **total quantity of garments in the group**, not individual line item quantities
- Example: If a group has 170 total garments across multiple sizes, the pricing lookup uses 170 qty

### 3. Multi-Color Support
Each imprint can have multiple colors, affecting the price matrix lookup.

**Example:**
- Front (2 colors) = $2.13
- Back (1 color) = $1.68
- **Total unit_price: $3.81**

## Database Changes

### New Columns
- `quote_imprints.price` - Stores the calculated price for each imprint
- `quote_imprints.num_colors` - Number of colors for the imprint (used for price matrix lookup)

### New Functions

#### `get_group_total_quantity(p_quote_id uuid, p_group_label text)`
Returns the total quantity of garments in a line item group by summing all size columns.

#### `calculate_imprint_price(p_imprint_id uuid)`
Calculates the price for a single imprint based on:
1. Group total quantity
2. Number of colors (from `num_colors` or extracted from `pricing_matrix_column`)
3. Price matrix lookup (matrix_id → rows/columns → cell value)

**Price Matrix Lookup Logic:**
- **Row determination:** Based on quantity ranges (e.g., "1-11", "12-23", "99+")
- **Column determination:** Based on number of colors or specific column name
- **Cell lookup:** Uses `row_index,col_index` format to find price in cells JSONB

#### `calculate_line_item_unit_price(p_line_item_id uuid)`
Returns the sum of all imprint prices for a line item's group.

#### `propagate_group_unit_price(p_quote_id uuid, p_group_label text)`
Applies the calculated unit_price to all items in a group and recalculates total_price for each item.

#### `recalculate_quote_pricing(p_quote_id uuid)`
Master function that:
1. Recalculates all imprint prices
2. Propagates unit prices to all groups
3. Updates quote subtotal

### Triggers

#### On Imprint Changes
```sql
CREATE TRIGGER recalculate_pricing_on_imprint_change
  AFTER INSERT OR UPDATE OR DELETE ON quote_imprints
```
Automatically recalculates pricing when imprints are added, updated, or deleted.

#### On Line Item Changes
```sql
CREATE TRIGGER recalculate_pricing_on_line_item_change
  AFTER INSERT OR UPDATE OF [size columns] ON quote_line_items
```
Automatically recalculates pricing when line item quantities or group labels change.

## Frontend Changes

### ManageImprintsModal.tsx
Updated to support the new pricing system:

1. **Added `num_colors` tracking**
   - Extracted from `pricing_matrix_column` (e.g., "2 Color" → 2)
   - Updated when user selects a pricing column

2. **Display calculated prices**
   - Each imprint now shows its calculated price in a green badge
   - Format: `$X.XX`

3. **Automatic price updates**
   - Prices are calculated by database triggers
   - Frontend displays the calculated values after save

### Helper Function
```typescript
const extractNumColors = (columnName: string): number => {
  if (!columnName) return 1;
  const match = columnName.match(/(\d+)\s*color/i);
  return match ? parseInt(match[1]) : 1;
};
```

## Line Type Investigation

### Current Usage
The `line_type` field distinguishes between:
- **'item'** - Garment/product line items (actively used)
- **'fee'** - Setup fees, rush fees, etc. (actively used)
- **'imprint'** - DEPRECATED (no longer used)

### Findings
- The 'imprint' value was originally intended for decoration line items
- Now we use the separate `quote_imprints` table instead
- Code still filters for `line_type='imprint'` but nothing creates them

### Changes Made
- Removed 'imprint' from the CHECK constraint
- Updated constraint to: `CHECK (line_type IN ('item', 'fee'))`
- Kept 'item' and 'fee' values as they're actively used

## How Pricing Works

### Step-by-Step Example

**Setup:**
- Quote has 170 garments in a group
- 2 imprints: Front (1 color) and Back (1 color)
- Using "Screen Printing - No underbase" price matrix

**Process:**
1. **Calculate Imprint Prices:**
   - Look up group quantity: 170 garments
   - Look up row: "99+" (since 170 >= 99)
   - Look up column: "1 Color" (column index 0)
   - Price matrix cell: $1.68
   - Front imprint price: $1.68
   - Back imprint price: $1.68

2. **Calculate Unit Price:**
   - Sum all imprint prices: $1.68 + $1.68 = $3.36
   - unit_price = $3.36

3. **Propagate to Group:**
   - All line items in the group get unit_price = $3.36
   - Each line item's total_price = unit_price × quantity

4. **Update Quote:**
   - Quote subtotal = sum of all line item total_prices

### Automatic Recalculation
The system automatically recalculates when:
- Imprints are added, modified, or removed
- Line item quantities change
- Group labels change
- Price matrices are updated (manual recalculation needed)

## Testing

### Manual Test Steps

1. **Create a quote with line items**
   - Add line items to a group
   - Set quantities (e.g., 170 total)

2. **Add imprints to the group**
   - Open "Manage Imprints" modal
   - Add Front imprint with 1 color
   - Add Back imprint with 1 color
   - Select appropriate price matrix

3. **Verify pricing**
   - Check that each imprint shows calculated price
   - Verify line items have correct unit_price
   - Confirm all items in group have same unit_price

4. **Test recalculation**
   - Change quantity → prices should update
   - Add/remove imprint → prices should update
   - Change color count → prices should update

### SQL Test Query
```sql
-- View pricing for a specific quote
SELECT
  q.quote_number,
  qi.location,
  qi.num_colors,
  qi.price as imprint_price,
  qli.description,
  qli.unit_price,
  qli.total_price
FROM quotes q
JOIN quote_imprints qi ON qi.quote_id = q.id
JOIN quote_line_items qli ON qli.quote_id = q.id AND qli.group_label = qi.group_label
WHERE q.id = 'YOUR_QUOTE_ID'
ORDER BY qi.sort_order, qli.sort_order;
```

## Known Limitations

1. **Price matrix must be active**
   - Inactive price matrices won't be used for calculations
   - Returns $0 if matrix not found

2. **Group label is required**
   - Imprints must be assigned to a group
   - Line items must have matching group_label

3. **Manual recalculation needed for:**
   - Price matrix updates (after changing matrix values)
   - Use: `SELECT recalculate_quote_pricing('quote_id');`

## Migration File
**File:** `supabase/migrations/add_imprint_pricing_system.sql`
- Adds price and num_colors columns
- Creates all pricing functions
- Sets up automatic triggers
- Updates line_type constraint

## Future Enhancements

1. **Setup fees per imprint**
   - Add setup_fee column to quote_imprints
   - Include in price calculation

2. **Quantity breaks visualization**
   - Show pricing tiers in UI
   - Highlight cost savings at higher quantities

3. **Price override capability**
   - Allow manual price adjustments
   - Track overrides for reporting

4. **Pricing history**
   - Log price changes
   - Audit trail for pricing decisions

## Summary
The imprint-based pricing system is now fully implemented with:
- ✅ Database functions for price calculation
- ✅ Automatic triggers for recalculation
- ✅ Frontend integration in ManageImprintsModal
- ✅ Group-based pricing logic
- ✅ Multi-color support
- ✅ Line type cleanup (removed deprecated 'imprint' value)

All pricing is handled automatically by database triggers, ensuring consistency and accuracy across the application.
