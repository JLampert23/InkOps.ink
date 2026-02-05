# Supplier API 401 Error Troubleshooting Guide

## Problem
Product search is returning 401 (Unauthorized) errors from both SSActivewear and SanMar APIs:

```
Product search errors:
- 'Style PC54 not found in local cache. SSActivewear API returned 401'
- 'SanMar API: API returned 401'
```

## What 401 Means
A 401 error means "Unauthorized" - the API credentials are being rejected. This typically happens when:

1. **Credentials are incorrect** - Wrong username/password/API key
2. **Credentials expired** - The API key or password has expired
3. **Account doesn't have API access** - The account isn't enabled for API usage
4. **IP restrictions** - Your IP address isn't whitelisted (less common)

## Current Status

### Database Check
```sql
-- Company ID: 5f36fe64-8b67-4b62-a023-29590da87c41
SSActivewear: Enabled ✓  | API Key: SET ✓
SanMar:       Enabled ✓  | Username: 89686 ✓ | Password: SET ✓
```

Both integrations are enabled and have credentials stored, but both are returning 401 errors. This strongly suggests the credentials themselves are incorrect.

## Resolution Steps

### 1. Verify SSActivewear Credentials

**Where to get credentials:**
- Login to: https://www.ssactivewear.com/
- Go to: Account → API Settings
- Copy your API Key

**How to update in InkOps:**
1. Go to **Account Settings** in InkOps
2. Find **SSActivewear Integration** section
3. Re-enter your API Key
4. Click **Save**

**Test the credentials:**
- Try searching for a style number (e.g., "64000")
- If successful, you'll see products appear
- If still 401, the API key is still incorrect

### 2. Verify SanMar Credentials

**Where to get credentials:**
- Login to: https://www.sanmar.com/
- Go to: My Account → API Access
- Note your:
  - Account Number (currently: 89686)
  - Username (currently: 89686)
  - Password

**Common SanMar Issues:**
- **Account Number ≠ Username** - They might be different
- **Password expired** - SanMar passwords may need periodic updates
- **API not enabled** - Your account must have API access activated
- **Wrong credentials format** - No spaces, special characters handled correctly

**How to update in InkOps:**
1. Go to **Account Settings**
2. Find **SanMar Integration** section
3. Re-enter:
   - Account Number
   - Username
   - Password
4. Click **Save**

**Test the credentials:**
- Try searching for a SanMar style (e.g., "PC54", "5000")
- If successful, you'll see products appear
- If still 401, credentials are still incorrect

### 3. Contact Supplier Support

If credentials are correct but still getting 401:

**SSActivewear Support:**
- Phone: 1-800-627-8309
- Email: custserv@ssactivewear.com
- Ask: "My API key returns 401 errors. Can you verify my account has API access?"

**SanMar Support:**
- Phone: 1-800-426-6399
- Email: techsupport@sanmar.com
- Ask: "My PromoStandards API credentials return 401 errors. Can you verify my account has API access?"

### 4. Check Account Status

Both suppliers may require:
- ✓ Active account (not suspended)
- ✓ API access enabled (not all accounts have this)
- ✓ Minimum account age or order history
- ✓ Specific account type (wholesale, decorator, etc.)

## Technical Details

### Authentication Methods

**SSActivewear:**
- Uses: REST API with API Key authentication
- Header: `Authorization: {API_KEY}`
- Endpoint: `https://api.ssactivewear.com/v2/`

**SanMar:**
- Uses: SOAP/PromoStandards with Basic Auth
- Headers:
  - `Authorization: Basic {base64(username:password)}`
  - SOAP body also includes `<id>` and `<password>` elements
- Endpoint: `https://api.sanmar.com/ps/`

### How Credentials Are Stored

1. **Encryption**: All credentials are encrypted before storage
2. **Table**: `company_settings` table
3. **Columns**:
   - SSActivewear: `ssactivewear_api_key_encrypted`
   - SanMar: `sanmar_username`, `sanmar_password_encrypted`, `sanmar_account_number`

### How Authentication Works

```
User searches for product
↓
product-search edge function
↓
Check if style in cache
↓
If not cached or needs enrichment:
  ↓
  Fetch from company_settings
  ↓
  Decrypt credentials via crypto-service
  ↓
  Call supplier API with credentials
  ↓
  ← 401 Unauthorized (Current Issue)
```

## Debugging Tools

### Test SSActivewear API Directly

```bash
# Replace with your actual API key
curl -X GET "https://api.ssactivewear.com/v2/products?style=64000" \
  -H "Authorization: YOUR_API_KEY"
```

**Expected:**
- Status 200: Credentials work ✓
- Status 401: Credentials invalid ✗

### Test SanMar API Directly

```bash
# Replace with your actual credentials
curl -X POST "https://api.sanmar.com/ps/ProductDataService.svc" \
  -H "Content-Type: text/xml" \
  -H "SOAPAction: getProduct" \
  -H "Authorization: Basic $(echo -n 'USERNAME:PASSWORD' | base64)" \
  -d '<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
      <shar:wsVersion xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">2.0.0</shar:wsVersion>
      <shar:id xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">USERNAME</shar:id>
      <shar:password xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">PASSWORD</shar:password>
      <shar:productId xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">PC54</shar:productId>
    </ns2:GetProductRequest>
  </soap:Body>
</soap:Envelope>'
```

**Expected:**
- Status 200: Credentials work ✓
- Status 401: Credentials invalid ✗

## Quick Fix Checklist

- [ ] Go to Account Settings in InkOps
- [ ] Re-enter SSActivewear API Key
- [ ] Re-enter SanMar Username and Password
- [ ] Click Save
- [ ] Test product search for style "64000" (SSActivewear)
- [ ] Test product search for style "PC54" (SanMar)
- [ ] If still 401, contact supplier support
- [ ] Verify account has API access enabled

## Temporary Workaround

While fixing credentials:

1. **Disable problematic integrations:**
   - Go to Account Settings
   - Uncheck "Enable SSActivewear" or "Enable SanMar"
   - Save settings
   - This will prevent 401 errors from appearing

2. **Use internal catalog only:**
   - Product search will use cached data only
   - No live pricing or inventory
   - No new products until credentials fixed

## After Fixing

Once credentials are updated:

1. **Test product search:**
   - Search for a few style numbers
   - Verify products appear
   - Check pricing is loading
   - Verify inventory shows

2. **Sync catalogs:**
   - SSActivewear: Products sync automatically when searched
   - SanMar: FTP sync runs daily at 2 AM
   - Manual sync: Go to Account Settings → Force Catalog Sync

3. **Monitor for issues:**
   - Watch for any 401 errors in console
   - Check that pricing updates
   - Verify inventory is current

## Summary

**Problem:** Both supplier APIs returning 401 errors
**Cause:** Stored credentials are incorrect or expired
**Solution:** Re-enter credentials in Account Settings
**Test:** Search for products to verify fix
**Support:** Contact suppliers if issue persists

The SanMar search provider integration is working correctly - it's just waiting for valid credentials to be configured.
