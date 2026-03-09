# 🔍 SSActivewear PromoStandards 403 Error Investigation Report

## 🚨 Critical Issues Found

### 1. **INCORRECT BASE ENDPOINT** ❌
**Current (Line 10):**
```typescript
const PROMO_STANDARDS_BASE = "https://ws.ssactivewear.com";
```

**Issue:** The user confirmed the endpoint should be `https://promostandards.ssactivewear.com`, but we're using `ws.ssactivewear.com`.

**Impact:** Requests are being sent to the wrong server, which likely doesn't support PromoStandards at all.

---

### 2. **Missing Credentials in Product Request SOAP Body** ❌
**Current (Lines 29-35):**
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

**Issue:** The `accountNumber` parameter is accepted but NEVER USED in the SOAP body. The product request has no `<ns:id>` or `<ns:password>` fields.

**Compare with working requests:**
- Pricing Request (line 41): `<ns:id>${accountNumber}</ns:id>`
- Inventory Request (line 53): `<ns:id>${accountNumber}</ns:id>`
- Media Request (line 64): `<ns:id>${accountNumber}</ns:id>`

**Impact:** SSActivewear cannot authenticate the request because credentials are missing from the SOAP body.

---

### 3. **HTTP Basic Auth May Not Be Required** ⚠️
**Current (Lines 361, 377):**
```typescript
const basicAuth = btoa(`${credentials.accountNumber}:${decryptedApiKey}`);
...
"Authorization": `Basic ${basicAuth}`,
```

**Question:** Does SSActivewear PromoStandards API actually use HTTP Basic Auth, or only credentials in the SOAP body?

**Standard PromoStandards implementations typically:**
- Use credentials ONLY in the SOAP body (`<id>` and `<password>` tags)
- Do NOT use HTTP Basic Auth headers
- The Basic Auth might be interfering or being rejected

---

### 4. **Namespace Conflicts in SOAP Envelope** ⚠️
**Current (Lines 17-26):**
```typescript
function createSoapEnvelope(action: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
  <soap:Header>
    <ns:wsVersion>2.0.0</ns:wsVersion>
  </soap:Header>
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
}
```

**Issue:** The envelope hardcodes `xmlns:ns` to ProductDataService 2.0.0, but:
- Pricing requests redefine it to PricingAndConfiguration 1.0.0 (line 39)
- Media requests redefine it to MediaService 1.0.0 (line 62)

**Impact:** Creates conflicting namespace declarations. Some parsers may reject this.

---

### 5. **Incorrect SOAPAction Header** ⚠️
**Current (Line 378):**
```typescript
"SOAPAction": action,
```

**Issue:** The `action` variable is just `"product"`, `"pricing"`, etc.

**Expected format:**
```
SOAPAction: "http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"
```

Or possibly quoted/double-quoted:
```
SOAPAction: ""http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct""
```

**Impact:** SSActivewear server may reject requests with malformed SOAPAction.

---

### 6. **wsVersion in Header May Not Be Standard** ⚠️
**Current (Lines 20-22):**
```xml
<soap:Header>
  <ns:wsVersion>2.0.0</ns:wsVersion>
</soap:Header>
```

**Standard PromoStandards implementations:**
- Put `<wsVersion>` in the BODY request, not the header
- See lines 40, 52, 63 where we correctly put it in the body for other requests

**Impact:** Non-standard header might be ignored or cause rejection.

---

## 📋 What's Actually Happening

When testing with `?action=product&productId=PC54`:

1. ✅ Auth token validated successfully
2. ✅ Company settings retrieved
3. ✅ Credentials decrypted
4. ❌ Request sent to **wrong endpoint**: `https://ws.ssactivewear.com/v2/productdata/`
5. ❌ SOAP body has **no credentials** (`id`/`password`)
6. ❌ HTTP Basic Auth header added (may not be needed/supported)
7. ❌ SOAPAction header is just `"product"` (should be full URI)
8. ❌ Result: **403 Forbidden**

---

## 🧪 Root Cause Analysis

The 403 is likely caused by a **combination** of:

1. **Wrong endpoint** - `ws.ssactivewear.com` vs `promostandards.ssactivewear.com`
2. **Missing credentials in SOAP body** - No `<id>` or `<password>` tags
3. **Possibly using Basic Auth when not supported** - Standard PromoStandards doesn't use it

---

## 🔧 Recommended Direct Test (Before Code Changes)

Create a raw SOAP test in Postman/SoapUI:

**Endpoint:** `https://promostandards.ssactivewear.com/v2/productdata/`
**Method:** POST
**Headers:**
```
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"
```

**Body (Option A - With Basic Auth):**
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
  <soap:Body>
    <ns:GetProductRequest>
      <ns:productId>PC54</ns:productId>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetProductRequest>
  </soap:Body>
</soap:Envelope>
```

Add Basic Auth header: `Authorization: Basic base64(54074:1adb78cb-cbf0-46e7-878d-6fd87f08d3f4)`

**Body (Option B - Credentials in SOAP):**
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
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
</soap:Envelope>
```

**Test both approaches to determine:**
1. Does the correct endpoint work?
2. Does it need Basic Auth or SOAP body credentials?
3. What is the correct SOAPAction format?

---

## 🎯 Next Steps

1. **Run the direct test above** to confirm which format SSActivewear expects
2. **Check SSActivewear's PromoStandards documentation** for their specific requirements
3. **Once confirmed**, I can fix the code with the correct:
   - Endpoint URL
   - Credential handling (Basic Auth vs SOAP body)
   - SOAPAction format
   - Namespace declarations

---

## 📌 Summary

The code has **multiple authentication and endpoint issues** that likely explain the 403:

| Issue | Severity | Impact |
|-------|----------|--------|
| Wrong base endpoint | 🔴 Critical | Sending to wrong server |
| Missing credentials in SOAP body | 🔴 Critical | No authentication |
| Possibly incorrect auth method | 🟡 High | May be using wrong auth |
| Invalid SOAPAction header | 🟡 High | May cause rejection |
| Namespace conflicts | 🟡 Medium | May cause parsing errors |

**Most likely culprit:** Wrong endpoint + missing credentials in SOAP body.
