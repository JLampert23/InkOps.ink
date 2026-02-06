# Checking SSActivewear Credentials

## Current Situation
- Account Number stored: `54074` ✓
- API Key stored: **encrypted** (cannot verify directly)
- Getting 403 error from SSActivewear API

## What the Logs Should Show

Based on the edge function code (lines 363-371), the function logs:
- `accountNumber`: The account number being used
- `apiKeyLength`: Length of the decrypted API key
- `apiKeyPrefix`: First 10 characters of the decrypted API key

## How to Verify Credentials

### Option 1: Check Supabase Edge Function Logs
1. Go to https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac/logs/edge-functions
2. Look for the most recent `ssactivewear-api` function call
3. Check the log entry for "Making SSActivewear PromoStandards request"
4. Verify:
   - `accountNumber`: Should be `54074`
   - `apiKeyPrefix`: Should start with `1adb78cb-c`
   - `apiKeyLength`: Should be `36` (UUID format)

### Option 2: Re-save Credentials in the App
The safest way to ensure credentials are correct:

1. **Log into the app**
2. **Go to Account Settings → Supplier Integrations**
3. **Toggle OFF SSActivewear** (to clear old credentials)
4. **Toggle ON SSActivewear**
5. **Enter credentials:**
   - Account Number: `54074`
   - API Key: `1adb78cb-cbf0-46e7-878d-6fd87f08d3f4`
6. **Click "Save Supplier Integrations"**
7. **Click "Test Connection"**

## Expected API Key Format
- UUID format: `1adb78cb-cbf0-46e7-878d-6fd87f08d3f4`
- Length: 36 characters (including dashes)
- Format: 8-4-4-4-12 hexadecimal digits

## Possible Issues

### 1. Wrong API Key Stored
If `apiKeyPrefix` in logs doesn't match `1adb78cb-c`, the wrong key is stored.

### 2. PromoStandards API Not Enabled
SSActivewear has TWO types of API access:
- **Regular API** - For their REST/GraphQL API
- **PromoStandards API** - For SOAP-based PromoStandards protocol

This integration uses **PromoStandards API**. You must:
- Contact SSActivewear support
- Request PromoStandards API access
- Confirm it's enabled for account `54074`

### 3. Test Product Not Accessible
Product `PC54` might not be:
- Available in your account's catalog
- A valid PromoStandards product ID

Ask SSActivewear support for a valid test product ID for PromoStandards API.

## Next Steps
1. Check Supabase logs to see what API key is being used
2. If it doesn't match `1adb78cb-cbf0-46e7-878d-6fd87f08d3f4`, re-save credentials
3. Contact SSActivewear to verify PromoStandards API access
4. Get a valid test product ID for your account
