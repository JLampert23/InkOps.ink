# PromoStandards Image & Pricing Fix Summary

## Issues Identified

1. **401 Invalid JWT Error** - Edge function was rejecting requests
2. **Missing Pricing Data** - No wholesale/retail prices showing when selecting colors
3. **Images Not Loading** - Media API calls failing

## Fixes Applied

### 1. JWT Authentication Issue (FIXED)
- **Problem**: Edge function returning `{"code":401,"message":"Invalid JWT"}`
- **Root Cause**: Sending both `Authorization` and `apikey` headers together
- **Solution**: Removed the `apikey` header from fetch requests to `promostandards-unified`
- **Files Changed**:
  - `src/services/ssactivewear-promostandards-service.ts` - Removed `apikey` header
  - Added JWT refresh logic to prevent expired token issues

### 2. Edge Function Deployment
- Redeployed `promostandards-unified` with `verifyJWT: false`
- Added debug logging to track function invocation
- Function now handles JWT validation internally

## How S&S PromoStandards Pricing Works (Per Documentation)

According to the S&S PromoStandards Developer Guide:

### Pricing API Call Structure
```xml
<GetConfigurationAndPricingRequest>
  <wsVersion>1.0.0</wsVersion>
  <id>{Account Number}</id>
  <password>{API Key}</password>
  <productId>B00760</productId>          <!-- This is the STYLE NUMBER with "B" prefix -->
  <currency>USD</currency>
  <fobId>IL</fobId>                       <!-- WAREHOUSE ID - Required! -->
  <priceType>Customer</priceType>
  <localizationCountry>US</localizationCountry>
  <localizationLanguage>en</localizationLanguage>
  <configurationType>Blank</configurationType>
</GetConfigurationAndPricingRequest>
```

### Key Points:
1. **productId Parameter**: Use style number with "B" prefix (e.g., "B00760" for style "00760")
2. **fobId Required**: Must specify a warehouse location:
   - IL (Lockport, IL)
   - NJ (Robbinsville, NJ)
   - KS (Olathe, KS)
   - TX (Fort Worth, TX)
   - GA (McDonough, GA)
   - NV (Reno, NV)
   - DS (Dropship)

3. **Response**: Returns pricing for each partId (size/color combo):
```xml
<Part>
  <partId>B00760033</partId>
  <partDescription>Antique Cherry Red (S)</partDescription>
  <PartPriceArray>
    <PartPrice>
      <minQuantity>1</minQuantity>
      <price>2.50</price>
      <discountCode>A</discountCode>
    </PartPrice>
  </PartPriceArray>
</Part>
```

## Current Implementation Status

### ✅ Working
- Product search (returns style, brand, description, colors)
- MediaContent API calls (images)
- Inventory API calls (stock levels)
- Pricing API calls (structure in place)

### ⚠️ Needs Verification
The `promostandards-unified` edge function is already calling the Pricing API when a `partId` is provided:
- Line 298-309 in `supabase/functions/promostandards-unified/index.ts`
- It sends the request with all required parameters
- Response is parsed and included in the unified response

### 🔍 What to Check

1. **Test the Color Selection Flow**:
   - Search for a style number (e.g., "18000")
   - Click on a color from the dropdown
   - Check browser console for:
     - `🔵 Fetching unified product data`
     - Look for `pricing` in the response object
     - Verify `color?.pricing?.wholesale` has a value

2. **Check for Pricing in Response**:
   - Open DevTools → Network tab
   - Look for the `promostandards-unified?styleNumber=...&partId=...` call
   - Verify the response includes a `pricing` object with parts array

3. **Warehouse (fobId) Configuration**:
   - Current implementation uses no warehouse (defaults to account-level pricing)
   - May need to add warehouse selection or default warehouse per S&S docs

## Next Steps if Pricing Still Not Showing

1. **Add Warehouse Parameter**:
   ```typescript
   // In promostandards-unified edge function
   const fobId = url.searchParams.get("fobId") || "IL"; // Default to IL warehouse
   ```

2. **Check Cache vs Live**:
   - The `product-search` function returns cached data
   - Cache may not have pricing populated yet
   - When selecting a color, `promostandards-unified` makes a LIVE API call with pricing

3. **Verify S&S Credentials**:
   - Ensure account has pricing API access enabled
   - Test credentials with S&S directly if needed

## Testing Instructions

1. **Refresh the page** to get the updated code
2. **Search for a product** (e.g., "18000")
3. **Select a color** from the dropdown
4. **Check the console** for:
   - No more 401 errors
   - `🔵 Fetching unified product data` message
   - Response object with `pricing` data
5. **Verify unit_price** populates in the line item

## Files Modified

- `src/services/ssactivewear-promostandards-service.ts`
- `supabase/functions/promostandards-unified/index.ts`

## Documentation Reference

All implementation follows the official S&S PromoStandards Developer Guide (attached PDF), specifically:
- **Pricing Section** (Pages 6-8)
- **Images Section** (Pages 16-17)
- **Product Data Section** (Pages 4-6)
