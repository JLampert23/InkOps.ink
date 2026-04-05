 # InkOps — Project Brief (Updated)

## What InkOps Is
A SaaS platform for the screen printing & embroidery industry.  
Built on **Bolt.new**, GitHub repo, **Supabase** backend, deployed via **Netlify**, domain on **GoDaddy**.

---

## DONE ✅

- Netlify connected to `InkOps-Production` branch
- `inkops.ink` domain live and pointing to Netlify
- GoDaddy DNS records added (A record + CNAME)
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` added to Netlify env vars
- Main branch merged into InkOps-Production
- Site is live at `inkops.ink`

---

## STILL TO DO 🔧

### 1. SanMar Images + Pricing (Current Task)
SanMar API connection works — style numbers and colors pulling fine.  
**Missing:** garment images and wholesale pricing not loading in mockup generator.  
S&S Activewear is the working reference — mirror its pattern for SanMar.

**Check this first before writing any code:**
> Open the project and find `sanmar-provider.ts` in the `src` folder.  
> Jamie already made commits — "Fix SanMar image parsing", "Updated sanmar-provider.ts"  
> Read what's already there before touching anything.  
> Also check how S&S Activewear (`ssactivewear-promostandards-service.ts`) handles images and pricing — mirror that exact pattern for SanMar.

**If data is missing — wire these two endpoints:**

#### Images → `getMediaContent`
```
PROD: https://ws.sanmar.com:8080/promostandards/MediaContentServiceBinding?wsdl
TEST: https://test-ws.sanmar.com:8080/promostandards/MediaContentServiceBinding?wsdl
```

**SOAP Request**
```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns="http://www.promostandards.org/WSDL/MediaService/1.0.0/"
  xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <soapenv:Header />
  <soapenv:Body>
    <ns:GetMediaContentRequest>
      <shar:wsVersion>1.1.0</shar:wsVersion>
      <shar:id>SanMarUsername</shar:id>
      <shar:password>SanMarPassword</shar:password>
      <shar:mediaType>Image</shar:mediaType>
      <shar:productId>K420</shar:productId>
    </ns:GetMediaContentRequest>
  </soapenv:Body>
</soapenv:Envelope>
```

**Image classType codes**
| ID | Name | Use for |
|---|---|---|
| 1004 | Swatch | Color swatch thumbnail |
| 1006 | Primary | Main product image |
| 1007 | Front | Front view |
| 1008 | Rear | Back view |
| 2001 | High | High-res — best for mockup generator |

#### Pricing → `getConfigurationAndPricing`
```
PROD: https://ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBinding?wsdl
TEST: https://test-ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBinding?wsdl
```

**SOAP Request**
```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/"
  xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <soapenv:Header />
  <soapenv:Body>
    <ns:GetConfigurationAndPricingRequest>
      <shar:wsVersion>1.0.0</shar:wsVersion>
      <shar:id>SanMarUsername</shar:id>
      <shar:password>SanMarPassword</shar:password>
      <shar:productId>K500</shar:productId>
      <shar:partId>240831</shar:partId>
      <shar:currency>USD</shar:currency>
      <shar:fobId>1</shar:fobId>
      <shar:priceType>Net</shar:priceType>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>EN</shar:localizationLanguage>
    </ns:GetConfigurationAndPricingRequest>
  </soapenv:Body>
</soapenv:Envelope>
```

**priceType:** `Net` = wholesale cost (what you want)

**Response fields to extract**
| Field | What it is |
|---|---|
| `partId` | Unique key — matches color/size variant |
| `price` | The wholesale price |
| `minQuantity` | Min qty for that price tier |

---

### 2. New Scope (Discuss Pricing with Jamie First)
These are beyond the original $250 scope — do not start until Jamie agrees on new budget:

- **Printavo removal** — strip all Printavo integration code from the codebase
- **Customer portal** — wildcard subdomain setup + custom domain verification per customer
- **Quote approval link** — build/fix quote approval flow
- **Clean production database** — fresh Supabase project for live site with no test data

---

## Auth Summary
| Call Type | Auth Fields |
|---|---|
| Standard SanMar calls | `sanMarCustomerNumber` + `sanMarUserName` + `sanMarUserPassword` |
| PromoStandards calls | `id` (username) + `password` only |

---

## Branch Workflow
| Branch | Purpose | Deployed to |
|---|---|---|
| `main` | Jamie's bolt.new work | Nothing (dev only) |
| `InkOps-Production` | Your code work | `inkops.ink` via Netlify |

**Rule:** Never merge company/test data into production. Only merge SaaS code.  
When Jamie wants his bolt.new changes live → merge main into InkOps-Production.
