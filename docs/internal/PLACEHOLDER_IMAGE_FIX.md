# Placeholder Image Fix - Implementation Summary

## Problem
The application was loading and displaying placeholder images from SanMar's CDN instead of actual product images. These placeholder images appear when SanMar doesn't have real product photos available, and they were getting stored in the database and shown to users.

## Root Cause
Multiple parts of the codebase were fetching and storing images without properly validating whether they were actual product images or just placeholders. SanMar's API returns placeholder URLs when images aren't available, and these were being treated as valid images.

## Solution Implemented

### 1. Created Shared Image Validator (`supabase/functions/_shared/image-validator.ts`)
A centralized utility for detecting and filtering placeholder images across all edge functions:

**Key Features:**
- `PLACEHOLDER_INDICATORS` array with common placeholder URL patterns
- `isPlaceholderUrl()` - Detects placeholder URLs by pattern matching
- `validateImageUrl()` - Performs HTTP HEAD requests to verify images are real
- `filterValidImages()` - Filters arrays of images, removing placeholders
- `sanitizeImageUrl()` - Sanitizes individual image URLs

**Placeholder Detection Patterns:**
- "imagenotavailable"
- "image404errorhandler"
- "image_not_available"
- "notavailable"
- "placeholder"
- "no-image"
- "noimage"

### 2. Updated Edge Functions

#### `sanmar-image-ingest/index.ts`
- Now imports and uses shared `isPlaceholderUrl()` function
- Validates images before storing in Supabase Storage
- Prevents placeholder images from being cached

#### `sanmar-image-proxy/index.ts`
- Uses shared placeholder detection
- Returns 404 error when image is a placeholder
- Prevents serving placeholder images to frontend

#### `product-search/sanmar-provider.ts`
- Replaced local validation with shared `filterValidImages()`
- Validates all images from PromoStandards API before caching
- Discards entire image sets if all images are placeholders

### 3. Created Client-Side Validator (`src/utils/image-validator.ts`)
Frontend utility for validating images before display:

**Functions:**
- `isPlaceholderUrl()` - Client-side placeholder detection
- `sanitizeImageUrl()` - Returns null for placeholder URLs
- `filterValidImageUrls()` - Filters arrays of image URLs
- `getFirstValidImageUrl()` - Gets first non-placeholder from array

### 4. Updated MockupGenerator Component (`src/components/production/MockupGenerator.tsx`)
Applied image sanitization at all image loading points:

**Changes:**
- Sanitizes images loaded from quote line items
- Filters placeholder images from garment style selectors
- Validates images from product search results
- Cleans images in the garment image picker
- Prevents placeholder images from being set as active garment images

**Specific Updates:**
- Line item initial load (line ~531)
- Proof garment image load (line ~772)
- Line item fallback load (line ~791)
- Product search result images (line ~912)
- Garment style click handler (line ~2354)
- Image thumbnail click handler (line ~2438)
- Fallback single URL loading (line ~2388-2403)

## Benefits

1. **No More Placeholder Images**: Users will only see actual product images
2. **Database Cleanup**: Prevents placeholder URLs from being stored
3. **Better UX**: Clear indication when images aren't available (null/empty state)
4. **Centralized Logic**: Single source of truth for placeholder detection
5. **Edge Function Validation**: Images validated before storage
6. **Frontend Validation**: Additional safety layer on client side

## Testing Recommendations

1. **Search for products with limited images** - Verify placeholders are filtered
2. **Create quotes with various SanMar products** - Check image loading
3. **Test MockupGenerator** - Ensure only real images appear
4. **Monitor edge function logs** - Check for placeholder detection messages
5. **Verify database** - Ensure no new placeholder URLs are stored

## Database Cleanup (Optional)

To remove existing placeholder images from the database, run:

```sql
-- Find quote line items with placeholder images
SELECT id, item_number, garment_front_image_url
FROM quote_line_items
WHERE garment_front_image_url ILIKE '%imagenotavailable%'
   OR garment_front_image_url ILIKE '%image404errorhandler%'
   OR garment_front_image_url ILIKE '%placeholder%';

-- Clear placeholder images from quote_line_items
UPDATE quote_line_items
SET garment_front_image_url = NULL,
    garment_back_image_url = NULL,
    garment_rear_image_url = NULL,
    garment_side_image_url = NULL,
    garment_lifestyle_image_url = NULL
WHERE garment_front_image_url ILIKE '%imagenotavailable%'
   OR garment_front_image_url ILIKE '%image404errorhandler%'
   OR garment_front_image_url ILIKE '%placeholder%'
   OR garment_back_image_url ILIKE '%imagenotavailable%'
   OR garment_rear_image_url ILIKE '%imagenotavailable%'
   OR garment_side_image_url ILIKE '%imagenotavailable%'
   OR garment_lifestyle_image_url ILIKE '%imagenotavailable%';

-- Clear placeholder images from proofs
UPDATE proofs
SET garment_image_url = NULL
WHERE garment_image_url ILIKE '%imagenotavailable%'
   OR garment_image_url ILIKE '%image404errorhandler%'
   OR garment_image_url ILIKE '%placeholder%';

-- Clear from sanmar_image_map cache
DELETE FROM sanmar_image_map
WHERE original_url ILIKE '%imagenotavailable%'
   OR original_url ILIKE '%image404errorhandler%'
   OR original_url ILIKE '%placeholder%'
   OR cdn_url ILIKE '%imagenotavailable%';
```

## Files Modified

### Edge Functions
- `supabase/functions/_shared/image-validator.ts` (NEW)
- `supabase/functions/sanmar-image-ingest/index.ts`
- `supabase/functions/sanmar-image-proxy/index.ts`
- `supabase/functions/product-search/sanmar-provider.ts`

### Frontend
- `src/utils/image-validator.ts` (NEW)
- `src/components/production/MockupGenerator.tsx`

### Deployed Functions
- ✅ `sanmar-image-ingest`
- ✅ `sanmar-image-proxy`
- ✅ `product-search`

## Future Enhancements

1. Add placeholder image detection to other components (QuoteBuilder, etc.)
2. Implement automatic re-fetch for products with no images after X days
3. Add admin tool to bulk-validate and clean existing image URLs
4. Create fallback/default images for products without photos
5. Add metrics to track placeholder detection frequency
