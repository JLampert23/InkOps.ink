import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log('🚀 PromoStandards Unified - Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceRoleKey
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

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
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
      // User JWT - validate and get company_id from profile
      console.log('👤 User JWT - validating token...');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

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

    // Make all 4 requests in parallel
    const [productResponse, inventoryResponse, pricingResponse, mediaResponse] = await Promise.allSettled([
      // 1. Product Data
      makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.productData,
        "getProduct",
        `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${credentials.accountNumber}</shar:id>
  <shar:password>${decryptedApiKey}</shar:password>
  <shar:productId>${styleNumber}</shar:productId>
</ns2:GetProductRequest>`
      ),
      // 2. Inventory (if partId provided, otherwise skip)
      partId ? makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.inventory,
        "getInventoryLevels",
        `<ns2:GetInventoryLevelsRequest xmlns:ns2="http://www.promostandards.org/WSDL/InventoryService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${credentials.accountNumber}</shar:id>
  <shar:password>${decryptedApiKey}</shar:password>
  <shar:productId>${partId}</shar:productId>
</ns2:GetInventoryLevelsRequest>`
      ) : Promise.resolve(null),
      // 3. Pricing (if partId provided, otherwise skip)
      partId ? makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.pricing,
        "getConfigurationAndPricing",
        `<ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${credentials.accountNumber}</shar:id>
  <shar:password>${decryptedApiKey}</shar:password>
  <shar:productId>${partId}</shar:productId>
  <shar:currency>USD</shar:currency>
  <shar:priceType>Customer</shar:priceType>
</ns2:GetConfigurationAndPricingRequest>`
      ) : Promise.resolve(null),
      // 4. Media Content (if partId provided, otherwise skip)
      partId ? makePromoStandardsRequest(
        PROMOSTANDARDS_ENDPOINTS.media,
        "getMediaContent",
        `<ns2:GetMediaContentRequest xmlns:ns2="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${credentials.accountNumber}</shar:id>
  <shar:password>${decryptedApiKey}</shar:password>
  <shar:productId>${partId}</shar:productId>
  <shar:mediaType>Image</shar:mediaType>
</ns2:GetMediaContentRequest>`
      ) : Promise.resolve(null),
    ]);

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

    // Parse Pricing
    const pricingData: any = {};
    if (pricingResponse.status === 'fulfilled' && pricingResponse.value) {
      const xmlDoc = pricingResponse.value;
      const partPattern = /<Part>([\s\S]*?)<\/Part>/gi;
      const partMatches = getAllXmlMatches(xmlDoc, partPattern);

      pricingData.parts = partMatches.map(match => {
        const partXml = match[1];
        const pricePattern = /<Price>([\s\S]*?)<\/Price>/gi;
        const priceMatches = getAllXmlMatches(partXml, pricePattern);

        return {
          partId: getXmlValue(partXml, "partId"),
          prices: priceMatches.map(priceMatch => {
            const priceXml = priceMatch[1];
            return {
              minQuantity: parseInt(getXmlValue(priceXml, "minQuantity") || "0"),
              price: parseFloat(getXmlValue(priceXml, "price") || "0"),
              discountCode: getXmlValue(priceXml, "discountCode"),
            };
          })
        };
      });
    }

    // Parse Media Content
    const mediaData: any = {};
    if (mediaResponse.status === 'fulfilled' && mediaResponse.value) {
      const xmlDoc = mediaResponse.value;
      const mediaPattern = /<Media>([\s\S]*?)<\/Media>/gi;
      const mediaMatches = getAllXmlMatches(xmlDoc, mediaPattern);

      mediaData.images = mediaMatches.map(match => {
        const mediaXml = match[1];
        return {
          url: getXmlValue(mediaXml, "url"),
          partId: getXmlValue(mediaXml, "partId"),
          description: getXmlValue(mediaXml, "description"),
          fileType: getXmlValue(mediaXml, "fileType"),
          classType: getXmlValue(mediaXml, "classType"),
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
        const desc = (img.description || '').toLowerCase();
        const classType = (img.classType || '').toLowerCase();

        if (desc.includes('front') || classType.includes('front')) {
          frontImages.push(img.url);
        } else if (desc.includes('rear') || classType.includes('rear') || desc.includes('back') || classType.includes('back')) {
          rearImages.push(img.url);
        } else if (desc.includes('side') || classType.includes('side') || desc.includes('sleeve') || classType.includes('sleeve')) {
          sideImages.push(img.url);
        } else if (desc.includes('lifestyle') || classType.includes('lifestyle') || desc.includes('casual') || classType.includes('casual')) {
          lifestyleImages.push(img.url);
        } else if (img.url && !desc.includes('swatch') && !classType.includes('swatch')) {
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
