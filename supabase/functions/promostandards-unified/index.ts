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

    // Get company-specific FOB warehouse or use default
    const companyFobId = settings?.ssactivewear_fob_id || SSA_DEFAULT_FOB_ID;
    console.log('📦 Using FOB warehouse:', companyFobId);

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

    // STEP 2: Fetch Inventory and Pricing
    // Use internal pricing ID extracted from partId (e.g., B00760 for Gildan 2000)
    console.log('📦 Step 2: Fetching Inventory and Pricing...');

    // Build list of productId formats to try for pricing (in order of preference)
    // S&S ActiveWear Pricing API accepts different formats than other APIs
    const pricingIdCandidates: { id: string; source: string }[] = [];

    // 1. PRIMARY: Try plain style number first (e.g., "996MR")
    // This is what S&S expects for most products in their Pricing API
    if (!pricingIdCandidates.some(c => c.id === cleanedStyleNumber)) {
      pricingIdCandidates.push({ id: cleanedStyleNumber, source: 'style-number' });
      console.log('💰 Plain style number (PRIMARY for Pricing API):', cleanedStyleNumber);
    }

    // 2. FALLBACK: Use normalized style number with B-prefix (e.g., "2000" -> "B2000")
    const normalizedStyleId = normalizeSsProductId(cleanedStyleNumber);
    if (normalizedStyleId && !pricingIdCandidates.some(c => c.id === normalizedStyleId)) {
      pricingIdCandidates.push({ id: normalizedStyleId, source: 'normalized-style' });
      console.log('💰 Normalized B-prefix style (fallback):', cleanedStyleNumber, '->', normalizedStyleId);
    }

    // 3. ALTERNATIVE: Use internal ID extracted from partId (e.g., B00760 for Gildan 2000, B22035 for Jerzees 996MR)
    // This is extracted from partId values like "B00760033" -> "B00760" or "B22035597" -> "B22035"
    // Sometimes works but not always reliable for Pricing API
    if (internalProductId && !pricingIdCandidates.some(c => c.id === internalProductId)) {
      pricingIdCandidates.push({ id: internalProductId, source: internalIdSource });
      console.log('💰 Internal pricing ID (alternative):', internalProductId);
    }

    console.log('💰 Pricing API candidates to try (in order):', pricingIdCandidates);

    // For inventory, use internal product ID (e.g., "B00760") to get all parts at once
    // Falls back to style number if internal ID not available
    const inventoryProductId = internalProductId || pricingIdCandidates[0]?.id || escapedStyleNumber;
    const escapedInventoryProductId = escapeXml(inventoryProductId);

    const [inventoryResponse, livePricingResponse] = await Promise.allSettled([
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
      getLiveWholesalePricing(ssaVendorConfig, pricingIdCandidates[0].id, companyFobId),
    ]);

    // Track which pricing ID we actually used
    let usedPricingId = pricingIdCandidates[0].id;
    let usedPricingSource = pricingIdCandidates[0].source;
    let pricingDebugInfo: any = null;
    let pricingAttempts: { id: string; source: string; resultCount: number; debugInfo?: any }[] = [{
      id: pricingIdCandidates[0].id,
      source: pricingIdCandidates[0].source,
      resultCount: livePricingResponse.status === 'fulfilled' ? livePricingResponse.value.prices.length : 0,
      debugInfo: livePricingResponse.status === 'fulfilled' ? livePricingResponse.value.debugInfo : null
    }];

    // If first attempt returned no results, try remaining candidates
    let finalPricingResponse = livePricingResponse;
    if (livePricingResponse.status === 'fulfilled' && livePricingResponse.value.prices.length === 0 && pricingIdCandidates.length > 1) {
      console.log('💰 First pricing attempt returned 0 results, trying alternative IDs...');

      for (let i = 1; i < pricingIdCandidates.length; i++) {
        const candidate = pricingIdCandidates[i];
        console.log(`💰 Trying pricing candidate ${i + 1}/${pricingIdCandidates.length}: ${candidate.id} (${candidate.source})`);

        const retryResult = await getLiveWholesalePricing(ssaVendorConfig, candidate.id, companyFobId);
        pricingAttempts.push({
          id: candidate.id,
          source: candidate.source,
          resultCount: retryResult.prices.length,
          debugInfo: retryResult.debugInfo
        });

        if (retryResult.prices.length > 0) {
          console.log(`💰 SUCCESS with ${candidate.id}: ${retryResult.prices.length} price entries`);
          finalPricingResponse = { status: 'fulfilled', value: retryResult } as PromiseFulfilledResult<typeof retryResult>;
          usedPricingId = candidate.id;
          usedPricingSource = candidate.source;
          break;
        } else {
          console.log(`💰 No results with ${candidate.id}, continuing...`);
          if (retryResult.debugInfo) {
            pricingDebugInfo = retryResult.debugInfo;
          }
        }
      }
    }

    // Capture debug info from the final response if available
    if (livePricingResponse.status === 'fulfilled' && livePricingResponse.value.debugInfo) {
      pricingDebugInfo = livePricingResponse.value.debugInfo;
    }

    console.log('📊 PromoStandards API Results:', {
      product: productResponse.status,
      inventory: inventoryResponse.status,
      livePricing: finalPricingResponse.status,
      media: initialMediaResponse.status,
      usedPricingId,
      usedPricingSource,
      internalProductId,
      internalIdSource,
      pricingAttempts,
      pricingDebugInfo,
      productError: productResponse.status === 'rejected' ? productResponse.reason : null,
      inventoryError: inventoryResponse.status === 'rejected' ? inventoryResponse.reason : null,
      livePricingCount: finalPricingResponse.status === 'fulfilled' ? finalPricingResponse.value.prices.length : 0,
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

    // Parse Pricing from live wholesale pricing response
    const pricingData: any = {};
    let pricingAuthError: { code: string; description: string } | null = null;
    let usedCache = false;
    let usedBasePriceFallback = false;

    if (finalPricingResponse.status === 'fulfilled' && finalPricingResponse.value.prices.length > 0) {
      const livePricing = finalPricingResponse.value.prices;
      console.log('💰 Live wholesale pricing received:', livePricing.length, 'price entries');

      // Group by partId
      const partPricingMap = new Map<string, any[]>();
      livePricing.forEach(item => {
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

      console.log('💰 Total pricing data:', pricingData.parts.length, 'parts');

      // Create a pricing map for easy lookup by partId
      pricingData.pricesByPartId = {};
      pricingData.parts.forEach((part: any) => {
        if (part.partId && part.prices && part.prices.length > 0) {
          // Store the first price tier (usually min quantity 1)
          pricingData.pricesByPartId[part.partId] = part.prices[0].price;
        }
      });
      console.log('💰 Price map created with', Object.keys(pricingData.pricesByPartId).length, 'entries');

      try {
        for (const item of livePricing) {
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
        console.log('💰 Cached', livePricing.length, 'pricing entries to ss_catalog_pricing');
      } catch (cacheErr: any) {
        console.warn('💰 Failed to cache pricing:', cacheErr.message);
      }
    } else {
      console.warn('💰 Live pricing returned empty, attempting base price fallback from Product Data...');

      // FALLBACK: If wholesale pricing returned zero results, try to get base price from Product Data
      if ((!pricingData.parts || pricingData.parts.length === 0) && productResponse.status === 'fulfilled' && productResponse.value) {
        console.log('💰 Extracting base prices from Product Data endpoint...');

        try {
          const xmlDoc = productResponse.value;

          // Extract ProductPrice entries from ProductPriceGroupArray
          const productPricePattern = /<(?:[a-zA-Z0-9]+:)?ProductPrice>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?ProductPrice>/gi;
          const productPriceMatches = getAllXmlMatches(xmlDoc, productPricePattern);

          if (productPriceMatches.length > 0) {
            console.log('💰 Found', productPriceMatches.length, 'ProductPrice entries in Product Data');

            const basePrices: any[] = [];

            // Parse each ProductPrice entry
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
                  source: 'base-price-fallback'
                });
              }
            });

            if (basePrices.length > 0) {
              console.log('💰 Successfully extracted', basePrices.length, 'base prices from Product Data');
              usedBasePriceFallback = true;

              // Group by partId (same structure as wholesale pricing)
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

              console.log('💰 Total base pricing data:', pricingData.parts.length, 'parts');

              // Create a pricing map for easy lookup by partId
              pricingData.pricesByPartId = {};
              pricingData.parts.forEach((part: any) => {
                if (part.partId && part.prices && part.prices.length > 0) {
                  pricingData.pricesByPartId[part.partId] = part.prices[0].price;
                }
              });
              console.log('💰 Base price map created with', Object.keys(pricingData.pricesByPartId).length, 'entries');

              // Cache base prices the same way as wholesale pricing
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
            } else {
              console.warn('💰 No valid base prices found in Product Data (need quantityMin=1 and price>0)');
            }
          } else {
            console.warn('💰 No ProductPrice entries found in Product Data response');
          }
        } catch (basePriceErr: any) {
          console.error('💰 Failed to extract base prices from Product Data:', basePriceErr.message);
        }
      }

      // If still no pricing from fallback, check DB cache
      if (!pricingData.parts || pricingData.parts.length === 0) {
        console.warn('💰 Base price fallback unsuccessful, checking DB cache...');
      }

      if (!pricingData.parts || pricingData.parts.length === 0) {
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
        pricing: pricingData,
        media: mediaData,
        pricingAvailable: hasPricing,
        pricingUnavailableReason,
        debug: {
          usedPricingId,
          usedPricingSource,
          pricingAttempts,
          internalProductId,
          internalIdSource,
          mediaResponseStatus: initialMediaResponse.status,
          mediaXmlFull: verbose && initialMediaResponse.status === 'fulfilled' && initialMediaResponse.value
            ? initialMediaResponse.value
            : null,
          mediaError: initialMediaResponse.status === 'rejected' ? initialMediaResponse.reason?.toString() : null,
          mediaAuthError,
          pricingAuthError,
          pricingSource: pricingData.parts?.length > 0
            ? (usedCache ? 'cache' : (usedBasePriceFallback ? 'base-price-fallback' : 'live'))
            : 'none',
          usedBasePriceFallback,
          pricingPartsCount: pricingData.parts?.length || 0,
          pricingMapCount: pricingData.pricesByPartId ? Object.keys(pricingData.pricesByPartId).length : 0,
          livePricingStatus: finalPricingResponse.status,
          livePricingCount: finalPricingResponse.status === 'fulfilled' ? finalPricingResponse.value.prices.length : 0,
          pricingDebugInfo: pricingDebugInfo || null,
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
