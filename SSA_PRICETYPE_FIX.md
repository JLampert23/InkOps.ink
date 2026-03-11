# SSActivewear Price Type Fix - "Customer" vs "Net"

## Issue
SSActivewear PromoStandards API was returning 500 errors for PPC (Pricing and Configuration) requests because we were using `priceType: "Net"` instead of `priceType: "Customer"`.

## Root Cause
Per S&S Activewear IT Department's official SOAP documentation (screenshot provided), the correct value for the `<shar:priceType>` field is **"Customer"**, not "Net".

Reference SOAP Request (from S&S IT):
```xml
<shar:priceType>Customer</shar:priceType>
```

## Changes Made

### 1. Edge Function: `promostandards-unified/index.ts`
**File:** `/supabase/functions/promostandards-unified/index.ts`
**Lines:** 231-237

Changed default priceType from "Net" to "Customer":
```typescript
// BEFORE:
const rawPriceType = settings.ssactivewear_price_type || 'Net';
const priceType = validPriceTypes.includes(rawPriceType) ? rawPriceType : 'Net';

// AFTER:
// Per S&S IT Department: priceType should be "Customer" (confirmed via official SOAP examples)
const rawPriceType = settings.ssactivewear_price_type || 'Customer';
const priceType = validPriceTypes.includes(rawPriceType) ? rawPriceType : 'Customer';
```

### 2. Frontend: `AccountSettings.tsx`
**File:** `/src/components/AccountSettings.tsx`

#### Change 1: Default value when loading settings (Line 569)
```typescript
// BEFORE:
setSsaPriceType((companySettings as any).ssactivewear_price_type || 'Net');

// AFTER:
// Per S&S IT Department: priceType should be "Customer" (confirmed via official SOAP examples)
setSsaPriceType((companySettings as any).ssactivewear_price_type || 'Customer');
```

#### Change 2: Validation fallback (Line 1780)
```typescript
// BEFORE:
const normalizedPriceType = validPriceTypes.includes(ssaPriceType) ? ssaPriceType : 'Net';

// AFTER:
// Per S&S IT Department: priceType should be "Customer" (confirmed via official SOAP examples)
const normalizedPriceType = validPriceTypes.includes(ssaPriceType) ? ssaPriceType : 'Customer';
```

### 3. Database Migration
Updated all existing company_settings records to use "Customer" instead of "Net":

```sql
UPDATE company_settings
SET ssactivewear_price_type = 'Customer'
WHERE ssactivewear_price_type = 'Net'
   OR ssactivewear_price_type IS NULL;
```

**Result:** 10 records updated

## Deployment
- ✅ Edge function `promostandards-unified` deployed successfully
- ✅ Frontend build completed successfully
- ✅ Database records updated

## Impact
- **Existing customers:** Automatically updated to use "Customer" price type
- **New customers:** Will default to "Customer" automatically
- **API calls:** PromoStandards PPC API will now accept requests and return pricing successfully
- **No breaking changes:** The system still supports all valid price types (Net, Customer, Blank, EQP, List)

## Testing
To verify the fix:
1. Go to Account Settings → Supplier Integrations → SSActivewear
2. Verify that Price Type shows "Customer" (or manually select it)
3. Use the product search to look up an SSActivewear style
4. Click "Test PPC" to verify pricing is returned without 500 errors

## Notes
- The valid price types remain: `['Net', 'Customer', 'Blank', 'EQP', 'List']`
- "Customer" is now the recommended default per S&S IT Department
- All code comments reference the official S&S IT documentation
