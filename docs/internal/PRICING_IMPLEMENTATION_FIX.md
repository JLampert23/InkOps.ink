# PromoStandards Unified Pricing Implementation Fix

**Date:** 2026-03-12
**Status:** ✅ COMPLETED

## Summary

Replaced the broken single-warehouse pricing implementation in `promostandards-unified` edge function with the proven multi-warehouse pricing logic from `ssactivewear-api`.

## Problem

The original implementation had several critical issues:

1. **Invalid FOB ID**: Used `fobId='all'` which is not a valid warehouse identifier
2. **Single Part Pricing**: Only attempted to price one specific part instead of all parts
3. **No Warehouse Coverage**: Failed to query all 7 SSActivewear warehouses
4. **Poor Error Handling**: Didn't properly handle pricing failures or fallback scenarios
5. **Incorrect Response Format**: Returned single price instead of per-part pricing data

## Solution

### 1. Updated Endpoint Configuration

```typescript
// BEFORE
const PROMOSTANDARDS_ENDPOINTS = {
  // ...
  pricingAndConfiguration: "https://promostandards.ssactivewear.com/PricingAndConfiguration/v1/PricingAndConfigurationService.svc",
};

// AFTER
const PROMOSTANDARDS_ENDPOINTS = {
  // ...
  pricing: "https://promostandards.ssactivewear.com/pricingandconfiguration/v1/pricingandconfigurationservice.svc",
};

const ALL_SS_FOB_IDS = ['IL', 'KS', 'NJ', 'TX', 'GA', 'NV', 'DS'];
```

### 2. Removed Broken Code

Deleted the following:
- Lines 245-257: Broken `normalizedFobId = 'all'` and `priceType` configuration
- Lines 480-583: Entire broken PPC pricing section that only priced one part
- Lines 709-721: Broken pricing fallback logic

### 3. Implemented Multi-Warehouse Pricing

**New Implementation (Step 1.5):**

```typescript
// Extract 6-character product ID for pricing
const pricingProductId = internalProductId || (discoveredPartId ? discoveredPartId.substring(0, 6) : null);

// Query ALL 7 warehouses in parallel
const warehousePricingPromises = ALL_SS_FOB_IDS.map(async (fobId) => {
  const soapBody = `<ns2:GetConfigurationAndPricingRequest ...>
    <shar:productId>${escapeXml(pricingProductId)}</shar:productId>
    <shar:fobId>${escapeXml(fobId)}</shar:fobId>
    <shar:priceType>Customer</shar:priceType>
    ...
  </ns2:GetConfigurationAndPricingRequest>`;

  // Parse ALL parts and their pricing tiers
  // Return { fobId, parts: [{ partId, prices: [...] }] }
});

// Find lowest price across all warehouses for each part
for (const warehouseData of warehouseResults) {
  for (const part of warehouseData.parts) {
    // Track best price and all warehouse options
    partPricingMap.set(partId, {
      partId,
      prices: [...],
      warehouse: bestWarehouse,
      allWarehousePrices: [...]
    });
  }
}
```

**Key Features:**

- Queries all 7 warehouses simultaneously (parallel execution)
- Extracts pricing for ALL parts, not just one
- Finds the lowest price across all warehouses for each part
- Preserves all warehouse pricing options for transparency
- Proper error handling per warehouse
- Hardcodes `priceType: 'Customer'` as recommended by S&S IT

### 4. Updated Response Format

**BEFORE:**
```json
{
  "pricing": {
    "price": 12.50,
    "source": "customer-net-pricing",
    "ppcTiers": [...],
    "ppcError": null
  }
}
```

**AFTER:**
```json
{
  "pricing": {
    "parts": [
      {
        "partId": "B22035001",
        "prices": [
          { "quantity": 1, "price": 12.50 },
          { "quantity": 12, "price": 11.25 },
          { "quantity": 72, "price": 10.15 }
        ],
        "warehouse": "IL",
        "allWarehousePrices": [
          { "warehouse": "IL", "prices": [...] },
          { "warehouse": "TX", "prices": [...] }
        ]
      }
    ],
    "pricesByPartId": {
      "B22035001": 12.50,
      "B22035002": 12.50,
      "B22035003": 12.50
    },
    "warehouseCount": 7,
    "error": null
  },
  "pricingAvailable": true,
  "pricingUnavailableReason": null
}
```

### 5. Updated Debug Information

```json
{
  "debug": {
    "pricingProductId": "B22035",
    "warehousesQueried": ["IL", "KS", "NJ", "TX", "GA", "NV", "DS"],
    "partsWithPricing": 24,
    "pricingError": null
  }
}
```

## Testing

The function can be tested using:

```bash
# Test pricing for a product
curl -X GET \
  "https://[project].supabase.co/functions/v1/promostandards-unified?styleNumber=996MR&testPpc=true" \
  -H "Authorization: Bearer [token]"
```

Expected result:
- `partCount`: Number of parts with pricing
- `warehouseCount`: 7
- `pricingData`: Array of parts with pricing from all warehouses

## Benefits

1. **Accurate Pricing**: Queries all warehouses for comprehensive pricing data
2. **Best Prices**: Automatically finds lowest price across all locations
3. **Transparency**: Shows which warehouse has the best price
4. **Complete Coverage**: Prices ALL parts, not just one
5. **Better UX**: QuoteBuilder receives proper pricing data for all color/size combinations
6. **Performance**: Parallel warehouse queries (fast)
7. **Reliability**: Proven implementation from working `ssactivewear-api`

## Files Changed

- `/supabase/functions/promostandards-unified/index.ts` - Complete pricing overhaul

## Deployment

✅ Deployed via `mcp__supabase__deploy_edge_function`

## Backward Compatibility

Added `pricesByPartId` map to maintain compatibility with existing QuoteBuilder code:

```typescript
// QuoteBuilder already supports this (lines 1388-1411)
const price = unifiedData.pricing?.pricesByPartId[color.code];

// Also supports the new parts array format (lines 1412-1416)
const firstPart = unifiedData.pricing?.parts[0];
const price = firstPart?.prices[0]?.price;
```

The edge function now returns BOTH formats:
- `pricing.pricesByPartId` - Map of partId → lowest price (for backward compatibility)
- `pricing.parts` - Array with full pricing tiers and warehouse info (new comprehensive format)

## Related Documentation

- `/docs/developer/SANMAR_COMPLETE_INTEGRATION_SUMMARY.md`
- `/docs/internal/SSA_COMPLETE_INVESTIGATION_REPORT.md`
- `/docs/internal/SS_PROMOSTANDARDS_COMPLETE_FIX.md`
