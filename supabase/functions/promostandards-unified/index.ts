import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-User-Token",
};

const PROMOSTANDARDS_ENDPOINTS = {
  productData: "https://promostandards.ssactivewear.com/productdata/v2/productdataservicev2.svc",
  inventory: "https://promostandards.ssactivewear.com/inventory/v2/inventoryservice.svc",
  media: "https://promostandards.ssactivewear.com/mediacontent/v1/mediacontentservice.svc",
  pricingAndConfiguration: "https://promostandards.ssactivewear.com/pricingandconfiguration/v1/pricingandconfigurationservice.svc",
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
    const testPpc = url.searchParams.get("testPpc") === "true";

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

    // CRITICAL FIX: S&S requires 6-character internal product IDs (e.g., "B22035" for "996MR")
    // We must discover this ID FIRST by calling Inventory API, which is more forgiving with raw style numbers
    // and returns partIds we can extract the internal ID from.
    let internalProductId: string | null = null;
    let discoveredPartId: string | null = null; // Full partId for PPC calls (e.g., "B00760033")
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
          console.log(`🔍 Found ${partIdMatches.length} partIds, first 5:`, partIdMatches.slice(0, 5));

          // Find first valid partId - can be B-prefixed (e.g., "B00760033") or numeric (e.g., "2000033")
          // Must be at least 7+ chars to include product ID + color/size suffix
          const validPartId = partIdMatches.find(id => {
            const trimmed = id.trim();
            // B-prefixed: B + 5 digits + suffix (B00760033)
            if (/^B\d{5,}/i.test(trimmed)) return true;
            // Pure numeric: at least 7 digits (2000033 = style 2000 + suffix 033)
            if (/^\d{7,}$/.test(trimmed)) return true;
            return false;
          });

          if (validPartId) {
            const trimmedPartId = validPartId.trim().toUpperCase();

            // Extract productId (first 6 chars for B-prefix, or style-based for numeric)
            if (trimmedPartId.startsWith('B')) {
              internalProductId = trimmedPartId.substring(0, 6);
            } else {
              // For numeric partIds like "2000033", extract the style portion
              // The style is typically the first 4-5 digits before the color/size suffix
              // We need to figure out where the style ends - look at the original style number length
              const styleLen = cleanedStyleNumber.length;
              internalProductId = trimmedPartId.substring(0, styleLen);
            }

            discoveredPartId = trimmedPartId;
            internalIdSource = 'inventory-discovery';
            console.log(`✅ SUCCESS! Discovered from Inventory: ${tryStyle} -> fullPartId ${trimmedPartId} -> productId ${internalProductId}`);
            break;
          } else {
            console.log(`⚠️ No valid partIds found matching pattern (need B+5digits or 7+ digits)`);
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

    // STEP 1.5: Fetch Pricing & Configuration (Customer/EQP pricing)
    let ppcPrice: number | null = null;
    let ppcTiers: { minQuantity: number; price: number }[] = [];
    let ppcError: string | null = null;

    // PPC productId MUST be derived ONLY from discoveredPartId (first 6 chars)
    const ppcProductId = discoveredPartId?.substring(0, 6)?.toUpperCase() || null;
    const isValidPpcProductId = ppcProductId !== null && ppcProductId.length === 6;

    if (isValidPpcProductId && discoveredPartId) {
      console.log('💰 Step 1.5: Fetching PPC Customer Pricing...');

      // S&S PPC API requires:
      // - productId: 6-character internal ID derived from discoveredPartId (e.g., "B00760")
      // - partId: FULL discoveredPartId (e.g., "B00760033")
      const ppcPartId = discoveredPartId; // FULL partId from discovery

      console.log('💰 PPC Request params:', {
        ppcProductId,
        ppcPartId,
        discoveredPartId,
        fobId: settings.ssactivewear_fob_id
      });

      const ppcSoap = `<ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${escapedAccountNumber}</shar:id>
  <shar:password>${escapedApiKey}</shar:password>
  <shar:productId>${escapeXml(ppcProductId)}</shar:productId>
  <shar:partId>${escapeXml(ppcPartId)}</shar:partId>
  <shar:currency>USD</shar:currency>
  <shar:fobId>${escapeXml(settings.ssactivewear_fob_id || '')}</shar:fobId>
  <shar:priceType>Customer</shar:priceType>
  <shar:localizationCountry>US</shar:localizationCountry>
  <shar:localizationLanguage>en</shar:localizationLanguage>
  <shar:configurationType>Blank</shar:configurationType>
</ns2:GetConfigurationAndPricingRequest>`;

      try {
        const ppcResponse = await makePromoStandardsRequest(
          PROMOSTANDARDS_ENDPOINTS.pricingAndConfiguration,
          "getConfigurationAndPricing",
          ppcSoap
        );

        console.log('💰 PPC Response received, parsing PartPrice blocks...');

        const partPricePattern = /<(?:[a-zA-Z0-9]+:)?PartPrice[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?PartPrice>/gi;
        const partPriceMatches = getAllXmlMatches(ppcResponse, partPricePattern);

        console.log('💰 Found', partPriceMatches.length, 'PartPrice entries');

        partPriceMatches.forEach(match => {
          const priceXml = match[1];
          const minQuantity = parseInt(getXmlValue(priceXml, "minQuantity") || "1");
          const price = parseFloat(getXmlValue(priceXml, "price") || "0");

          if (price > 0) {
            ppcTiers.push({ minQuantity, price });
          }
        });

        ppcTiers.sort((a, b) => a.minQuantity - b.minQuantity);

        if (ppcTiers.length > 0) {
          ppcPrice = ppcTiers[0].price;
          console.log('💰 PPC Customer pricing extracted:', { ppcPrice, tierCount: ppcTiers.length, allTiers: ppcTiers });
        } else {
          console.warn('💰 No PartPrice entries found in PPC response');
          const errorCode = getXmlValue(ppcResponse, "code");
          const errorDesc = getXmlValue(ppcResponse, "description");
          if (errorCode || errorDesc) {
            ppcError = `PPC Error ${errorCode || 'unknown'}: ${errorDesc || 'No pricing data returned'}`;
            console.error('💰 PPC API returned error:', ppcError);
          }
        }
      } catch (err: any) {
        ppcError = err.message || 'Unknown PPC error';
        console.error('💰 PPC request failed:', ppcError);
      }
    } else {
      console.log('💰 Skipping PPC call - missing required params:', {
        ppcProductId,
        isValidPpcProductId,
        discoveredPartId,
        reason: !discoveredPartId ? 'No discoveredPartId from inventory' : 'ppcProductId not exactly 6 characters'
      });
    }

    // STEP 2: Fetch Inventory
    console.log('📦 Step 2: Fetching Inventory...');

    const inventoryProductId = internalProductId || cleanedStyleNumber;
    const escapedInventoryProductId = escapeXml(inventoryProductId);

    const [inventoryResponse] = await Promise.allSettled([
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
    ]);

    console.log('📊 PromoStandards API Results:', {
      product: productResponse.status,
      inventory: inventoryResponse.status,
      media: initialMediaResponse.status,
      internalProductId,
      internalIdSource,
      productError: productResponse.status === 'rejected' ? productResponse.reason : null,
      inventoryError: inventoryResponse.status === 'rejected' ? inventoryResponse.reason : null,
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

    // Extract BASE PRICING from Product Data 2.0.0
    // Base pricing is at PRODUCT level, NOT part level
    // Structure: ProductPriceGroupArray > ProductPriceGroup > ProductPriceArray > ProductPrice > price
    let basePrice: number | null = null;
    let usedPricingSource = 'none';

    if (productResponse.status === 'fulfilled' && productResponse.value) {
      console.log('💰 Extracting base pricing from Product Data 2.0.0...');

      try {
        const xmlDoc = productResponse.value;

        // Extract ProductPrice entries directly - base pricing applies to the entire product
        const productPricePattern = /<(?:[a-zA-Z0-9]+:)?ProductPrice[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?ProductPrice>/gi;
        const productPriceMatches = getAllXmlMatches(xmlDoc, productPricePattern);

        console.log('💰 Found', productPriceMatches.length, 'ProductPrice entries');

        // Extract all prices with their quantity minimums
        const priceTiers: { quantityMin: number; price: number }[] = [];

        productPriceMatches.forEach(match => {
          const priceXml = match[1];
          const price = parseFloat(getXmlValue(priceXml, "price") || "0");
          const quantityMin = parseInt(getXmlValue(priceXml, "quantityMin") || "1");

          if (price > 0) {
            priceTiers.push({ quantityMin, price });
          }
        });

        // Sort by quantityMin and take the first (base) price
        priceTiers.sort((a, b) => a.quantityMin - b.quantityMin);

        if (priceTiers.length > 0) {
          basePrice = priceTiers[0].price;
          usedPricingSource = 'base-pricing';
          console.log('💰 Successfully extracted base price from Product Data 2.0.0:', basePrice);
          console.log('💰 All price tiers:', priceTiers);
        } else {
          console.warn('💰 No ProductPrice entries found in Product Data');
        }
      } catch (err: any) {
        console.error('💰 Failed to extract base pricing:', err.message);
      }
    } else {
      console.warn('💰 Product Data not available for base pricing extraction');
    }

    // Merge PPC + Base Pricing
    let finalPrice: number | null = null;
    let pricingSource: string | null = null;

    if (ppcPrice) {
      finalPrice = ppcPrice;
      pricingSource = "customer-pricing";
    } else if (basePrice) {
      finalPrice = basePrice;
      pricingSource = "base-pricing";
    } else {
      finalPrice = null;
      pricingSource = "none";
    }

    console.log('💰 Final pricing decision:', { finalPrice, pricingSource, ppcPrice, basePrice });

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
    const hasPricing = finalPrice !== null && finalPrice > 0;
    const pricingUnavailableReason = !hasPricing
      ? "Pricing not available. Please enter pricing manually."
      : null;

    // PPC Test Harness - return early with test data
    if (testPpc) {
      return new Response(
        JSON.stringify({
          success: true,
          testHarness: true,
          styleNumber,
          partId,
          internalProductId,
          pricingTest: {
            ppcPrice,
            ppcTiers,
            ppcError,
            basePrice,
            finalPrice,
            pricingSource
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return unified response
    return new Response(
      JSON.stringify({
        success: true,
        styleNumber,
        partId: partId || null,
        product: productData,
        inventory: inventoryData,
        pricing: {
          price: finalPrice,
          source: pricingSource,
          ppcTiers,
          ppcError,
          basePrice,
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
          usedPricingSource,
          basePrice,
          ppcPrice,
          ppcTiers,
          ppcError,
          finalPrice,
          pricingSource,
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
