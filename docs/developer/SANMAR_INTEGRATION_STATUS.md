# SanMar PromoStandards Integration - Complete

## What's Been Implemented

### 1. SOAP Client Module ✅
**Location:** `supabase/functions/_shared/sanmar-promostandards-client.ts`

A comprehensive PromoStandards SOAP client that implements:
- **Product Data Service** - Fetches style, parts, colors, sizes
- **Inventory Service** - Real-time inventory levels by part ID
- **Pricing Service** - Customer pricing with quantity breaks
- **Media Content Service** - Product images (front, back, side, lifestyle)

**Authentication:** Uses Basic Auth with SanMar username:password

### 2. Updated Edge Function ✅
**Location:** `supabase/functions/sanmar-api/index.ts`

Now supports multiple actions:
- `unified` - Fetches all data in parallel (recommended)
- `product` - Product data only
- `inventory` - Inventory for a specific part
- `pricing` - Pricing for a specific part
- `media` - Images for a style
- `search` - Legacy compatibility (same as unified)

### 3. Updated Product Search ✅
**Location:** `supabase/functions/product-search/index.ts`

The `transformSanMarData` function now properly:
- Parses PromoStandards unified response structure
- Extracts colors with part IDs and sizes
- Maps pricing data from the pricing service
- Maps inventory data from inventory service
- Assigns images from media service (front/lifestyle views)

### 4. Database Schema ✅
Company settings already has:
- `sanmar_account_number` - Account number
- `sanmar_username` - Username for API
- `sanmar_password_encrypted` - Encrypted password
- `sanmar_enabled` - Boolean flag to enable/disable

## Current Configuration

You have one company with SanMar enabled and credentials configured:
- Company: Todd's Screen Printing and Embroidery
- Account Number: ✓ Configured
- Username: ✓ Configured
- Password: ✓ Configured (encrypted)
- Status: ✓ Enabled

## API Endpoints

### SanMar API Direct
```
GET /functions/v1/sanmar-api?action=unified&style=PC54
GET /functions/v1/sanmar-api?action=product&style=PC54
GET /functions/v1/sanmar-api?action=inventory&style=PC54&partId=PC54_Black_S
GET /functions/v1/sanmar-api?action=pricing&style=PC54&partId=PC54_Black_S
GET /functions/v1/sanmar-api?action=media&style=PC54
```

### Unified Product Search
```
GET /functions/v1/product-search?style=PC54
```
This searches both SanMar and SSActivewear if both are enabled.

## Testing Steps

### 1. Test SanMar Connection
Try searching for a known SanMar style (e.g., Port & Company PC54):
```
https://your-project.supabase.co/functions/v1/sanmar-api?action=product&style=PC54
```

### 2. Test Unified Search
Search via the product-search endpoint:
```
https://your-project.supabase.co/functions/v1/product-search?style=PC54
```

### 3. Test from QuoteBuilder
1. Open the QuoteBuilder in your app
2. Click "Add Line Item"
3. Search for a SanMar style number (e.g., "PC54")
4. Verify colors, sizes, and images load correctly

## PromoStandards Endpoints Used

**Base URL:** `https://api.sanmar.com/ps/`

- Product Data: `ProductDataService.svc`
- Inventory: `InventoryService.svc`
- Pricing: `PricingAndConfigurationService.svc`
- Media: `MediaContentService.svc`

All requests use:
- SOAP 1.1 protocol
- Basic Authentication (username:password)
- XML request/response format

## Common SanMar Style Numbers to Test

- **PC54** - Port & Company Core Cotton Tee
- **PC61** - Port & Company Essential Tee
- **PC78** - Port & Company Core Fleece Pullover Hooded Sweatshirt
- **K100** - Port Authority Silk Touch Polo
- **ST650** - Sport-Tek Micropique Sport-Wick Polo

## Next Steps (Optional Enhancements)

### 1. Add Catalog Caching
Like SSActivewear, implement local caching:
- Create `sanmar_catalog_styles` table
- Create `sanmar_catalog_products` table
- Add daily sync cron job
- Cache product data locally for faster searches

### 2. Error Handling Improvements
- Add retry logic for failed SOAP requests
- Implement circuit breaker pattern
- Add more detailed error messages

### 3. Performance Monitoring
- Track API response times
- Monitor SOAP fault rates
- Log slow queries

### 4. Add Test Connection Button
In Account Settings, add "Test SanMar Connection" button similar to SSActivewear.

## Troubleshooting

### "SanMar credentials not configured"
- Check that username and password are set in Account Settings
- Verify the password is encrypted and stored properly

### "SOAP request failed: 401"
- Invalid credentials
- Check username/password in SanMar account
- Verify Basic Auth is working

### "No results found"
- Style number may not exist in SanMar catalog
- Try a different style number
- Check if style is available to your account

### Images not loading
- Some styles may not have images in PromoStandards
- Check the `media.views` object in the API response
- Verify image URLs are accessible

## Documentation References

- [SanMar Web Services Integration Guide v24.2](https://info.sanmar.com/medias/sys_master/root/h10/h4b/29316642504734/SanMar-Web-Services-Integration-Guide-24.2/SanMar-Web-Services-Integration-Guide-24.2.pdf)
- [SanMar Data Library](https://www.sanmar.com/resources/electronicintegration/sanmardatalibrary)
- [PromoStandards.org](https://www.promostandards.org/)
