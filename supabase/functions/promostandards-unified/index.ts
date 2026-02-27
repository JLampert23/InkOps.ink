import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getLiveWholesalePricing, type VendorConfig } from "../_shared/live-wholesale-pricing.ts";

const SSA_DEFAULT_FOB_ID = "IL";

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
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xmlText.match(regex);
  return match ? match[1] : null;
}

function getXmlValues(xmlText: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'gi');
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
      // User JWT - validate using anon key client with user's JWT
      console.log('👤 User JWT - validating token...');

      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

      if (authError) {
        console.error('❌ JWT validation FAILED:', {
          message: authError.message,
          name: authError.name,
          status: authError.status,
          code: authError.code
        });
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            details: authError.message
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!user) {
        console.error('❌ No user found in JWT');
        return new Response(
          JSON.stringify({ error: "Unauthorized - no user found" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log('✅ JWT validated successfully for user:', user.id);

      // Use service role key for database queries
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        console.error('❌ No company_id found for user:', user.id);
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
        "Authorization": authHeader,
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

    // S&S Activewear requires B-prefixed style number for media requests
    const ssaStyleNumber = `B${styleNumber.replace(/^B/i, '')}`;
    const escapedSsaStyleNumber = escapeXml(ssaStyleNumber);

    const mediaSoap = `<ns2:GetMediaContentRequest xmlns:ns2="http://www.promostandards.org/WSDL/MediaService/1.1.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.1.0/SharedObjects/">
  <shar:wsVersion>1.1.0</shar:wsVersion>
  <shar:id>${escapedAccountNumber}</shar:id>
  <shar:password>${escapedApiKey}</shar:password>
  <shar:mediaType>Image</shar:mediaType>
  <shar:productId>${escapedSsaStyleNumber}</shar:productId>
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
      // 3. Live Wholesale Pricing with FOB (S&S uses B-prefixed style IDs)
      getLiveWholesalePricing(ssaVendorConfig, `B${styleNumber.replace(/^B/i, '')}`, SSA_DEFAULT_FOB_ID),
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
      const partPattern = /<Part>([\s\S]*?)<\/Part>/gi;
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
      const inventoryPattern = /<Inventory>([\s\S]*?)<\/Inventory>/gi;
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

      if (errorCodeMatch && errorDescMatch && errorCodeMatch[1] === '105') {
        mediaAuthError = {
          code: errorCodeMatch[1],
          description: errorDescMatch[1]
        };
        console.warn('📸 Media API error 105 (auth failed), trying SSActivewear REST API fallback...');

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

              // Extract unique images from all products (variants)
              const imageMap = new Map<string, { url: string; type: string; color: string }>();

              for (const product of restApiData) {
                // Add front image
                if (product.colorFrontImage) {
                  const key = `front-${product.colorName}`;
                  if (!imageMap.has(key)) {
                    imageMap.set(key, { url: product.colorFrontImage, type: 'Front', color: product.colorName });
                  }
                }
                // Add back image
                if (product.colorBackImage) {
                  const key = `back-${product.colorName}`;
                  if (!imageMap.has(key)) {
                    imageMap.set(key, { url: product.colorBackImage, type: 'Back', color: product.colorName });
                  }
                }
                // Add side image
                if (product.colorSideImage) {
                  const key = `side-${product.colorName}`;
                  if (!imageMap.has(key)) {
                    imageMap.set(key, { url: product.colorSideImage, type: 'Side', color: product.colorName });
                  }
                }
                // Add swatch image (can use as lifestyle)
                if (product.colorSwatchImage) {
                  const key = `swatch-${product.colorName}`;
                  if (!imageMap.has(key)) {
                    imageMap.set(key, { url: product.colorSwatchImage, type: 'Swatch', color: product.colorName });
                  }
                }
              }

              // Build media data from REST API response
              mediaData.images = Array.from(imageMap.values()).map(img => ({
                url: img.url,
                productId: styleNumber,
                partId: '',
                classTypeName: img.type,
                color: img.color,
                singlePart: false,
              }));

              // Organize by type
              const frontImages: string[] = [];
              const rearImages: string[] = [];
              const sideImages: string[] = [];
              const lifestyleImages: string[] = [];
              const otherImages: string[] = [];

              // If partId (color code) is provided, try to find matching color images first
              const targetColor = partId ? restApiData.find((p: any) => p.sku === partId || p.styleID === partId)?.colorName : null;

              for (const img of mediaData.images) {
                const imgType = (img.classTypeName || '').toLowerCase();
                const isTargetColor = !targetColor || img.color === targetColor;

                if (imgType.includes('front')) {
                  if (isTargetColor) frontImages.unshift(img.url);
                  else frontImages.push(img.url);
                } else if (imgType.includes('back')) {
                  if (isTargetColor) rearImages.unshift(img.url);
                  else rearImages.push(img.url);
                } else if (imgType.includes('side')) {
                  if (isTargetColor) sideImages.unshift(img.url);
                  else sideImages.push(img.url);
                } else if (imgType.includes('swatch')) {
                  if (isTargetColor) lifestyleImages.unshift(img.url);
                  else lifestyleImages.push(img.url);
                } else {
                  otherImages.push(img.url);
                }
              }

              mediaData.views = {
                front: frontImages.length > 0 ? frontImages[0] : null,
                rear: rearImages.length > 0 ? rearImages[0] : null,
                side: sideImages.length > 0 ? sideImages[0] : null,
                lifestyle: lifestyleImages.length > 0 ? lifestyleImages[0] : (frontImages.length > 0 ? frontImages[0] : null),
                frontImages,
                rearImages,
                sideImages,
                lifestyleImages,
                otherImages,
              };

              console.log('📸 REST API images loaded:', {
                totalImages: mediaData.images.length,
                frontCount: frontImages.length,
                rearCount: rearImages.length,
                sideCount: sideImages.length,
                lifestyleCount: lifestyleImages.length,
              });
            }
          } else {
            console.warn('📸 REST API returned error:', restApiResponse.status, await restApiResponse.text().catch(() => ''));
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

      // Check for error message
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
        const mediaPattern = /<MediaContent>([\s\S]*?)<\/MediaContent>/gi;
        const mediaMatches = getAllXmlMatches(xmlDoc, mediaPattern);
        console.log('📸 MediaContent matches found:', mediaMatches.length);

      mediaData.images = mediaMatches.map(match => {
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

      // Organize ALL images by view type (return arrays instead of single URLs)
      const frontImages: string[] = [];
      const rearImages: string[] = [];
      const sideImages: string[] = [];
      const lifestyleImages: string[] = [];
      const otherImages: string[] = [];

      mediaData.images.forEach((img: any) => {
        const classTypeName = (img.classTypeName || '').toLowerCase();

        if (classTypeName.includes('front')) {
          frontImages.push(img.url);
        } else if (classTypeName.includes('rear') || classTypeName.includes('back')) {
          rearImages.push(img.url);
        } else if (classTypeName.includes('side') || classTypeName.includes('sleeve')) {
          sideImages.push(img.url);
        } else if (classTypeName.includes('lifestyle') || classTypeName.includes('casual')) {
          lifestyleImages.push(img.url);
        } else if (img.url && !classTypeName.includes('swatch')) {
          // Include other images except swatches (Detail, etc.)
          otherImages.push(img.url);
        }
      });

      // Return both the full images array AND organized views with ALL matching URLs
      mediaData.views = {
        front: frontImages.length > 0 ? frontImages[0] : null, // Keep first for backward compatibility
        rear: rearImages.length > 0 ? rearImages[0] : null,
        side: sideImages.length > 0 ? sideImages[0] : null,
        lifestyle: lifestyleImages.length > 0 ? lifestyleImages[0] : null,
        frontImages,
        rearImages,
        sideImages,
        lifestyleImages,
        otherImages,
      };

      console.log('Media Content organized:', {
        totalImages: mediaData.images.length,
        frontCount: frontImages.length,
        rearCount: rearImages.length,
        sideCount: sideImages.length,
        lifestyleCount: lifestyleImages.length,
        otherCount: otherImages.length,
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
