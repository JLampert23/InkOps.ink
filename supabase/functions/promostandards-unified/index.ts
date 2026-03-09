import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getLiveWholesalePricing, type VendorConfig } from "../_shared/live-wholesale-pricing.ts";

const SSA_DEFAULT_FOB_ID = "NJ";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-User-Token",
};

const PROMOSTANDARDS_ENDPOINTS = {
  productData: "https://promostandards.ssactivewear.com/productdata/v2/productdataservicev2.svc",
  inventory: "https://promostandards.ssactivewear.com/inventory/v2/inventoryservice.svc",
  pricing: "https://promostandards.ssactivewear.com/PricingAndConfiguration/1.0.0/PricingAndConfigurationService.svc",
  media: "https://promostandards.ssactivewear.com/mediacontent/v1/mediacontentservice.svc",
};

async function makePromoStandardsRequest(
  endpoint: string,
  soapAction: string,
  soapBody: string
) {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    ${soapBody}
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": soapAction,
    },
    body: soapEnvelope,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`PromoStandards request failed: ${response.status} ${response.statusText}`);
  }

  return responseText;
}

function getXmlValue(xmlText: string, tagName: string): string | null {
  const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}[^>]*>([^<]*)</(?:[a-zA-Z0-9]+:)?${tagName}>`, 'i');
  const match = xmlText.match(regex);
  return match ? match[1] : null;
}

function getXmlValues(xmlText: string, tagName: string): string[] {
  const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}[^>]*>([^<]*)</(?:[a-zA-Z0-9]+:)?${tagName}>`, 'gi');
  const matches = xmlText.matchAll(regex);
  return Array.from(matches, m => m[1]);
}

function getAllXmlMatches(xmlText: string, pattern: RegExp): RegExpMatchArray[] {
  const matches = [];
  let match;
  while ((match = pattern.exec(xmlText)) !== null) {
    matches.push(match);
  }
  return matches;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeSsProductId(input: string): string {
  if (!input) return '';
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

Deno.serve(async (req: Request) => {
  console.log('🟢 Function invoked - verifyJWT is FALSE');

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    console.log('🚀 PromoStandards Unified - Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceRoleKey,
      hasAnonKey: !!supabaseAnonKey
    });

    const userToken = req.headers.get("X-User-Token") || "";
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "") || "";
    const isServiceRoleKey = bearerToken === supabaseServiceRoleKey;
    const token = isServiceRoleKey ? bearerToken : (userToken || bearerToken);

    if (!token) {
      console.error('❌ No authorization provided');
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('🔑 Auth token check:', {
      tokenLength: token.length,
      isServiceRoleKey,
      tokenPrefix: token.substring(0, 20) + '...'
    });

    let companyId: string;

    if (isServiceRoleKey) {
      // Internal call from another edge function - get company_id from query params
      const url = new URL(req.url);
      const companyIdParam = url.searchParams.get("companyId");
      if (!companyIdParam) {
        return new Response(
          JSON.stringify({ error: "Company ID required for service calls" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = companyIdParam;
      console.log('🔧 Service role call - using company_id:', companyId);
    } else {
      const jwtParts = token.split('.');
      if (jwtParts.length !== 3) {
        return new Response(
          JSON.stringify({ error: "Invalid JWT format" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let userId: string;
      try {
        const payload = JSON.parse(atob(jwtParts[1]));
        userId = payload.sub;
        console.log('✅ Decoded user ID from JWT:', userId);
      } catch (_e) {
        return new Response(
          JSON.stringify({ error: "Failed to decode JWT" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("company_id")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.company_id) {
        console.error('❌ No company_id found for user:', userId);
        return new Response(
          JSON.stringify({ error: "Company not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      companyId = profile.company_id;
      console.log('✅ User authenticated - company_id:', companyId);
    }

    // Use service role key for database queries
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('📋 Fetching company settings for company_id:', companyId);
    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("ssactivewear_enabled, ssactivewear_username, ssactivewear_api_key_encrypted, ssactivewear_fob_id")
      .eq("id", companyId)
      .maybeSingle();

    console.log('📋 Settings fetch result:', {
      hasSettings: !!settings,
      enabled: settings?.ssactivewear_enabled,
      hasUsername: !!settings?.ssactivewear_username,
      hasApiKey: !!settings?.ssactivewear_api_key_encrypted,
      fobId: settings?.ssactivewear_fob_id,
      error: settingsError
    });

    if (!settings?.ssactivewear_enabled || !settings?.ssactivewear_api_key_encrypted || !settings?.ssactivewear_username) {
      console.error('❌ SSActivewear credentials not configured or not enabled');
      return new Response(
        JSON.stringify({
          error: "SSActivewear credentials not configured",
          details: {
            enabled: settings?.ssactivewear_enabled,
            hasUsername: !!settings?.ssactivewear_username,
            hasApiKey: !!settings?.ssactivewear_api_key_encrypted
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = {
      accountNumber: settings.ssactivewear_username,
      apiKey: settings.ssactivewear_api_key_encrypted
    };

    console.log('🔐 Calling crypto-service to decrypt API key...');
    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        action: "decrypt",
        token: credentials.apiKey,
      }),
    });

    console.log('🔐 Crypto-service response:', decryptResponse.status);

    if (!decryptResponse.ok) {
      const errorText = await decryptResponse.text();
      console.error('❌ Failed to decrypt credentials:', errorText);
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decryptResult = await decryptResponse.json();
    console.log('🔐 Decryption successful');
    const decryptedApiKey = decryptResult.result;

    const url = new URL(req.url);
    const styleNumber = url.searchParams.get("styleNumber")?.trim();
    const partId = url.searchParams.get("partId")?.trim();
    const verbose = url.searchParams.get("verbose") === "true";

    if (!styleNumber) {
      return new Response(
        JSON.stringify({ error: "Style number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Unified PromoStandards Request:', { styleNumber, partId, verbose });

    // XML-escape credentials to prevent authentication issues
    const escapedAccountNumber = escapeXml(credentials.accountNumber);
    const escapedApiKey = escapeXml(decryptedApiKey);
    const escapedStyleNumber = escapeXml(styleNumber);
    const escapedPartId = partId ? escapeXml(partId) : '';

    // Store SOAP bodies for debugging
    const productSoap = `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${escapedAccountNumber}</shar:id>
  <shar:password>${escapedApiKey}</shar:password>
  <shar:productId>${escapedStyleNumber}</shar:productId>
</ns2:GetProductRequest>`;

    // S&S Activewear MediaContent uses raw style number (NOT B-prefixed like SanMar)
    // Clean the style number: uppercase, remove non-alphanumeric, strip any erroneous B prefix
    let cleanedStyleNumber = styleNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanedStyleNumber.startsWith('B') && cleanedStyleNumber.length > 1) {
      const afterB = cleanedStyleNumber.substring(1);
      // If it looks like an accidentally B-prefixed style, strip the B
      if (/[A-Z]/.test(afterB) || /^\d+$/.test(afterB)) {
        cleanedStyleNumber = afterB;
      }
    }
    const escapedCleanedStyleNumber = escapeXml(cleanedStyleNumber);

    const partIdTag = partId ? `\n  <shar:partId>${escapedPartId}</shar:partId>` : '';
    const mediaSoap = `<ns2:GetMediaContentRequest xmlns:ns2="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${escapedAccountNumber}</shar:id>
  <shar:password>${escapedApiKey}</shar:password>
  <shar:mediaType>Image</shar:mediaType>
  <shar:productId>${escapedCleanedStyleNumber}</shar:productId>${partIdTag}
</ns2:GetMediaContentRequest>`;

    // Build vendor config for live wholesale pricing
    const ssaVendorConfig: VendorConfig = {
      name: "ssactivewear",
      pricingEndpoint: PROMOSTANDARDS_ENDPOINTS.pricing,
      credentials: {
        id: credentials.accountNumber,
        password: decryptedApiKey,
      },
    };

    // CRITICAL FIX: S&S requires 6-character internal product IDs (e.g., "B22035" for "996MR")
    // We must discover this ID FIRST by calling Inventory API, which is more forgiving with raw style numbers
    // and returns partIds we can extract the internal ID from.
    let internalProductId: string | null = null;
    let internalIdSource = 'none';

    // STEP 0: Try to discover internal product ID from Inventory API first
    console.log('🔍 Step 0: Discovering internal product ID from Inventory API...');
    console.log('🔍 Trying style variations:', { raw: styleNumber, cleaned: cleanedStyleNumber });

    // Try multiple style number formats to discover the internal ID
    const styleVariations = [
      cleanedStyleNumber,                                                    // Raw cleaned style (e.g., "996MR")
      `B${cleanedStyleNumber}`,                                              // B-prefixed (e.g., "B996MR")
      cleanedStyleNumber.replace(/^0+/, ''),                                 // Strip leading zeros (e.g., "00760" -> "760")
      cleanedStyleNumber.match(/^\d+$/) ? cleanedStyleNumber.padStart(5, '0') : cleanedStyleNumber, // Pad to 5 digits if numeric
    ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

    for (const tryStyle of styleVariations) {
      const escapedTryStyle = escapeXml(tryStyle);
      const inventoryDiscoverySoap = `<ns2:GetInventoryLevelsRequest xmlns:ns2="http://www.promostandards.org/WSDL/Inventory/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${escapedAccountNumber}</shar:id>
  <shar:password>${escapedApiKey}</shar:password>
  <shar:productId>${escapedTryStyle}</shar:productId>
</ns2:GetInventoryLevelsRequest>`;

      try {
        console.log(`🔍 Trying Inventory discovery with style: ${tryStyle}`);
        const inventoryDiscoveryResponse = await makePromoStandardsRequest(
          PROMOSTANDARDS_ENDPOINTS.inventory,
          "getInventoryLevels",
          inventoryDiscoverySoap
        );

        // Extract partId from inventory response
        const partIdPattern = /<(?:[a-zA-Z0-9]+:)?partId[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?partId>/gi;
        const partIdMatches = Array.from(inventoryDiscoveryResponse.matchAll(partIdPattern), m => m[1].trim());

        if (partIdMatches.length > 0) {
          // Find first B-prefixed partId (e.g., "B00760033" or "B22035597")
          const bPrefixedPartId = partIdMatches.find(id => /^B\d{5,}/i.test(id));

          if (bPrefixedPartId) {
            // Extract ONLY first 6 characters as the internal pricing ID (e.g., "B22035")
            internalProductId = bPrefixedPartId.substring(0, 6).toUpperCase();
            internalIdSource = 'inventory-discovery';
            console.log(`✅ SUCCESS! Discovered internal ID from Inventory: ${tryStyle} -> partId ${bPrefixedPartId} -> ${internalProductId}`);
            break; // Found it! Stop trying other variations
          }
        }
      } catch (error) {
        console.log(`⚠️ Inventory discovery failed for ${tryStyle}:`, error);
        // Continue trying other variations
      }
    }

    if (!internalProductId) {
      console.log('❌ Failed to discover internal product ID from any style variation');
      console.log('⚠️ Will attempt Product Data API with raw style as fallback, but pricing may fail');
    }

    // Now use the discovered internal ID (or fallback to raw style) for Product Data
    const productIdToUse = internalProductId || escapedStyleNumber;
    console.log(`📦 Using productId for API calls: ${productIdToUse} (source: ${internalIdSource || 'raw-style-fallback'})`);

    // Update Product Data SOAP to use the correct internal ID
    const correctedProductSoap = `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${escapedAccountNumber}</shar:id>
  <shar:password>${escapedApiKey}</shar:password>
  <shar:productId>${productIdToUse}</shar:productId>
</ns2:GetProductRequest>`;

    // STEP 1: Fetch Product Data AND Media in parallel (using correct internal ID)
    console.log('📦 Step 1: Fetching Product Data and Media with corrected product ID...');

    const [productResponse, initialMediaResponse] = await Promise.allSettled([
      makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.productData,
        "getProduct",
        correctedProductSoap
      ),
      makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.media,
        "getMediaContent",
        mediaSoap
      ),
    ]);

    // If we still don't have an internal ID, try extracting from Product Data as last resort
    if (!internalProductId && productResponse.status === 'fulfilled' && productResponse.value) {
      console.log('🔍 Attempting to extract internal ID from Product Data response as fallback...');
      const xmlDoc = productResponse.value;
      const partIdPattern = /<(?:[a-zA-Z0-9]+:)?partId[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?partId>/gi;
      const partIdMatches = Array.from(xmlDoc.matchAll(partIdPattern), m => m[1].trim());

      if (partIdMatches.length > 0) {
        const bPrefixedPartId = partIdMatches.find(id => /^B\d{5,}/i.test(id));
        if (bPrefixedPartId) {
          internalProductId = bPrefixedPartId.substring(0, 6).toUpperCase();
          internalIdSource = 'product-data-fallback';
          console.log('✅ Extracted internal ID from Product Data:', bPrefixedPartId, '->', internalProductId);
        } else {
          console.log('📦 No B-prefixed partId found in Product Data. Sample partIds:', partIdMatches.slice(0, 3));
        }
      }
    }

    if (!internalProductId) {
      console.warn('📦 WARNING: Could not extract internal productId from Product Data partId values');
    }

    // STEP 2: Fetch Inventory and Pricing & Configuration
    console.log('📦 Step 2: Fetching Inventory and Pricing & Configuration...');

    // For inventory, use internal product ID (e.g., "B00760") to get all parts at once
    // Falls back to style number if internal ID not available
    const inventoryProductId = internalProductId || cleanedStyleNumber;
    const escapedInventoryProductId = escapeXml(inventoryProductId);

    // Get company-specific FOB warehouse (reuse from earlier)
    const fobWarehouseId = settings?.ssactivewear_fob_id || SSA_DEFAULT_FOB_ID;
    console.log('📦 Using FOB warehouse for pricing:', fobWarehouseId);

    // Use internal product ID for pricing (required by S&S)
    const pricingProductId = internalProductId || cleanedStyleNumber;
    const escapedPricingProductId = escapeXml(pricingProductId);

    const pricingSoap = `<ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${escapedAccountNumber}</shar:id>
  <shar:password>${escapedApiKey}</shar:password>
  <shar:productId>${escapedPricingProductId}</shar:productId>
  <shar:currency>USD</shar:currency>
  <shar:fobId>${fobWarehouseId}</shar:fobId>
  <shar:priceType>Customer</shar:priceType>
  <shar:localizationCountry>US</shar:localizationCountry>
  <shar:localizationLanguage>en</shar:localizationLanguage>
  <shar:configurationType>Blank</shar:configurationType>
</ns2:GetConfigurationAndPricingRequest>`;

    const [inventoryResponse, pricingResponse] = await Promise.allSettled([
      makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.inventory,
        "getInventoryLevels",
        `<ns2:GetInventoryLevelsRequest xmlns:ns2="http://www.promostandards.org/WSDL/InventoryService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${escapedAccountNumber}</shar:id>
  <shar:password>${escapedApiKey}</shar:password>
  <shar:productId>${escapedInventoryProductId}</shar:productId>
</ns2:GetInventoryLevelsRequest>`
      ),
      makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.pricing,
        "getConfigurationAndPricing",
        pricingSoap
      ),
    ]);

    // Pricing variables - will be populated from Pricing & Configuration or Product Data fallback
    let usedPricingId = pricingProductId;
    let usedPricingSource = 'pricing-and-configuration';
    let pricingDebugInfo: any = null;
    let pricingAttempts: { id: string; source: string; resultCount: number; debugInfo?: any }[] = [];

    const finalPricingResponse = pricingResponse;

    console.log('💰 PRICING RESPONSE DEBUG:', {
      status: finalPricingResponse.status,
      hasValue: !!finalPricingResponse.value,
      valuePreview: finalPricingResponse.status === 'fulfilled' && finalPricingResponse.value
        ? finalPricingResponse.value.substring(0, 500)
        : null,
      rejection: finalPricingResponse.status === 'rejected' ? finalPricingResponse.reason : null
    });

    console.log('📊 PromoStandards API Results:', {
      product: productResponse.status,
      inventory: inventoryResponse.status,
      pricing: finalPricingResponse.status,
      media: initialMediaResponse.status,
      usedPricingSource,
      usedPricingId,
      internalProductId,
      internalIdSource,
      productError: productResponse.status === 'rejected' ? productResponse.reason : null,
      inventoryError: inventoryResponse.status === 'rejected' ? inventoryResponse.reason : null,
      pricingError: finalPricingResponse.status === 'rejected' ? finalPricingResponse.reason : null,
      mediaError: initialMediaResponse.status === 'rejected' ? initialMediaResponse.reason : null,
    });

    // Parse Product Data
    const productData: any = {};
    if (productResponse.status === 'fulfilled' && productResponse.value) {
      const xmlDoc = productResponse.value;
      productData.productName = getXmlValue(xmlDoc, "productName") || "";
      productData.description = getXmlValue(xmlDoc, "description") || "";
      productData.productBrand = getXmlValue(xmlDoc, "productBrand") || "";

      // Extract all parts with colors and sizes
      const partPattern = /<(?:[a-zA-Z0-9]+:)?Part>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?Part>/gi;
      const partMatches = getAllXmlMatches(xmlDoc, partPattern);

      productData.parts = partMatches.map(match => {
        const partXml = match[1];
        return {
          partId: getXmlValue(partXml, "partId"),
          colorName: getXmlValue(partXml, "colorName"),
          labelSize: getXmlValue(partXml, "labelSize"),
          hex: getXmlValue(partXml, "hex"),
          approximatePmsColor: getXmlValue(partXml, "approximatePmsColor"),
        };
      });

      // Group parts by color
      const colorMap = new Map();
      productData.parts.forEach((part: any) => {
        if (!colorMap.has(part.colorName)) {
          colorMap.set(part.colorName, {
            colorName: part.colorName,
            hex: part.hex,
            approximatePmsColor: part.approximatePmsColor,
            partIds: []
          });
        }
        colorMap.get(part.colorName).partIds.push({
          partId: part.partId,
          size: part.labelSize
        });
      });

      productData.colors = Array.from(colorMap.values());
    }

    // Parse Inventory
    const inventoryData: any = {};
    if (inventoryResponse.status === 'fulfilled' && inventoryResponse.value) {
      const xmlDoc = inventoryResponse.value;
      const inventoryPattern = /<(?:[a-zA-Z0-9]+:)?Inventory>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?Inventory>/gi;
      const inventoryMatches = getAllXmlMatches(xmlDoc, inventoryPattern);

      inventoryData.items = inventoryMatches.map(match => {
        const invXml = match[1];
        return {
          partId: getXmlValue(invXml, "partId"),
          quantityAvailable: parseInt(getXmlValue(invXml, "quantityAvailable") || "0"),
          warehouseName: getXmlValue(invXml, "warehouseName"),
          postalCode: getXmlValue(invXml, "postalCode"),
        };
      });
    }

    // Parse Pricing from Pricing & Configuration 1.0.0
    const pricingData: any = {};
    let pricingAuthError: { code: string; description: string } | null = null;
    let usedCache = false;
    let usedBasePriceFallback = false;

    if (finalPricingResponse.status === 'fulfilled' && finalPricingResponse.value) {
      const xmlDoc = finalPricingResponse.value;
      console.log('💰 Pricing & Configuration XML Response received');

      // Check for SOAP errors
      const errorCodeMatch = xmlDoc.match(/<code>(\d+)<\/code>/);
      const errorDescMatch = xmlDoc.match(/<description>(.*?)<\/description>/);

      if (errorCodeMatch && errorDescMatch) {
        pricingAuthError = {
          code: errorCodeMatch[1],
          description: errorDescMatch[1]
        };
        console.error('💰 Pricing & Configuration API returned error:', pricingAuthError);
      } else {
        // Extract Part entries with pricing
        const partPattern = /<(?:[a-zA-Z0-9]+:)?Part>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?Part>/gi;
        const partMatches = getAllXmlMatches(xmlDoc, partPattern);

        console.log('💰 Found', partMatches.length, 'Part entries in Pricing & Configuration response');

        if (partMatches.length > 0) {
          const wholesalePrices: any[] = [];

          partMatches.forEach(match => {
            const partXml = match[1];
            const partId = getXmlValue(partXml, "partId");

            // Extract PartPrice entries for this part
            const partPricePattern = /<(?:[a-zA-Z0-9]+:)?PartPrice>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?PartPrice>/gi;
            const partPriceMatches = getAllXmlMatches(partXml, partPricePattern);

            partPriceMatches.forEach(priceMatch => {
              const priceXml = priceMatch[1];
              const minQuantity = parseInt(getXmlValue(priceXml, "minQuantity") || "1");
              const price = parseFloat(getXmlValue(priceXml, "price") || "0");
              const discountCode = getXmlValue(priceXml, "discountCode");

              if (partId && price > 0) {
                wholesalePrices.push({
                  partId: partId,
                  price: price,
                  minQty: minQuantity,
                  discountCode: discountCode,
                  effectiveDate: null,
                  expiryDate: null,
                  source: 'pricing-and-configuration'
                });
              }
            });
          });

          if (wholesalePrices.length > 0) {
            console.log('💰 Successfully extracted', wholesalePrices.length, 'wholesale prices from Pricing & Configuration');

            // Group by partId
            const partPricingMap = new Map<string, any[]>();
            wholesalePrices.forEach(item => {
              if (!partPricingMap.has(item.partId)) {
                partPricingMap.set(item.partId, []);
              }
              partPricingMap.get(item.partId)!.push({
                minQuantity: item.minQty,
                price: item.price,
                discountCode: item.discountCode,
                effectiveDate: item.effectiveDate,
                expiryDate: item.expiryDate,
              });
            });

            pricingData.parts = Array.from(partPricingMap.entries()).map(([partId, prices]) => ({
              partId,
              prices: prices.sort((a, b) => a.minQuantity - b.minQuantity)
            }));

            console.log('💰 Total wholesale pricing data:', pricingData.parts.length, 'parts');

            // Create a pricing map for easy lookup by partId
            pricingData.pricesByPartId = {};
            pricingData.parts.forEach((part: any) => {
              if (part.partId && part.prices && part.prices.length > 0) {
                pricingData.pricesByPartId[part.partId] = part.prices[0].price;
              }
            });
            console.log('💰 Wholesale price map created with', Object.keys(pricingData.pricesByPartId).length, 'entries');

            usedPricingSource = 'pricing-and-configuration';
            pricingAttempts.push({
              id: usedPricingId,
              source: 'pricing-and-configuration',
              resultCount: wholesalePrices.length
            });

            // Cache wholesale prices
            try {
              for (const item of wholesalePrices) {
                await supabase
                  .from('ss_catalog_pricing')
                  .upsert({
                    company_id: companyId,
                    part_number: item.partId,
                    unit_price: item.price,
                    quantity_min: item.minQty || 1,
                    quantity_max: 99999,
                    discount_code: item.discountCode || null,
                    price_expiry_date: item.expiryDate || null,
                  }, {
                    onConflict: "company_id,part_number,quantity_min"
                  });
              }
              console.log('💰 Cached', wholesalePrices.length, 'wholesale pricing entries to ss_catalog_pricing');
            } catch (cacheErr: any) {
              console.warn('💰 Failed to cache wholesale pricing:', cacheErr.message);
            }
          } else {
            console.warn('💰 No valid wholesale prices found in Pricing & Configuration response');
          }
        } else {
          console.warn('💰 No Part entries found in Pricing & Configuration response');
        }
      }
    }

    // FALLBACK: If Pricing & Configuration failed, try Product Data 2.0.0 base pricing
    if ((!pricingData.parts || pricingData.parts.length === 0) && productResponse.status === 'fulfilled' && productResponse.value) {
      console.log('💰 Pricing & Configuration unavailable, falling back to Product Data base pricing...');

      try {
        const xmlDoc = productResponse.value;

        const productPricePattern = /<(?:[a-zA-Z0-9]+:)?ProductPrice>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?ProductPrice>/gi;
        const productPriceMatches = getAllXmlMatches(xmlDoc, productPricePattern);

        if (productPriceMatches.length > 0) {
          console.log('💰 Found', productPriceMatches.length, 'ProductPrice entries in Product Data');

          const basePrices: any[] = [];

          productPriceMatches.forEach(match => {
            const priceXml = match[1];
            const partId = getXmlValue(priceXml, "partId");
            const quantityMin = parseInt(getXmlValue(priceXml, "quantityMin") || "1");
            const price = parseFloat(getXmlValue(priceXml, "price") || "0");

            if (partId && price > 0 && quantityMin === 1) {
              basePrices.push({
                partId: partId,
                price: price,
                minQty: quantityMin,
                discountCode: null,
                effectiveDate: null,
                expiryDate: null,
                source: 'base-product-data'
              });
            }
          });

          if (basePrices.length > 0) {
            console.log('💰 Successfully extracted', basePrices.length, 'base prices from Product Data');
            usedBasePriceFallback = true;
            usedPricingSource = 'base-product-data';

            const partPricingMap = new Map<string, any[]>();
            basePrices.forEach(item => {
              if (!partPricingMap.has(item.partId)) {
                partPricingMap.set(item.partId, []);
              }
              partPricingMap.get(item.partId)!.push({
                minQuantity: item.minQty,
                price: item.price,
                discountCode: item.discountCode,
                effectiveDate: item.effectiveDate,
                expiryDate: item.expiryDate,
              });
            });

            pricingData.parts = Array.from(partPricingMap.entries()).map(([partId, prices]) => ({
              partId,
              prices
            }));

            pricingData.pricesByPartId = {};
            pricingData.parts.forEach((part: any) => {
              if (part.partId && part.prices && part.prices.length > 0) {
                pricingData.pricesByPartId[part.partId] = part.prices[0].price;
              }
            });

            console.log('💰 Base price map created with', Object.keys(pricingData.pricesByPartId).length, 'entries');

            try {
              for (const item of basePrices) {
                await supabase
                  .from('ss_catalog_pricing')
                  .upsert({
                    company_id: companyId,
                    part_number: item.partId,
                    unit_price: item.price,
                    quantity_min: item.minQty || 1,
                    quantity_max: 99999,
                    discount_code: item.discountCode || null,
                    price_expiry_date: item.expiryDate || null,
                  }, {
                    onConflict: "company_id,part_number,quantity_min"
                  });
              }
              console.log('💰 Cached', basePrices.length, 'base pricing entries to ss_catalog_pricing');
            } catch (cacheErr: any) {
              console.warn('💰 Failed to cache base pricing:', cacheErr.message);
            }
          }
        }
      } catch (basePriceErr: any) {
        console.error('💰 Failed to extract base prices from Product Data:', basePriceErr.message);
      }
    }

    // FINAL FALLBACK: Check DB cache
    if (!pricingData.parts || pricingData.parts.length === 0) {
      console.warn('💰 No pricing from API, checking DB cache...');

      const partIds = productData.parts?.map((p: any) => p.partId).filter(Boolean) || [];

      if (partIds.length > 0) {
        const { data: cachedPricing } = await supabase
          .from('ss_catalog_pricing')
          .select('part_number, unit_price, quantity_min, quantity_max, discount_code')
          .eq('company_id', companyId)
          .in('part_number', partIds)
          .or(`price_expiry_date.gte.${new Date().toISOString().split('T')[0]},price_expiry_date.is.null`)
          .order('part_number')
          .order('quantity_min');

        if (cachedPricing && cachedPricing.length > 0) {
          usedCache = true;
          usedPricingSource = 'cache';

          const partPricingMap = new Map();
          cachedPricing.forEach(row => {
            if (!partPricingMap.has(row.part_number)) {
              partPricingMap.set(row.part_number, []);
            }
            partPricingMap.get(row.part_number).push({
              minQuantity: row.quantity_min,
              price: parseFloat(row.unit_price),
              discountCode: row.discount_code,
            });
          });

          pricingData.parts = Array.from(partPricingMap.entries()).map(([partId, prices]) => ({
            partId,
            prices
          }));

          pricingData.pricesByPartId = {};
          pricingData.parts.forEach((part: any) => {
            if (part.partId && part.prices && part.prices.length > 0) {
              pricingData.pricesByPartId[part.partId] = part.prices[0].price;
            }
          });

          console.log('💰 Using cached pricing:', pricingData.parts.length, 'parts');
        } else {
          console.warn('💰 No cached pricing found either');
        }
      }
    }

    // Parse Media Content from PromoStandards API only
    const mediaData: any = {};
    console.log('📸 Media Response Status:', initialMediaResponse.status);

    let mediaAuthError: { code: string; description: string } | null = null;

    if (initialMediaResponse.status === 'rejected') {
      console.error('📸 Media Request Failed:', initialMediaResponse.reason);
    }

    if (initialMediaResponse.status === 'fulfilled' && initialMediaResponse.value) {
      const xmlDoc = initialMediaResponse.value;
      console.log('📸 Media XML Response (first 1000 chars):', xmlDoc.substring(0, 1000));

      const errorCodeMatch = xmlDoc.match(/<code>(\d+)<\/code>/);
      const errorDescMatch = xmlDoc.match(/<description>(.*?)<\/description>/);

      if (errorCodeMatch && errorDescMatch) {
        if (!mediaAuthError) {
          mediaAuthError = {
            code: errorCodeMatch[1],
            description: errorDescMatch[1]
          };
        }
        console.error('📸 Media API returned error:', mediaAuthError);
      } else {
        const mediaPattern = /<(?:[a-zA-Z0-9]+:)?MediaContent>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?MediaContent>/gi;
        const mediaMatches = getAllXmlMatches(xmlDoc, mediaPattern);
        console.log('📸 MediaContent matches found:', mediaMatches.length);

        if (mediaMatches.length === 0) {
          console.warn('📸 MediaContentArray is empty. Full SOAP response:', xmlDoc);
        }

        // Parse all images from the response
        const allImages = mediaMatches.map(match => {
          const mediaXml = match[1];
          return {
            url: getXmlValue(mediaXml, "url"),
            productId: getXmlValue(mediaXml, "productId"),
            partId: getXmlValue(mediaXml, "partId"),
            classTypeName: getXmlValue(mediaXml, "classTypeName"),
            color: getXmlValue(mediaXml, "color"),
            singlePart: getXmlValue(mediaXml, "singlePart") === "true",
          };
        });

        const uniqueClassTypes = [...new Set(allImages.map(img => img.classTypeName).filter(Boolean))];
        console.log('📸 Total images parsed:', allImages.length, '| classTypeNames found:', uniqueClassTypes);

        let filteredImages = allImages;

        if (partId) {
          const selectedPart = productData.parts?.find((p: any) => p.partId === partId);
          const selectedColorName = selectedPart?.colorName?.toLowerCase()?.trim();
          console.log('📸 Resolving color for partId:', { partId, selectedColorName });

          if (selectedColorName) {
            filteredImages = allImages.filter(img =>
              img.color?.toLowerCase()?.trim() === selectedColorName
            );
            console.log('📸 Filtered by exact color name:', { selectedColorName, matchCount: filteredImages.length });

            if (filteredImages.length === 0) {
              const colorWords = selectedColorName.split(/[\s/]+/);
              filteredImages = allImages.filter(img => {
                const imgColor = img.color?.toLowerCase()?.trim();
                if (!imgColor) return false;
                const imgWords = imgColor.split(/[\s/]+/);
                const matching = colorWords.filter(w => w.length > 2 && imgWords.includes(w));
                return (matching.length * 2) / (colorWords.length + imgWords.length) >= 0.5;
              });
              console.log('📸 Filtered by fuzzy color name:', { selectedColorName, matchCount: filteredImages.length });
            }
          }

          if (filteredImages.length === 0) {
            filteredImages = allImages.filter(img => img.partId === partId);
            console.log('📸 Filtered by exact partId:', { partId, matchCount: filteredImages.length });
          }

          if (filteredImages.length === 0) {
            const colorPortion = partId.replace(/^[A-Z0-9]+-/, '').replace(/-[A-Z0-9]+$/, '').toLowerCase();
            if (colorPortion && colorPortion !== partId.toLowerCase()) {
              filteredImages = allImages.filter(img =>
                img.color?.toLowerCase()?.includes(colorPortion) ||
                img.partId?.toLowerCase()?.includes(colorPortion)
              );
              console.log('📸 Filtered by extracted color portion:', { colorPortion, matchCount: filteredImages.length });
            }
          }

          if (filteredImages.length === 0) {
            filteredImages = allImages.filter(img => img.singlePart === true);
            console.log('📸 Falling back to singlePart images:', { matchCount: filteredImages.length });
          }

          if (filteredImages.length === 0) {
            filteredImages = allImages;
            console.warn('📸 No color-specific images found, using all images');
          }
        }

        // EXTRACT ONLY Front/Rear/Side views from the filtered set
        const frontImg = filteredImages.find(img =>
          img.classTypeName?.toLowerCase() === 'front'
        );
        const rearImg = filteredImages.find(img =>
          img.classTypeName?.toLowerCase() === 'rear' ||
          img.classTypeName?.toLowerCase() === 'back'
        );
        // S&S uses inconsistent classTypeName values for side views
        const sideViewLabels = [
          'side', 'side view',
          'left', 'left side', 'left profile',
          'right', 'right side', 'right profile',
          'profile',
          'angle', 'angle view',
          'sleeve'
        ];
        const sideImg = filteredImages.find(img =>
          sideViewLabels.includes(img.classTypeName?.toLowerCase() || '')
        );

        // Store only the filtered images (for the selected color)
        mediaData.images = filteredImages;

        // Return ONLY front/rear/side for the selected color
        mediaData.views = {
          front: frontImg?.url || null,
          rear: rearImg?.url || null,
          side: sideImg?.url || null,
          lifestyle: null,
          frontImages: frontImg?.url ? [frontImg.url] : [],
          rearImages: rearImg?.url ? [rearImg.url] : [],
          sideImages: sideImg?.url ? [sideImg.url] : [],
          lifestyleImages: [],
          otherImages: [],
        };

        const filteredClassTypes = [...new Set(filteredImages.map(img => img.classTypeName?.toLowerCase()).filter(Boolean))];
        console.log('📸 Media Content organized (color-filtered):', {
          partId,
          totalFiltered: filteredImages.length,
          filteredClassTypes,
          front: frontImg?.classTypeName || null,
          rear: rearImg?.classTypeName || null,
          side: sideImg?.classTypeName || null,
          frontUrl: !!frontImg?.url,
          rearUrl: !!rearImg?.url,
          sideUrl: !!sideImg?.url,
        });
      }
    }

    // Determine pricing availability
    const hasPricing = pricingData.parts && pricingData.parts.length > 0;
    const pricingUnavailableReason = !hasPricing
      ? "This product is not available through S&S ActiveWear's PromoStandards Pricing API. Please enter pricing manually or contact your distributor."
      : null;

    // Return unified response
    return new Response(
      JSON.stringify({
        success: true,
        styleNumber,
        partId: partId || null,
        product: productData,
        inventory: inventoryData,
        pricing: {
          usedPricingSource,
          usedPricingId,
          pricingAttempts,
          parts: pricingData?.parts || [],
          pricesByPartId: pricingData?.pricesByPartId || {}
        },
        media: mediaData,
        pricingAvailable: hasPricing,
        pricingUnavailableReason,
        debug: {
          internalProductId,
          internalIdSource,
          mediaResponseStatus: initialMediaResponse.status,
          mediaXmlFull: verbose && initialMediaResponse.status === 'fulfilled' && initialMediaResponse.value
            ? initialMediaResponse.value
            : null,
          mediaError: initialMediaResponse.status === 'rejected' ? initialMediaResponse.reason?.toString() : null,
          mediaAuthError,
          pricingAuthError,
          pricingSource: usedPricingSource,
          pricingMethod: usedPricingSource === 'pricing-and-configuration' ? 'wholesale-pricing' : (usedBasePriceFallback ? 'base-product-data-fallback' : 'cache'),
          pricingPartsCount: pricingData.parts?.length || 0,
          pricingMapCount: pricingData.pricesByPartId ? Object.keys(pricingData.pricesByPartId).length : 0,
          usedBasePriceFallback,
          soapRequests: verbose ? {
            productDataRequest: productSoap,
            mediaRequest: mediaSoap,
          } : undefined,
          credentials: verbose ? {
            accountNumber: credentials.accountNumber,
            apiKeyLength: decryptedApiKey?.length,
          } : undefined
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Unified PromoStandards API error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
