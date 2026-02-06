# Dollar Sign Pricing Button - Fixed ✅

## What Was Fixed

The dollar sign ($) button in QuoteBuilder was using old pricing logic that tried to manually calculate prices from a single imprint. It has been updated to use the new imprint-based pricing system.

## How It Works Now

### For Saved Quotes
When you click the dollar sign button on a **saved quote**:

1. **Calls Database Function**: `recalculate_quote_pricing()`
2. **Recalculates All Imprints**: Each imprint's price is recalculated based on:
   - Group total quantity
   - Number of colors
   - Price matrix lookup
3. **Sums Imprint Prices**: Unit price = sum of all imprint prices in the group
4. **Updates All Items**: All line items in the group get the same unit_price
5. **Reloads Data**: Fresh data is loaded from the database to update the UI

### For Draft Quotes (Unsaved)
When you click the dollar sign button on a **draft quote**:

1. **Reads Existing Prices**: Reads the `price` field from each imprint
2. **Sums Them Up**: Adds all imprint prices for the group
3. **Updates UI**: Applies the sum to all items in the group
4. **Note**: Draft quotes need to be saved first for full pricing calculation

## Step-by-Step Usage

### Example: 170 Garments with 2 Imprints

1. **Create Quote and Add Line Items**
   - Add garments to a group
   - Total quantity: 170 pieces

2. **Add Imprints**
   - Click "Manage Imprints" for the group
   - Add Front imprint (1 color) with price matrix
   - Add Back imprint (1 color) with price matrix
   - Save imprints

3. **Save the Quote**
   - Click "Save Quote" button
   - Database triggers automatically calculate:
     - Front imprint: $1.68 (based on 170 qty, 1 color)
     - Back imprint: $1.68 (based on 170 qty, 1 color)
     - Unit price: $3.36 (sum of both)

4. **Click Dollar Sign Button**
   - If prices need updating (changed quantities, etc.)
   - Button recalculates and updates all pricing
   - UI refreshes with new values

## What Changed in the Code

### Before (Old System)
```typescript
// Manually looked up ONE imprint
// Manually calculated price from matrix
// Only considered single imprint's colors
// Complex logic with row/column lookups
```

### After (New System)
```typescript
// For saved quotes:
await supabase.rpc('recalculate_quote_pricing', {
  p_quote_id: quoteId
});
await loadQuote(quoteId);

// For draft quotes:
const totalPrice = groupImprints.reduce((sum, imp) =>
  sum + (imp.price || 0), 0
);
```

## When to Click the Dollar Sign Button

### You Should Click It When:
- ✅ You change line item quantities
- ✅ You add or remove imprints
- ✅ You change the number of colors in an imprint
- ✅ You need to refresh pricing after changes

### You Don't Need to Click It When:
- ❌ You just saved the quote (triggers calculate automatically)
- ❌ You just added/updated imprints (triggers calculate automatically)
- ❌ Quantities haven't changed

## Automatic vs. Manual Recalculation

### Automatic (Database Triggers)
These actions automatically trigger pricing recalculation:
- Adding an imprint
- Updating an imprint
- Deleting an imprint
- Changing line item quantities (when saved)
- Changing group labels

### Manual (Dollar Sign Button)
Use the button when:
- You want to force a refresh
- You're not seeing updated prices
- You've made changes outside the normal flow

## Troubleshooting

### "No imprints found" Message
- **Cause**: The group has no imprints assigned
- **Fix**: Click "Manage Imprints" and add at least one imprint

### "Please save the quote first" Message
- **Cause**: Trying to calculate prices on an unsaved draft
- **Fix**: Save the quote, then click the button

### Prices Not Updating
- **Check 1**: Make sure the quote is saved
- **Check 2**: Verify imprints have price matrix assigned
- **Check 3**: Confirm price matrix has pricing data
- **Fix**: Click the dollar sign button to force recalculation

### Wrong Price Showing
- **Check 1**: Verify correct number of colors in each imprint
- **Check 2**: Confirm correct price matrix is selected
- **Check 3**: Check that group quantities are correct
- **Fix**: Update imprint settings, then click dollar sign button

## Technical Details

### Database Function Called
```sql
SELECT recalculate_quote_pricing('quote-uuid-here');
```

### What It Does
1. Recalculates each imprint's price
2. Updates `quote_imprints.price` column
3. Sums imprint prices for each group
4. Updates `quote_line_items.unit_price` for all items in group
5. Recalculates `quote_line_items.total_price`
6. Updates `quotes.subtotal`

### Frontend Refresh
```typescript
// After database calculation
await loadQuote(quoteId);
// Reloads:
// - Quote header data
// - All line items with new prices
// - All imprints with new prices
// - All fees
```

## Summary

The dollar sign button now properly:
- ✅ Uses the new imprint-based pricing system
- ✅ Sums ALL imprint prices (not just one)
- ✅ Applies same price to all items in group
- ✅ Calls database function for saved quotes
- ✅ Reloads fresh data after calculation
- ✅ Shows helpful error messages

**Result**: Line items now update correctly when you click the dollar sign!
