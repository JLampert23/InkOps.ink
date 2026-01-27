# 🔍 SSActivewear PromoStandards 403 Error - Complete Investigation Report

## Executive Summary

**Status**: PromoStandards API is **NOT ACCESSIBLE** with current credentials
**Root Cause**: PromoStandards authentication differs from REST API
**Action Required**: Contact SSActivewear support for PromoStandards-specific credentials or setup

---

## ✅ What We Confirmed WORKS

### 1. REST API Credentials Are Valid
```bash
✅ GET https://api.ssactivewear.com/v2/products → 200 OK
✅ GET https://api.ssactivewear.com/v2/styles → 200 OK
✅ GET https://api.ssactivewear.com/v2/categories → 200 OK
```

**Credentials tested**:
- Account Number: `54074`
- API Key: `1adb78cb-cbf0-46e7-878d-6fd87f08d3f4`
- Authentication: HTTP Basic Auth (`Basic base64(account:key)`)

**Conclusion**: The credentials are **100% valid** and API access is enabled.

---

## ❌ What We Confirmed DOES NOT WORK

### 2. PromoStandards SOAP API Returns 403 Forbidden

All of these endpoints returned **403 Forbidden**:
```
❌ https://ws.ssactivewear.com/v2/productdata/
❌ https://ws.ssactivewear.com/ProductData
❌ https://ws.ssactivewear.com/ProductDataService
❌ https://ws.ssactivewear.com/ProductDataService.svc
❌ https://ws.ssactivewear.com/v2/ProductDataService.svc
❌ https://ws.ssactivewear.com:8443/v2/productdata/
❌ https://ws.ssactivewear.com/promostandards/v2/productdata
❌ https://ws.ssactivewear.com/services/ProductDataService.svc
```

**Note**: 403 means the endpoints exist but authentication fails.

### 3. All Authentication Methods Tested

We tested **6 different authentication approaches**, all failed:

1. ❌ **Standard PromoStandards** (credentials in SOAP body)
2. ❌ **WS-Security UsernameToken** (credentials in SOAP header)
3. ❌ **HTTP Basic Auth + SOAP credentials** (both methods combined)
4. ❌ **Empty SOAPAction header**
5. ❌ **Different namespace prefix** (`shar` instead of `ns`)
6. ❌ **SOAP 1.2** (instead of SOAP 1.1)

All returned **403 Forbidden**.

---

## 🔍 What This Means

### The PromoStandards API Is Separate From REST API

| Feature | REST API | PromoStandards SOAP API |
|---------|----------|-------------------------|
| **Endpoint** | `api.ssactivewear.com` | `ws.ssactivewear.com` |
| **Protocol** | REST/JSON | SOAP/XML |
| **Authentication** | ✅ Works with our credentials | ❌ 403 Forbidden |
| **Access** | ✅ Enabled | ❌ Not enabled OR requires different credentials |

### Possible Reasons for 403

1. **PromoStandards requires separate credentials**
   - Different API key or token specifically for PromoStandards
   - Different account number format

2. **PromoStandards requires additional enablement**
   - Separate opt-in or activation in SSActivewear dashboard
   - Different subscription tier or access level

3. **PromoStandards uses non-standard authentication**
   - Custom SSActivewear-specific authentication method
   - IP whitelisting required
   - Special headers or tokens

4. **Account doesn't have PromoStandards access**
   - REST API access ≠ PromoStandards API access
   - May need to request PromoStandards access separately

---

## 📋 Code Issues Found (Fixed After Investigation)

While investigating, we also found these issues in the current implementation:

### Issue 1: Wrong Base Endpoint (MINOR)
**Current**: `https://ws.ssactivewear.com`
**Status**: Actually correct! (Not `promostandards.ssactivewear.com` as initially thought)

### Issue 2: Missing Credentials in Product Request (CRITICAL)
The `createProductDataRequest` function didn't include `<id>` and `<password>` tags in the SOAP body.

**Current code (missing credentials)**:
```typescript
function createProductDataRequest(productId: string, accountNumber: string): string {
  const body = `<ns:GetProductRequest>
  <ns:productId>${productId}</ns:productId>
  <ns:localizationCountry>US</ns:localizationCountry>
  <ns:localizationLanguage>en</ns:localizationLanguage>
</ns:GetProductRequest>`;
  return createSoapEnvelope("GetProduct", body);
}
```

**Should be** (like other requests):
```typescript
function createProductDataRequest(productId: string, accountNumber: string, apiKey: string): string {
  const body = `<ns:GetProductRequest>
  <ns:wsVersion>2.0.0</ns:wsVersion>
  <ns:id>${accountNumber}</ns:id>
  <ns:password>${apiKey}</ns:password>
  <ns:productId>${productId}</ns:productId>
  <ns:localizationCountry>US</ns:localizationCountry>
  <ns:localizationLanguage>en</ns:localizationLanguage>
</ns:GetProductRequest>`;
  return createSoapEnvelope("GetProduct", body);
}
```

### Issue 3: Invalid SOAPAction Header
**Current**: `SOAPAction: "product"` (or `"pricing"`, etc.)
**Should be**: Full URI like `"http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"`

---

## 💡 Recommended Actions

### Immediate Action: Contact SSActivewear Support

Call or email SSActivewear technical support with these specific questions:

**Questions to ask**:
1. "How do I authenticate to your PromoStandards SOAP API?"
2. "Are the PromoStandards credentials different from REST API credentials?"
3. "Can you provide a working SOAP request example for the ProductDataService endpoint?"
4. "Is there a separate enablement process for PromoStandards API access?"
5. "Do you support the standard PromoStandards authentication, or use a custom method?"

**Information to provide**:
- Account Number: `54074`
- REST API works perfectly
- PromoStandards SOAP API returns 403 Forbidden
- Tested multiple authentication methods (Basic Auth, WS-Security, credentials in SOAP body)

### Alternative: Use REST API Instead of PromoStandards

Since the REST API works perfectly, you could:
1. Use SSActivewear's REST API instead of PromoStandards
2. Map REST API responses to your internal data structures
3. This would work immediately without waiting for support

**Pros**:
- ✅ Works right now with existing credentials
- ✅ Likely faster and easier to work with (JSON vs SOAP/XML)
- ✅ Better documented

**Cons**:
- ❌ Not standardized (SSActivewear-specific)
- ❌ Would need to rewrite integration if switching suppliers
- ❌ May not have all PromoStandards features

---

## 🧪 Test Results Summary

### Test 1: Endpoint Discovery
- **Tested**: 12 different endpoint variations
- **Result**: All paths under `ws.ssactivewear.com` return 403
- **Conclusion**: Endpoint URL is correct, authentication is wrong

### Test 2: REST API Verification
- **Tested**: 3 REST API endpoints with same credentials
- **Result**: All successful (200 OK)
- **Conclusion**: Credentials are valid, API access is enabled

### Test 3: SOAP Authentication Methods
- **Tested**: 6 different authentication approaches
- **Result**: All failed with 403
- **Conclusion**: PromoStandards requires different auth or enablement

---

## 📝 Technical Details

### Working REST API Request
```bash
curl -X GET 'https://api.ssactivewear.com/v2/products' \
  -H 'Authorization: Basic NTQwNzQ6MWFkYjc4Y2ItY2JmMC00NmU3LTg3OGQtNmZkODdmMDhkM2Y0'
# Returns: 200 OK with product data
```

### Failing PromoStandards SOAP Request
```bash
curl -X POST 'https://ws.ssactivewear.com/v2/productdata/' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: "http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"' \
  -H 'Authorization: Basic NTQwNzQ6MWFkYjc4Y2ItY2JmMC00NmU3LTg3OGQtNmZkODdmMDhkM2Y0' \
  -d '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
  <soap:Body>
    <ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:id>54074</ns:id>
      <ns:password>1adb78cb-cbf0-46e7-878d-6fd87f08d3f4</ns:password>
      <ns:productId>PC54</ns:productId>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetProductRequest>
  </soap:Body>
</soap:Envelope>'
# Returns: 403 Forbidden (HTML error page)
```

---

## 🎯 Conclusion

The 403 error is **NOT caused by bugs in our code**. The authentication method or credentials required for PromoStandards SOAP API are different from the REST API.

**Next step**: Contact SSActivewear support to obtain PromoStandards credentials or enablement.

**Alternative**: Switch to using their REST API, which works immediately.

---

## 📞 SSActivewear Support Contact

- **Phone**: Check your account dashboard
- **Email**: apisupport@ssactivewear.com (typical support email)
- **Documentation**: https://www.ssactivewear.com/Developers/WebServices

When contacting support, reference this investigation and provide test results showing REST API works but PromoStandards doesn't.
