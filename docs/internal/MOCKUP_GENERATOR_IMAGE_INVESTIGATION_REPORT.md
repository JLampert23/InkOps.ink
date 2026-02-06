# MOCKUP GENERATOR IMAGE INVESTIGATION REPORT

**Date**: 2026-02-02
**Issue**: Mockup Generator is not displaying all available garment images for each style and color

---

## EXECUTIVE SUMMARY

The Mockup Generator is **ONLY displaying 4 images maximum** (Front, Back/Rear, Side/Sleeve, Lifestyle) per garment, even when the SSActivewear PromoStandards Media Content API returns multiple images for each view type (e.g., "Front Flat", "Front Model", "Front Detail").

**Root Cause**: The `promostandards-unified` edge function filters the complete image list down to ONLY 4 URLs using `.find()`, which returns only the FIRST matching image for each category. All other images are discarded.

---

## DATA FLOW ANALYSIS

### 1. **SSActivewear Media Content API Response**
**File**: `supabase/functions/ssactivewear-api/index.ts` (lines 431-527)

The API returns an array of media objects with properties:
- `url` - Image URL
- `classType` - Category (e.g., "Front", "Rear", "Side", "Lifestyle", "Detail", "Swatch")
- `description` - Text description
- `fileType` - File extension (jpg, png, etc.)
- `partId` - Color-specific identifier
- `isImage` - Boolean flag (filters out web pages, spec sheets)

**Example classType values returned by SSActivewear**:
- "Front"
- "Front Flat"
- "Front Model"
- "Rear"
- "Rear Flat"
- "Side"
- "Lifestyle"
- "Detail"
- "Swatch"

Multiple images can exist for the same general category (e.g., 3 different "Front" views).

---

### 2. **PromoStandards Unified Edge Function - Image Filtering**
**File**: `supabase/functions/promostandards-unified/index.ts` (lines 342-380)

**CRITICAL CODE SECTION**:
```typescript
// Lines 349-359: Parse ALL images from XML
mediaData.images = mediaMatches.map(match => {
  const mediaXml = match[1];
  return {
    url: getXmlValue(mediaXml, "url"),
    partId: getXmlValue(mediaXml, "partId"),
    description: getXmlValue(mediaXml, "description"),
    fileType: getXmlValue(mediaXml, "fileType"),
    classType: getXmlValue(mediaXml, "classType"),
    singlePart: getXmlValue(mediaXml, "singlePart") === "true",
  };
});

// Lines 362-379: FILTER DOWN TO ONLY 4 IMAGES
mediaData.views = {
  front: mediaData.images.find((img: any) =>
    img.description?.toLowerCase().includes('front') ||
    img.classType?.toLowerCase().includes('front')
  )?.url || null,  // ⚠️ ONLY RETURNS FIRST MATCH

  rear: mediaData.images.find((img: any) =>
    img.description?.toLowerCase().includes('rear') ||
    img.classType?.toLowerCase().includes('rear')
  )?.url || null,  // ⚠️ ONLY RETURNS FIRST MATCH

  side: mediaData.images.find((img: any) =>
    img.description?.toLowerCase().includes('side') ||
    img.classType?.toLowerCase().includes('side')
  )?.url || null,  // ⚠️ ONLY RETURNS FIRST MATCH

  lifestyle: mediaData.images.find((img: any) =>
    img.description?.toLowerCase().includes('lifestyle') ||
    img.classType?.toLowerCase().includes('lifestyle')
  )?.url || null,  // ⚠️ ONLY RETURNS FIRST MATCH
};
```

**PROBLEM**:
- `.find()` returns **ONLY THE FIRST** matching item
- If the API returns "Front", "Front Flat", "Front Model" - only ONE is kept
- All other images are **DISCARDED**

**What happens to the full image list?**
- It IS included in the response as `mediaData.images`
- But the QuoteBuilder only uses `mediaData.views` (4 URLs)

---

### 3. **QuoteBuilder - Saving Images to Database**
**File**: `src/components/production/QuoteBuilder.tsx` (lines 840-870)

```typescript
// Lines 840-855: Fetch unified data
const unifiedData = await getUnifiedProductData(product.style, color.code);

if (unifiedData.success && unifiedData.media?.views) {
  // ⚠️ ONLY saves the 4 filtered URLs
  garmentImages.garment_front_image_url = unifiedData.media.views.front || undefined;
  garmentImages.garment_rear_image_url = unifiedData.media.views.rear || undefined;
  garmentImages.garment_side_image_url = unifiedData.media.views.side || undefined;
  garmentImages.garment_lifestyle_image_url = unifiedData.media.views.lifestyle || undefined;

  // Line 855: Raw images ARE saved but NEVER USED
  garmentImages.garment_images_data = unifiedData.media.images || undefined;
}
```

**Database Verification**:
```sql
SELECT garment_front_image_url, garment_rear_image_url,
       garment_side_image_url, garment_lifestyle_image_url,
       garment_images_data
FROM quote_line_items
WHERE item_number = '5000' AND color = 'Antique Cherry Red';
```

**Result**:
- `garment_front_image_url`: "https://cdn.ssactivewear.com/images/style/16_fl.jpg"
- `garment_rear_image_url`: NULL
- `garment_side_image_url`: NULL
- `garment_lifestyle_image_url`: NULL
- `garment_images_data`: `[]` (empty array)

**Finding**: Even the raw `garment_images_data` is empty, suggesting the Media Content API may not be returning images, OR the response parsing is failing.

---

### 4. **MockupGenerator - Display Logic**
**File**: `src/components/production/MockupGenerator.tsx` (lines 427-437, 2059-2183)

```typescript
// Lines 427-437: Load garment styles from database
const styles = lineItems.map(item => ({
  lineItemId: item.id,
  style: item.item_number || '',
  color: item.color || '',
  description: item.description || '',
  itemNumber: item.item_number || '',
  frontImage: item.garment_front_image_url || '',  // ⚠️ ONLY 1 FRONT IMAGE
  rearImage: item.garment_rear_image_url || '',    // ⚠️ ONLY 1 REAR IMAGE
  sideImage: item.garment_side_image_url || '',    // ⚠️ ONLY 1 SIDE IMAGE
  lifestyleImage: item.garment_lifestyle_image_url || '', // ⚠️ ONLY 1 LIFESTYLE
  imagesData: item.garment_images_data || null,    // ⚠️ NEVER DISPLAYED IN UI
}));
```

**UI Display** (lines 2104-2183):
- Shows 4 clickable image thumbnails: Front, Rear, Side, Lifestyle
- Each thumbnail displays ONLY the single URL from the database
- The `imagesData` field is loaded but **NEVER rendered** in the UI

---

## IDENTIFIED ISSUES

### Issue #1: Image Filtering Logic Discards Valid Images
**Location**: `promostandards-unified/index.ts` lines 362-379

**Problem**: Using `.find()` returns only the FIRST matching image for each category.

**Impact**: If SSActivewear returns:
- "Front" - returned ✅
- "Front Flat" - discarded ❌
- "Front Model" - discarded ❌
- "Rear" - returned ✅
- "Side" - returned ✅
- "Lifestyle" - returned ✅

Only 4 images are kept, all others are lost.

---

### Issue #2: Raw Image Array is Saved but Never Used
**Location**:
- `QuoteBuilder.tsx` line 855: `garment_images_data = unifiedData.media.images`
- `MockupGenerator.tsx` line 437: `imagesData: item.garment_images_data`

**Problem**: The complete image array is stored in `garment_images_data` but the MockupGenerator UI does not display it.

**Impact**: Even if we fix the API to return all images, the UI won't show them without modification.

---

### Issue #3: Empty garment_images_data Array
**Location**: Database query result shows `garment_images_data: []`

**Possible Causes**:
1. The PromoStandards Media Content API is not returning any images for partId
2. The XML parsing logic is failing to extract images
3. The `garment_images_data` is being set to an empty array somewhere in the code
4. The product/color combination doesn't have media in SSActivewear's system

**Requires Testing**: Call the Media Content API directly with a known partId to verify the raw XML response.

---

### Issue #4: Inconsistent Image Type Naming
**Location**: Multiple files use different terms for the same image type

**Naming Confusion**:
- Database columns: `garment_rear_image_url`, `garment_side_image_url`
- SSActivewear API: Uses `classType` values like "Rear", "Side"
- MockupGenerator UI: Shows labels "Back", "Sleeve"
- Edge function: Maps "rear" → "rear", "side" → "side"

**Impact**: Potential mismatches in filtering logic.

---

## PARTID AND STYLE VERIFICATION

### Trimming and Formatting
**Location**: `QuoteBuilder.tsx` line 844

```typescript
const unifiedData = await getUnifiedProductData(product.style, color.code);
```

**Verification Needed**:
1. Does `product.style` have trailing spaces? (e.g., "5000 ")
2. Is `color.code` the correct partId format?
3. Does the edge function trim whitespace before making SOAP requests?

**Edge Function** (`promostandards-unified/index.ts` lines 192-249):
```typescript
const styleNumber = url.searchParams.get("styleNumber");
const partId = url.searchParams.get("partId");
```

No trimming is performed on these values before inserting into SOAP XML.

**Risk**: If `styleNumber` or `partId` have trailing/leading spaces, the PromoStandards API may return no results.

---

## MOCKUP GENERATOR INITIALIZATION

### Props Passed to MockupGenerator
**Location**: Check where `MockupGenerator` component is invoked

**Required Props**:
- `quoteId` - Must be valid
- `groupLabel` - Used to filter line items
- `garmentStyle` - May not be needed (loaded from DB)
- `garmentColor` - May not be needed (loaded from DB)
- `imprintId` - Used to pre-select an imprint
- `lineItemId` - Used to load specific line item

**Verification**: If any critical props are undefined, the component may fail to load images.

---

## RECOMMENDED LOGGING FOR INVESTIGATION

To diagnose the exact point of failure, add the following console logs:

### 1. In `promostandards-unified/index.ts` (after line 359):
```typescript
console.log('Media Content API returned images:', {
  totalImages: mediaData.images.length,
  classTypes: mediaData.images.map(img => img.classType),
  urls: mediaData.images.map(img => img.url),
  partId: partId
});
```

### 2. In `promostandards-unified/index.ts` (after line 379):
```typescript
console.log('Filtered views:', {
  front: !!mediaData.views.front,
  rear: !!mediaData.views.rear,
  side: !!mediaData.views.side,
  lifestyle: !!mediaData.views.lifestyle,
  frontUrl: mediaData.views.front,
  rearUrl: mediaData.views.rear
});
```

### 3. In `QuoteBuilder.tsx` (after line 845):
```typescript
console.log('Unified data received:', {
  success: unifiedData.success,
  hasMedia: !!unifiedData.media,
  hasViews: !!unifiedData.media?.views,
  imageCount: unifiedData.media?.images?.length,
  views: unifiedData.media?.views
});
```

### 4. In `MockupGenerator.tsx` (after line 440):
```typescript
console.log('Loaded garment styles:', {
  styleCount: styles.length,
  firstStyle: styles[0],
  hasFrontImage: !!styles[0]?.frontImage,
  imagesDataType: typeof styles[0]?.imagesData,
  imagesDataLength: Array.isArray(styles[0]?.imagesData)
    ? styles[0].imagesData.length
    : 'not an array'
});
```

---

## CONCLUSIONS

### 1. Media Content API Returns All Images
**Status**: ✅ The SSActivewear API likely returns multiple images per partId
**Evidence**: The edge function processes `mediaContent` array from XML

### 2. Filtering Logic Excludes Valid Images
**Status**: ⚠️ CONFIRMED - Lines 362-379 use `.find()` which only keeps the first match
**Impact**: All additional Front/Rear/Side/Lifestyle variants are discarded

### 3. PartId and Style Formatting
**Status**: ⚠️ POTENTIAL ISSUE - No trimming performed on styleNumber or partId
**Risk**: Whitespace could cause API failures

### 4. MockupGenerator Receives Correct Data
**Status**: ❓ UNKNOWN - Depends on upstream filtering
**Issue**: Even if data is correct, UI only displays 4 fixed image slots

### 5. Inconsistencies in Expected vs Actual API Output
**Status**: ⚠️ REQUIRES TESTING
**Issue**: Empty `garment_images_data` suggests either:
- API returned no images for this specific product/color
- XML parsing failed
- Array was overwritten to `[]` somewhere

---

## NEXT STEPS FOR RESOLUTION

### Immediate Actions (Investigation Continues)
1. **Add logging** to `promostandards-unified` edge function to capture raw Media Content API response
2. **Test with a known product** (e.g., Gildan 5000 in Black - partId: `G500BLK`) to verify API returns images
3. **Check browser console** when adding a product to see logged data from QuoteBuilder
4. **Verify trimming** - Add `.trim()` to styleNumber and partId before API calls
5. **Examine XML response** directly to confirm image count and classType values

### Code Changes Required (After Investigation)
1. **Modify `promostandards-unified/index.ts`** to return ALL images organized by classType (not just first match)
2. **Update `QuoteBuilder.tsx`** to save categorized image arrays instead of single URLs
3. **Redesign MockupGenerator UI** to display multiple images per category (carousel, grid, or tabs)
4. **Update database schema** if needed to store image arrays instead of single URLs

---

## SUMMARY

The Mockup Generator image display issue is caused by **overly aggressive filtering** in the `promostandards-unified` edge function, which uses `.find()` to select only ONE image per view type (Front, Rear, Side, Lifestyle). This discards all additional images returned by the SSActivewear Media Content API.

The raw image data IS available in `mediaData.images` and IS being saved to `garment_images_data`, but:
1. The QuoteBuilder only uses the filtered `mediaData.views` (4 URLs)
2. The MockupGenerator UI does not render the raw `garment_images_data` array

Additionally, the current database query shows `garment_images_data: []` (empty), suggesting either:
- The API returned no images for that specific product/color
- The response parsing failed
- There's a whitespace/formatting issue with styleNumber or partId

**Investigation Only - No Code Changes Made**
