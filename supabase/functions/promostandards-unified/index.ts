import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getLiveWholesalePricing, type VendorConfig } from "../_shared/live-wholesale-pricing.ts";

const SSA_DEFAULT_FOB_ID = "NJ";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PROMOSTANDARDS_ENDPOINTS = {
  productData: "https://promostandards.ssactivewear.com/productdata/v2/productdataservicev2.svc",
  inventory: "https://promostandards.ssactivewear.com/inventory/v2/inventoryservice.svc",
  pricing: "https://promostandards.ssactivewear.com/pricingandconfiguration/v1/pricingandconfigurationservice.svc",
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
      "SOAPAction": `"${soapAction}"`,
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

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      console.error('❌ No Authorization header provided');
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRoleKey = token === supabaseServiceRoleKey;

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
      .select("ssactivewear_enabled, ssactivewear_username, ssactivewear_api_key_encrypted")
      .eq("id", companyId)
      .maybeSingle();

    console.log('📋 Settings fetch result:', {
      hasSettings: !!settings,
      enabled: settings?.ssactivewear_enabled,
      hasUsername: !!settings?.ssactivewear_username,
      hasApiKey: !!settings?.ssactivewear_api_key_encrypted,
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

    if (!styleNumber) {
      return new Response(
        JSON.stringify({ error: "Style number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Unified PromoStandards Request:', { styleNumber, partId });

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

    // Make all 4 requests in parallel (using live wholesale pricing for pricing)
    const [productResponse, inventoryResponse, livePricingResponse, mediaResponse] = await Promise.allSettled([
      // 1. Product Data
      makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.productData,
        "getProduct",
        productSoap
      ),
      // 2. Inventory (if partId provided, otherwise skip)
      partId ? makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.inventory,
        "getInventoryLevels",
        `<ns2:GetInventoryLevelsRequest xmlns:ns2="http://www.promostandards.org/WSDL/InventoryService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${escapedAccountNumber}</shar:id>
  <shar:password>${escapedApiKey}</shar:password>
  <shar:productId>${escapedPartId}</shar:productId>
</ns2:GetInventoryLevelsRequest>`
      ) : Promise.resolve(null),
      // 3. Live Wholesale Pricing with FOB (S&S uses raw style numbers, NOT B-prefixed)
      getLiveWholesalePricing(ssaVendorConfig, cleanedStyleNumber, SSA_DEFAULT_FOB_ID),
      // 4. Media Content - use styleNumber as productId and partId for color-specific images
      makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.media,
        "getMediaContent",
        mediaSoap
      ),
    ]);

    console.log('📊 PromoStandards API Results:', {
      product: productResponse.status,
      inventory: inventoryResponse.status,
      livePricing: livePricingResponse.status,
      media: mediaResponse.status,
      productError: productResponse.status === 'rejected' ? productResponse.reason : null,
      inventoryError: inventoryResponse.status === 'rejected' ? inventoryResponse.reason : null,
      livePricingCount: livePricingResponse.status === 'fulfilled' ? livePricingResponse.value.length : 0,
      mediaError: mediaResponse.status === 'rejected' ? mediaResponse.reason : null,
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

    if (livePricingResponse.status === 'fulfilled' && livePricingResponse.value.length > 0) {
      const livePricing = livePricingResponse.value;
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
      console.warn('💰 Live pricing returned empty, checking cache as fallback...');

      // Get part IDs from the product data to query cache
      const partIds = productData.parts?.map((p: any) => p.partId).filter(Boolean) || [];

      if (partIds.length > 0) {
        console.log('💰 Querying cache for', partIds.length, 'part IDs');
        const { data: cachedPricing } = await supabase
          .from('ss_catalog_pricing')
          .select('part_number, unit_price, quantity_min, quantity_max, discount_code')
          .eq('company_id', companyId)
          .in('part_number', partIds)
          .or(`price_expiry_date.gte.${new Date().toISOString().split('T')[0]},price_expiry_date.is.null`)
          .order('part_number')
          .order('quantity_min');

        if (cachedPricing && cachedPricing.length > 0) {
          console.log('💰 Found cached pricing for', cachedPricing.length, 'records');
          usedCache = true;

          // Group by part_number
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

          // Create pricing map
          pricingData.pricesByPartId = {};
          pricingData.parts.forEach((part: any) => {
            if (part.partId && part.prices && part.prices.length > 0) {
              pricingData.pricesByPartId[part.partId] = part.prices[0].price;
            }
          });

          console.log('💰 Using cached pricing:', pricingData.parts.length, 'parts with', Object.keys(pricingData.pricesByPartId).length, 'in price map');
        } else {
          console.warn('💰 No cached pricing found for these part IDs');
        }
      } else {
        console.warn('💰 No part IDs available to query cache');
      }
    }

    // Parse Media Content with fallback for error 105
    const mediaData: any = {};
    console.log('📸 Media Response Status:', mediaResponse.status);

    let mediaAuthError: { code: string; description: string } | null = null;
    let finalMediaResponse = mediaResponse;
    let usedRestApiFallback = false;

    // Check if media request failed or returned error 105
    if (mediaResponse.status === 'fulfilled' && mediaResponse.value) {
      const errorCodeMatch = mediaResponse.value.match(/<code>(\d+)<\/code>/);
      const errorDescMatch = mediaResponse.value.match(/<description>(.*?)<\/description>/);

      const hasMediaError = errorCodeMatch && errorDescMatch;
      const hasEmptyMediaContent = !hasMediaError && !mediaResponse.value.includes('<MediaContent>');

      if (hasMediaError && errorCodeMatch[1] === '105') {
        mediaAuthError = {
          code: errorCodeMatch[1],
          description: errorDescMatch[1]
        };
        console.warn('📸 Media API error 105 (auth failed), trying SSActivewear REST API fallback...');
      }

      // Fall back to REST API if we got an auth error OR if PromoStandards returned empty results
      if ((hasMediaError && errorCodeMatch[1] === '105') || hasEmptyMediaContent) {
        if (hasEmptyMediaContent) {
          console.warn('📸 PromoStandards returned empty MediaContentArray, trying SSActivewear REST API fallback...');
        }

        // Use SSActivewear REST API as fallback for images
        try {
          const ssaRestApiUrl = `https://api.ssactivewear.com/v2/products/?style=${encodeURIComponent(styleNumber)}`;
          console.log('📸 Calling SSActivewear REST API:', ssaRestApiUrl);

          const restApiResponse = await fetch(ssaRestApiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${btoa(`${credentials.accountNumber}:${decryptedApiKey}`)}`,
              'Content-Type': 'application/json',
            },
          });

          if (restApiResponse.ok) {
            const restApiData = await restApiResponse.json();
            console.log('📸 REST API returned', Array.isArray(restApiData) ? restApiData.length : 1, 'products');

            if (Array.isArray(restApiData) && restApiData.length > 0) {
              usedRestApiFallback = true;

              const SSA_IMAGE_BASE = 'https://www.ssactivewear.com/';
              const normalizeImageUrl = (url: any): string | null => {
                if (!url || typeof url !== 'string' || url.trim().length === 0) return null;
                const trimmed = url.trim();
                if (trimmed.startsWith('http')) return trimmed;
                if (trimmed.startsWith('Images/') || trimmed.startsWith('images/')) return SSA_IMAGE_BASE + trimmed;
                return null;
              };
              const isValidImageUrl = (url: any): boolean => {
                return normalizeImageUrl(url) !== null;
              };

              let targetColor: string | null = null;
              let productsForColor: any[] = [];

              if (partId) {
                const selectedPart = productData.parts?.find((p: any) => p.partId === partId);
                targetColor = selectedPart?.colorName || null;
                console.log('📸 Looking up color for partId:', { partId, targetColor });

                if (targetColor) {
                  productsForColor = restApiData.filter((p: any) =>
                    p.colorName?.toLowerCase() === targetColor!.toLowerCase()
                  );
                }

                if (productsForColor.length === 0 && targetColor) {
                  const targetWords = targetColor.toLowerCase().split(/[\s/]+/);
                  productsForColor = restApiData.filter((p: any) => {
                    const pColor = p.colorName?.toLowerCase();
                    if (!pColor) return false;
                    const pWords = pColor.split(/[\s/]+/);
                    const matching = targetWords.filter(w => w.length > 2 && pWords.includes(w));
                    return matching.length > 0 && (matching.length * 2) / (targetWords.length + pWords.length) >= 0.5;
                  });
                  if (productsForColor.length > 0) {
                    console.log('📸 Fuzzy color match found:', productsForColor.length, 'products');
                  }
                }

                if (productsForColor.length === 0) {
                  const colorPortion = partId.replace(/^[A-Z0-9]+-/i, '').replace(/-[A-Z0-9]+$/i, '').toLowerCase();
                  if (colorPortion && colorPortion !== partId.toLowerCase()) {
                    productsForColor = restApiData.filter((p: any) =>
                      p.colorName?.toLowerCase()?.includes(colorPortion) ||
                      p.color1?.toLowerCase()?.includes(colorPortion)
                    );
                    console.log('📸 Filtered REST by extracted color portion:', { colorPortion, matchCount: productsForColor.length });
                  }
                }

                if (productsForColor.length === 0) {
                  const matched = restApiData.find((p: any) =>
                    p.sku === partId ||
                    p.styleID === partId ||
                    p.gtin === partId
                  );
                  if (matched) {
                    targetColor = matched.colorName || null;
                    productsForColor = restApiData.filter((p: any) =>
                      p.colorName === matched.colorName
                    );
                  }
                }

                console.log('📸 Color match result:', { partId, targetColor, matchCount: productsForColor.length });
              }

              const productsToUse = productsForColor.length > 0 ? productsForColor : [restApiData[0]];
              if (productsForColor.length === 0) {
                console.warn('📸 No color match found, falling back to first product');
              }

              // Extract images ONLY from the selected color's product(s)
              let front: string | null = null;
              let back: string | null = null;
              let side: string | null = null;

              for (const product of productsToUse) {
                if (!front) {
                  front = normalizeImageUrl(product.colorFrontImage) || normalizeImageUrl(product.colorOnModelFrontImage) || normalizeImageUrl(product.styleFrontImage);
                }
                if (!back) {
                  back = normalizeImageUrl(product.colorBackImage) || normalizeImageUrl(product.colorOnModelBackImage) || normalizeImageUrl(product.styleBackImage);
                }
                if (!side) {
                  side = normalizeImageUrl(product.colorSideImage) || normalizeImageUrl(product.colorDirectSideImage) || normalizeImageUrl(product.colorOnModelSideImage) || normalizeImageUrl(product.styleSideImage);
                }
              }

              // Build minimal image set for the selected color
              mediaData.images = [];
              if (front) mediaData.images.push({ url: front, productId: styleNumber, partId: partId || '', classTypeName: 'Front', color: targetColor || '', singlePart: false });
              if (back) mediaData.images.push({ url: back, productId: styleNumber, partId: partId || '', classTypeName: 'Rear', color: targetColor || '', singlePart: false });
              if (side) mediaData.images.push({ url: side, productId: styleNumber, partId: partId || '', classTypeName: 'Side', color: targetColor || '', singlePart: false });

              // Return ONLY front/back/side for the selected color
              mediaData.views = {
                front,
                rear: back,
                side,
                lifestyle: null,
                frontImages: front ? [front] : [],
                rearImages: back ? [back] : [],
                sideImages: side ? [side] : [],
                lifestyleImages: [],
                otherImages: [],
              };

              console.log('📸 REST API images loaded (color-filtered):', {
                partId,
                targetColor,
                front: !!front,
                back: !!back,
                side: !!side,
              });
            }
          } else {
            const errorText = await restApiResponse.text().catch(() => '');
            console.warn('📸 REST API returned error:', restApiResponse.status, errorText);
          }
        } catch (restApiError) {
          console.error('📸 REST API fallback failed:', restApiError);
        }
      }
    } else if (mediaResponse.status === 'rejected') {
      console.error('📸 Media Request Failed:', mediaResponse.reason);
    }

    // Only process PromoStandards media if we didn't already get images from REST API fallback
    if (!usedRestApiFallback && finalMediaResponse.status === 'fulfilled' && finalMediaResponse.value) {
      const xmlDoc = finalMediaResponse.value;
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
        debug: {
          mediaResponseStatus: mediaResponse.status,
          mediaXmlFull: mediaResponse.status === 'fulfilled' && mediaResponse.value
            ? mediaResponse.value
            : null,
          mediaError: mediaResponse.status === 'rejected' ? mediaResponse.reason?.toString() : null,
          mediaAuthError,
          pricingAuthError,
          soapRequests: {
            productDataRequest: productSoap,
            mediaRequest: mediaSoap,
          },
          credentials: {
            accountNumber: credentials.accountNumber,
            apiKeyLength: decryptedApiKey?.length,
          }
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
