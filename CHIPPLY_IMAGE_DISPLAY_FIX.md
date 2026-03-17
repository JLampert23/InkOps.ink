# Chipply Image Display Fix

## Problem
Chipply quotes were not displaying garment images in either the Quote Builder or Quote Detail views.

## Root Cause
There was a mismatch between the database columns used by the Chipply import process and the columns read by the UI components:

**Chipply Import Function stored images in:**
- `garment_image_url`
- `garment_back_image_url`
- `garment_side_image_url`

**UI Components (QuoteBuilder, QuoteDetail) read from:**
- `garment_front_image_url`
- `garment_rear_image_url`
- `garment_side_image_url`
- `garment_lifestyle_image_url`

## Solution
Applied two migrations to fix the issue:

### 1. Updated Chipply Import Function
**Migration:** `fix_chipply_image_columns_alignment`

Modified the `process_chipply_import()` function to:
- Store images in UI-compatible column names (`garment_front_image_url`, `garment_rear_image_url`)
- Also populate legacy column names for backward compatibility (`garment_image_url`, `garment_back_image_url`)
- Ensures future Chipply imports will display correctly

**Mapping:**
- Chipply `image1Url` → `garment_front_image_url` + `garment_image_url`
- Chipply `image2Url` → `garment_rear_image_url` + `garment_back_image_url`
- Chipply `image3Url` → `garment_side_image_url`

### 2. Backfilled Existing Data
**Migration:** `backfill_chipply_image_columns`

Updated existing Chipply quote line items to:
- Copy `garment_image_url` → `garment_front_image_url`
- Copy `garment_back_image_url` → `garment_rear_image_url`
- Ensures existing Chipply quotes now display images correctly

## Files Modified
- `supabase/migrations/20260317_fix_chipply_image_columns_alignment.sql`
- `supabase/migrations/20260317_backfill_chipply_image_columns.sql`

## Testing
After applying these migrations:
1. Existing Chipply quotes should now display garment images
2. New Chipply imports will automatically use the correct columns
3. Images will appear in both Quote Builder and Quote Detail views

## Note
The Chipply import also downloads and stores images to Supabase Storage via the `chipply-inbound` edge function, replacing external URLs with stored URLs in the `chipply-garment-images` bucket.
