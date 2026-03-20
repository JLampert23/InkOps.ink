# Quote Duplication Price Lock Implementation

## Summary
Fixed quote duplication to preserve original unit prices (including imprint prices) by implementing a price locking mechanism that prevents automatic recalculation when duplicated quotes are loaded.

## Problem
When duplicating quotes, the unit prices were being copied correctly but then automatically recalculated when the quote was loaded in QuoteBuilder, causing the imprint prices to be removed from the total unit price.

## Solution

### 1. Database Schema Update
**Migration:** `add_price_locked_to_quote_line_items.sql`

- Added `price_locked` boolean column to `quote_line_items` table (default: false)
- Added index for performance when filtering locked prices
- When true, prevents automatic price recalculation

### 2. Edge Function Updates
**File:** `supabase/functions/quote-actions/index.ts`

- **Fixed Authentication:** Enabled `verify_jwt = true` in config.toml to properly authenticate requests
- **Price Locking on Duplicate:** When duplicating quotes, all line items are created with `price_locked: true`
- This ensures duplicated quotes preserve their original pricing structure

### 3. Frontend Updates
**File:** `src/components/production/QuoteBuilder.tsx`

#### New Functionality:
- **Load price_locked flag:** When loading quote line items, the `price_locked` flag is now loaded and preserved
- **Skip auto-recalculation:** `updatePriceFromMatrixWithGroups()` now checks if `price_locked` is true and skips price updates
- **Conditional auto-update:** `updateItem()` only triggers price updates when quantities change if prices are not locked
- **Toggle price lock function:** `togglePriceLock()` allows users to lock/unlock prices for an entire group

#### UI Enhancements:
- **Lock/Unlock Button:** Added button next to "Update Pricing" that shows lock status and allows toggling
  - Amber when locked, gray when unlocked
  - Shows appropriate icon (Lock/Unlock)
  - Updates database when toggled
- **Visual Indicators:**
  - Locked prices show amber background with amber left border
  - Lock icon displayed in top-left of price field
  - "Update Pricing" button is disabled when prices are locked (prevents accidental updates)
- **Tooltips:** Clear messaging about lock status

## How It Works

### When Duplicating a Quote:
1. User clicks "Duplicate" on a quote
2. Edge function creates new quote with new quote number
3. All line items are copied with `price_locked: true`
4. All imprints are copied with original prices
5. All proofs are copied with original artwork

### When Loading a Duplicated Quote:
1. QuoteBuilder loads line items including `price_locked` flag
2. When rendering, locked prices show with amber styling and lock icon
3. User can see that prices won't auto-update
4. Quantity changes do NOT trigger price recalculation

### When User Wants to Update Prices:
1. Click "Unlock Prices" button (changes from amber to gray)
2. All line items in that group are unlocked in database
3. "Update Pricing" button becomes enabled
4. User can click "Update Pricing" to recalculate from price matrices
5. Or manually edit prices which will still be preserved

### When User Wants to Lock Prices Again:
1. Click "Lock Prices" button
2. All line items in that group are locked in database
3. Prices are now protected from auto-recalculation

## Benefits

1. **Preserves Original Pricing:** Duplicated quotes maintain exact unit prices including imprint costs
2. **User Control:** Users can unlock prices when they want to update them
3. **Visual Feedback:** Clear indicators show when prices are locked
4. **Database Persistence:** Lock state is saved to database, not just in-memory
5. **Group-Level Control:** Lock/unlock entire groups at once for efficiency
6. **Safety:** Prevents accidental price changes when editing quantities

## Technical Details

### Authentication Fix
- Changed `verify_jwt` from `false` to `true` in edge function config
- This fixed the 401 Unauthorized error during duplication
- Supabase now properly validates the JWT token before allowing duplication

### Price Calculation Flow
```
Duplicate Quote
  ↓
Line items created with price_locked: true
  ↓
Load in QuoteBuilder
  ↓
price_locked flag loaded
  ↓
User changes quantity
  ↓
Check: is price_locked?
  ↓
Yes → Skip price update
No  → Recalculate from matrix
```

### Database Impact
- Minimal: Single boolean column added
- Indexed for performance on locked items
- Backward compatible (defaults to false)

## Files Modified

1. **Database:**
   - Added migration for `price_locked` column

2. **Edge Function:**
   - `supabase/functions/quote-actions/index.ts` - Set `price_locked: true` on duplicate
   - `supabase/functions/quote-actions/config.toml` - Enabled JWT verification

3. **Frontend:**
   - `src/components/production/QuoteBuilder.tsx` - Added lock functionality and UI

## Testing Recommendations

1. Duplicate a quote with imprints
2. Verify unit prices match original including imprint costs
3. Change quantities and verify prices don't recalculate
4. Click "Unlock Prices" and verify button state changes
5. Click "Update Pricing" and verify prices recalculate correctly
6. Click "Lock Prices" again and verify prices are protected
7. Save quote and reload - verify lock state persists
8. Verify original quote is unaffected by duplication

## Future Enhancements

- Individual item-level lock/unlock (currently group-level)
- Lock indicator in quote list view
- Bulk lock/unlock across all groups
- Warning when unlocking prices that have been manually adjusted
