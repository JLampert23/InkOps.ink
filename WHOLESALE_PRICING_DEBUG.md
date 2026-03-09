# Wholesale Pricing Debug Information

## Overview
This document contains the complete SOAP request, product IDs, FOB warehouse settings, and response structure for S&S ActiveWear PromoStandards Pricing API debugging.

---

## 1. SOAP XML Request Being Sent

### Complete SOAP Envelope
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    <ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
      <shar:wsVersion>1.0.0</shar:wsVersion>
      <shar:id>[YOUR_ACCOUNT_NUMBER]</shar:id>
      <shar:password>[YOUR_API_KEY]</shar:password>
      <shar:productId>[PRODUCT_ID]</shar:productId>
      <shar:currency>USD</shar:currency>
      <shar:fobId>[FOB_WAREHOUSE_ID]</shar:fobId>
      <shar:priceType>Customer</shar:priceType>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:configurationType>Blank</shar:configurationType>
    </ns2:GetConfigurationAndPricingRequest>
  </soap:Body>
</soap:Envelope>
```

### HTTP Headers
```
Content-Type: text/xml; charset=utf-8
SOAPAction: getConfigurationAndPricing
```

### Endpoint
```
https://promostandards.ssactivewear.com/pricingandconfiguration/v1/pricingandconfigurationservice.svc
```

---

## 2. Product ID Discovery Process

### Problem
S&S ActiveWear Pricing API requires specific internal product IDs (6-character format like "B22035" or "B00760") that differ from the style numbers customers see (like "996MR" or "2000").

### Discovery Strategy (Multi-Step Fallback)

#### Step 0: Inventory API Discovery (Primary Method)
We try multiple style number variations against the Inventory API to discover the internal product ID:

**Tried Variations:**
1. Raw cleaned style number (e.g., "996MR")
2. B-prefixed style (e.g., "B996MR")
3. Leading zeros stripped (e.g., "00760" → "760")
4. Zero-padded to 5 digits if numeric (e.g., "2000" → "02000")

**Inventory SOAP Request:**
```xml
<ns2:GetInventoryLevelsRequest xmlns:ns2="http://www.promostandards.org/WSDL/Inventory/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>[ACCOUNT_NUMBER]</shar:id>
  <shar:password>[API_KEY]</shar:password>
  <shar:productId>[STYLE_VARIATION]</shar:productId>
</ns2:GetInventoryLevelsRequest>
```

**Extraction Logic:**
- Inventory API returns partId values like "B22035597" or "B00760033"
- We extract first 6 characters as internal product ID (e.g., "B22035", "B00760")
- This internal ID is then used for Product Data and Pricing API calls

#### Step 1: Product Data Fallback
If Inventory discovery fails, we try extracting the internal ID from Product Data API response partId values.

#### Pricing API Attempt Order
Once internal ID is discovered, we try these product IDs in order:

1. **PRIMARY:** Plain style number (e.g., "996MR")
   - Most products work with this format

2. **FALLBACK:** Normalized B-prefix style (e.g., "B2000")
   - Uppercase, alphanumeric only, B-prefix added

3. **ALTERNATIVE:** Internal 6-character ID (e.g., "B22035")
   - Extracted from partId values
   - Sometimes works but not always reliable

---

## 3. FOB Warehouse Settings

### Default FOB
```
SSA_DEFAULT_FOB_ID = "NJ"
```

### Company-Specific FOB
The system checks the `company_settings` table for a company-specific FOB override:

```sql
SELECT ssactivewear_fob_id FROM company_settings WHERE id = [COMPANY_ID]
```

If `ssactivewear_fob_id` is set, it overrides the default "NJ" warehouse.

### Common FOB Values
- `NJ` - New Jersey
- `CA` - California
- `NV` - Nevada
- `TX` - Texas

---

## 4. Response Structure

### Successful Response (200 OK)

#### Expected XML Response Format
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetConfigurationAndPricingResponse>
      <Configuration>
        <Part>
          <partId>B22035597</partId>
          <PartPrice>
            <price>5.84</price>
            <minQuantity>12</minQuantity>
            <discountCode>R</discountCode>
            <priceEffectiveDate>2024-01-01</priceEffectiveDate>
            <priceExpiryDate>2024-12-31</priceExpiryDate>
          </PartPrice>
          <PartPrice>
            <price>5.60</price>
            <minQuantity>72</minQuantity>
            <discountCode>R</discountCode>
          </PartPrice>
        </Part>
        <!-- More parts... -->
      </Configuration>
    </GetConfigurationAndPricingResponse>
  </soap:Body>
</soap:Envelope>
```

#### Parsed JSON Response (Success)
```json
{
  "prices": [
    {
      "partId": "B22035597",
      "price": 5.84,
      "minQty": 12,
      "discountCode": "R",
      "effectiveDate": "2024-01-01",
      "expiryDate": "2024-12-31"
    },
    {
      "partId": "B22035597",
      "price": 5.60,
      "minQty": 72,
      "discountCode": "R",
      "effectiveDate": "2024-01-01",
      "expiryDate": "2024-12-31"
    }
  ]
}
```

### Error Responses

#### SOAP Fault (Authentication Error)
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Client</faultcode>
      <faultstring>Authentication failed</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>
```

#### PromoStandards Error (Product Not Found)
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetConfigurationAndPricingResponse>
      <ServiceMessageArray>
        <ServiceMessage>
          <code>100</code>
          <description>Product not found</description>
          <severity>Error</severity>
        </ServiceMessage>
      </ServiceMessageArray>
    </GetConfigurationAndPricingResponse>
  </soap:Body>
</soap:Envelope>
```

#### Empty Response (No Pricing Data)
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetConfigurationAndPricingResponse>
      <Configuration />
    </GetConfigurationAndPricingResponse>
  </soap:Body>
</soap:Envelope>
```

Parsed as:
```json
{
  "prices": [],
  "debugInfo": {
    "rawXmlSample": "[First 2000 chars of response]",
    "partBlocksFound": 0,
    "hasSoapFault": false,
    "hasPromoError": false
  }
}
```

---

## 5. Code File Locations

### Pricing Logic
- File: `/supabase/functions/_shared/live-wholesale-pricing.ts`
- Function: `getLiveWholesalePricing(vendor, productId, fobId)`

### Main PromoStandards Endpoint
- File: `/supabase/functions/promostandards-unified/index.ts`
- Lines 309-523: Product ID discovery and pricing logic

### Database Cache Table
- Table: `ss_catalog_pricing`
- Upsert on: `(company_id, part_number, quantity_min)`

---

## 6. Debug Console Logs

### What to Look For

#### Successful Pricing Request
```
[LivePricing] 📤 Sending request for productId: "996MR" | vendor: ssactivewear | fobId: NJ
[LivePricing] 📥 Response received for productId "996MR": 15234 bytes
[LivePricing] 📦 Found 36 Part blocks for productId "996MR"
[LivePricing] ✅ Successfully parsed 144 price entries for "996MR". Sample: {partId: "B22035597", price: 5.84, ...}
💰 Live wholesale pricing received: 144 price entries
💰 Total pricing data: 36 parts
💰 Cached 144 pricing entries to ss_catalog_pricing
```

#### Failed Pricing Request (Product Not Found)
```
[LivePricing] 📤 Sending request for productId: "INVALID123" | vendor: ssactivewear | fobId: NJ
[LivePricing] 📥 Response received for productId "INVALID123": 583 bytes
[LivePricing] 📦 Found 0 Part blocks for productId "INVALID123"
[LivePricing] ⚠️ Zero price results parsed for productId "INVALID123"
[LivePricing] ⚠️ Part blocks found: 0
[LivePricing] ⚠️ No Configuration block found in response
[LivePricing] ⚠️ No PartPrice tags found in response
```

#### Multiple Pricing Attempts
```
💰 Pricing API candidates to try (in order): [
  { id: "996MR", source: "style-number" },
  { id: "B996MR", source: "normalized-style" },
  { id: "B22035", source: "inventory-discovery" }
]
💰 First pricing attempt returned 0 results, trying alternative IDs...
💰 Trying pricing candidate 2/3: B996MR (normalized-style)
💰 No results with B996MR, continuing...
💰 Trying pricing candidate 3/3: B22035 (inventory-discovery)
💰 SUCCESS with B22035: 144 price entries
```

---

## 7. Common Issues and Solutions

### Issue 1: Empty Pricing Response
**Symptoms:** `prices: []`, `partBlocksFound: 0`

**Possible Causes:**
1. Wrong product ID format (use discovery process)
2. Product not available through PromoStandards API
3. FOB warehouse not supported for this product
4. Account doesn't have pricing access

**Solution:**
- Check console logs for product ID discovery results
- Try different FOB warehouses ("NJ", "CA", "NV")
- Verify account has PromoStandards Pricing API access
- Some products only available via direct API, not PromoStandards

### Issue 2: Authentication Failed
**Symptoms:** `hasSoapFault: true`, `faultstring: "Authentication failed"`

**Possible Causes:**
1. Incorrect account number
2. Incorrect API key
3. Credentials not properly XML-escaped
4. Account doesn't have PromoStandards access

**Solution:**
- Verify credentials in `company_settings` table
- Check decryption is working properly
- Ensure credentials are XML-escaped (handled automatically)

### Issue 3: Wrong Product ID
**Symptoms:** Product found but pricing empty

**Solution:**
The system now auto-discovers the correct internal product ID through:
1. Inventory API (tries multiple style variations)
2. Product Data API (extracts from partId values)
3. Multiple pricing attempts with different ID formats

Check console logs for discovery process results.

---

## 8. Testing Checklist

- [ ] Verify account number and API key are correct
- [ ] Check FOB warehouse setting (`ssactivewear_fob_id`)
- [ ] Confirm `ssactivewear_enabled = true` in company settings
- [ ] Test with known working style number (e.g., "996MR" for Jerzees, "2000" for Gildan)
- [ ] Check console logs for product ID discovery attempts
- [ ] Verify pricing attempts and which ID format worked
- [ ] Confirm cache is being populated in `ss_catalog_pricing` table
- [ ] Test with different FOB warehouses if pricing empty

---

## 9. API Call Example

### JavaScript/TypeScript
```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/promostandards-unified?styleNumber=996MR&verbose=true`,
  {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    }
  }
);

const data = await response.json();
console.log('Pricing Data:', data.pricing);
console.log('Debug Info:', data.debug);
```

### Response Debug Fields
```json
{
  "debug": {
    "usedPricingId": "996MR",
    "usedPricingSource": "style-number",
    "pricingAttempts": [
      { "id": "996MR", "source": "style-number", "resultCount": 144 },
      { "id": "B996MR", "source": "normalized-style", "resultCount": 0 }
    ],
    "internalProductId": "B22035",
    "internalIdSource": "inventory-discovery",
    "pricingSource": "live",
    "livePricingCount": 144,
    "pricingDebugInfo": null
  }
}
```

---

## Summary

The wholesale pricing system uses a multi-step discovery process to find the correct product ID format for S&S ActiveWear's Pricing API. It tries multiple style variations through the Inventory API first, extracts internal product IDs from partId values, then attempts pricing with different ID formats in order of likelihood. All requests use proper SOAP formatting with XML-escaped credentials and company-specific FOB warehouse settings.
