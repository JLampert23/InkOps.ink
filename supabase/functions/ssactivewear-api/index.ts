import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Max-Age": "86400",
};

const PROMOSTANDARDS_ENDPOINTS = {
  productData: "https://promostandards.ssactivewear.com/productdata/v2/productdataservicev2.svc",
  inventory: "https://promostandards.ssactivewear.com/inventory/v2/inventoryservice.svc",
  pricing: "https://promostandards.ssactivewear.com/pricingandconfiguration/v1/pricingandconfigurationservice.svc",
  media: "https://promostandards.ssactivewear.com/mediacontent/v1/mediacontentservice.svc",
};

interface SSActivewearCredentials {
  accountNumber: string;
  apiKey: string;
}

async function makePromoStandardsRequest(
  endpoint: string,
  soapAction: string,
  soapBody: string,
  accountNumber: string,
  apiKey: string
) {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    ${soapBody}
  </soap:Body>
</soap:Envelope>`;

  console.log('Making PromoStandards SOAP request:', {
    endpoint,
    soapAction,
    accountNumber: accountNumber.substring(0, 4) + '***',
    soapBodyPreview: soapBody.substring(0, 300)
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": soapAction,
    },
    body: soapEnvelope,
  });

  const responseText = await response.text();

  console.log('PromoStandards Response:', {
    status: response.status,
    statusText: response.statusText,
    bodyLength: responseText.length,
    bodyPreview: responseText.substring(0, 500)
  });

  if (!response.ok) {
    throw new Error(`PromoStandards request failed: ${response.status} ${response.statusText}\nResponse: ${responseText.substring(0, 500)}`);
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

function parseXmlResponse(xmlText: string): { success: boolean; xmlText?: string; error?: { code: string; description: string } } {
  const errorCode = getXmlValue(xmlText, 'code');
  const errorDesc = getXmlValue(xmlText, 'description');

  if (errorCode && errorDesc) {
    return {
      success: false,
      error: {
        code: errorCode,
        description: errorDesc
      }
    };
  }

  return {
    success: true,
    xmlText
  };
}

Deno.serve(async (req: Request) => {
  console.log("🚀 FUNCTION INVOKED - Method:", req.method, "URL:", req.url);

  if (req.method === "OPTIONS") {
    console.log("✅ OPTIONS request - returning CORS headers");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SSActivewear PromoStandards API Request Started ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if it's a service role key (internal call) or user JWT
    const token = authHeader.replace("Bearer ", "");
    const isServiceRoleKey = token === supabaseServiceRoleKey;

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
      console.log("Service role call - using company_id:", companyId);
    } else {
      // User JWT - validate using anon key client with user's JWT
      console.log("User JWT - validating token");

      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

      if (authError || !user) {
        console.error("Auth error:", authError);
        return new Response(
          JSON.stringify({ error: "Unauthorized", details: authError?.message }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user's company_id using service role client
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        return new Response(
          JSON.stringify({ error: "Company not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = profile.company_id;
      console.log("User authenticated - company_id:", companyId);
    }

    const { data: settings } = await supabase
      .from("company_settings")
      .select("ssactivewear_enabled, ssactivewear_username, ssactivewear_api_key_encrypted")
      .eq("id", companyId)
      .maybeSingle();

    if (!settings?.ssactivewear_enabled || !settings?.ssactivewear_api_key_encrypted || !settings?.ssactivewear_username) {
      return new Response(
        JSON.stringify({ error: "SSActivewear credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = {
      accountNumber: settings.ssactivewear_username,
      apiKey: settings.ssactivewear_api_key_encrypted
    } as SSActivewearCredentials;

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

    if (!decryptResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result: decryptedApiKey } = await decryptResponse.json();

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const productId = url.searchParams.get("productId") || url.searchParams.get("style");

    console.log('SSActivewear PromoStandards Request:', { action, productId });

    switch (action) {
      case "brands": {
        // Test actual connection by fetching a known SSActivewear product (Gildan 64000)
        console.log('🧪 Testing SSActivewear PromoStandards connection...');
        const testProductId = "64000";

        const soapBody = `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${credentials.accountNumber}</shar:id>
  <shar:password>${decryptedApiKey}</shar:password>
  <shar:productId>${testProductId}</shar:productId>
</ns2:GetProductRequest>`;

        try {
          const xmlResponse = await makePromoStandardsRequest(
            PROMOSTANDARDS_ENDPOINTS.productData,
            "getProduct",
            soapBody,
            credentials.accountNumber,
            decryptedApiKey
          );

          console.log('📥 SSActivewear test response received, length:', xmlResponse.length);

          // Check for authentication error
          if (xmlResponse.includes('AuthenticationError') || xmlResponse.includes('Invalid credentials') || xmlResponse.includes('Unauthorized')) {
            console.error('❌ SSActivewear authentication failed - invalid credentials');
            return new Response(
              JSON.stringify({
                success: false,
                supplier: "ssactivewear",
                action,
                authenticated: false,
                error: "Authentication failed - invalid credentials",
              }),
              {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }

          // Check for any SOAP fault
          if (xmlResponse.includes('soap:Fault') || xmlResponse.includes('faultstring')) {
            console.error('❌ SSActivewear API returned a SOAP fault');
            const faultString = getXmlValue(xmlResponse, 'faultstring') || 'Unknown error';
            return new Response(
              JSON.stringify({
                success: false,
                supplier: "ssactivewear",
                action,
                authenticated: false,
                error: `API error: ${faultString}`,
              }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }

          // Check for error code/description in response
          const parseResult = parseXmlResponse(xmlResponse);
          if (!parseResult.success) {
            console.error('❌ SSActivewear error response:', parseResult.error);
            return new Response(
              JSON.stringify({
                success: false,
                supplier: "ssactivewear",
                action,
                authenticated: false,
                error: `Connection test failed: ${parseResult.error?.description}`,
                errorCode: parseResult.error?.code,
              }),
              {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }

          // Verify we got a valid product response
          if (!xmlResponse.includes('GetProductResponse') && !xmlResponse.includes('productName')) {
            console.warn('⚠️ Unexpected response from SSActivewear API');
            return new Response(
              JSON.stringify({
                success: false,
                supplier: "ssactivewear",
                action,
                authenticated: false,
                error: "Unexpected API response format",
              }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }

          const productName = getXmlValue(parseResult.xmlText!, "productName");
          console.log('✅ SSActivewear connection test successful! Product found:', productName || testProductId);

          return new Response(
            JSON.stringify({
              success: true,
              supplier: "ssactivewear",
              action,
              message: `SSActivewear PromoStandards API connected! Test product found: ${productName || testProductId}`,
              authenticated: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        } catch (error: any) {
          console.error("❌ SSActivewear connection test failed:", error);
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "ssactivewear",
              action,
              authenticated: false,
              error: `Connection test failed: ${error.message}`,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
      }

      case "product":
      case "search": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID (style number) required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const soapBody = `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${credentials.accountNumber}</shar:id>
  <shar:password>${decryptedApiKey}</shar:password>
  <shar:productId>${productId}</shar:productId>
</ns2:GetProductRequest>`;

        const xmlResponse = await makePromoStandardsRequest(
          PROMOSTANDARDS_ENDPOINTS.productData,
          "getProduct",
          soapBody,
          credentials.accountNumber,
          decryptedApiKey
        );

        const parseResult = parseXmlResponse(xmlResponse);

        if (!parseResult.success) {
          console.error("PromoStandards error:", parseResult.error);
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "ssactivewear",
              action,
              error: `Product not found or API error: ${parseResult.error?.description}`,
              errorCode: parseResult.error?.code,
              data: []
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        const xmlDoc = parseResult.xmlText!;

        const productName = getXmlValue(xmlDoc, "productName") || "";
        const description = getXmlValue(xmlDoc, "description") || "";
        const productBrand = getXmlValue(xmlDoc, "productBrand") || "";

        const colorNames = getXmlValues(xmlDoc, "colorName");
        const partIds = getXmlValues(xmlDoc, "partId");
        const labelSizes = getXmlValues(xmlDoc, "labelSize");

        console.log("Product data parsed:", {
          productName,
          productBrand,
          colorCount: colorNames.length,
          partCount: partIds.length
        });

        const colorArray = colorNames.map(name => ({ colorName: name }));
        const partsArray = partIds.map((id, i) => ({
          partId: id,
          colorName: colorNames[i] || "",
          labelSize: labelSizes[i] || "",
        }));

        const transformedData = [{
          productId,
          productName,
          description,
          productBrand,
          colors: colorArray,
          parts: partsArray,
        }];

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: transformedData,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "inventory": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const soapBody = `<ns2:GetInventoryLevelsRequest xmlns:ns2="http://www.promostandards.org/WSDL/InventoryService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${credentials.accountNumber}</shar:id>
  <shar:password>${decryptedApiKey}</shar:password>
  <shar:productId>${productId}</shar:productId>
</ns2:GetInventoryLevelsRequest>`;

        const xmlResponse = await makePromoStandardsRequest(
          PROMOSTANDARDS_ENDPOINTS.inventory,
          "getInventoryLevels",
          soapBody,
          credentials.accountNumber,
          decryptedApiKey
        );

        const parseResult = parseXmlResponse(xmlResponse);

        if (!parseResult.success) {
          console.error("PromoStandards error:", parseResult.error);
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "ssactivewear",
              action,
              error: `Inventory not found or API error: ${parseResult.error?.description}`,
              errorCode: parseResult.error?.code,
              data: []
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        const xmlDoc = parseResult.xmlText!;

        const partIds = getXmlValues(xmlDoc, "partId");
        const quantities = getXmlValues(xmlDoc, "quantityAvailable");

        const inventoryArray = partIds.map((id, i) => ({
          partId: id,
          quantityAvailable: parseInt(quantities[i] || "0"),
        }));

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: inventoryArray,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "pricing": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const soapBody = `<ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${credentials.accountNumber}</shar:id>
  <shar:password>${decryptedApiKey}</shar:password>
  <shar:productId>${productId}</shar:productId>
</ns2:GetConfigurationAndPricingRequest>`;

        const xmlResponse = await makePromoStandardsRequest(
          PROMOSTANDARDS_ENDPOINTS.pricing,
          "getConfigurationAndPricing",
          soapBody,
          credentials.accountNumber,
          decryptedApiKey
        );

        const parseResult = parseXmlResponse(xmlResponse);

        if (!parseResult.success) {
          console.error("PromoStandards error:", parseResult.error);
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "ssactivewear",
              action,
              error: `Pricing not found or API error: ${parseResult.error?.description}`,
              errorCode: parseResult.error?.code,
              data: []
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        const xmlDoc = parseResult.xmlText!;

        // SSActivewear returns pricing in nested Part/PartPrice structure
        const partPattern = /<Part>([\s\S]*?)<\/Part>/gi;
        const parts: any[] = [];
        let partMatch;

        while ((partMatch = partPattern.exec(xmlDoc)) !== null) {
          const partXml = partMatch[1];
          const partId = getXmlValue(partXml, "partId");

          // Extract PartPrice elements within this Part
          const pricePattern = /<PartPrice>([\s\S]*?)<\/PartPrice>/gi;
          const prices: any[] = [];
          let priceMatch;

          while ((priceMatch = pricePattern.exec(partXml)) !== null) {
            const priceXml = priceMatch[1];
            prices.push({
              quantity: parseInt(getXmlValue(priceXml, "minQuantity") || "1"),
              price: parseFloat(getXmlValue(priceXml, "price") || "0"),
            });
          }

          parts.push({
            partId,
            prices
          });
        }

        const partArray = parts;

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: partArray,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "media": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const partId = url.searchParams.get("partId");

        const partIdTag = partId ? `<shar:partId>${partId}</shar:partId>` : '';

        const soapBody = `<ns2:GetMediaContentRequest xmlns:ns2="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${credentials.accountNumber}</shar:id>
  <shar:password>${decryptedApiKey}</shar:password>
  <shar:mediaType>Image</shar:mediaType>
  <shar:productId>${productId}</shar:productId>
  ${partIdTag}
</ns2:GetMediaContentRequest>`;

        const xmlResponse = await makePromoStandardsRequest(
          PROMOSTANDARDS_ENDPOINTS.media,
          "getMediaContent",
          soapBody,
          credentials.accountNumber,
          decryptedApiKey
        );

        const parseResult = parseXmlResponse(xmlResponse);

        if (!parseResult.success) {
          console.error("PromoStandards error:", parseResult.error);
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "ssactivewear",
              action,
              error: `Media not found or API error: ${parseResult.error?.description}`,
              errorCode: parseResult.error?.code,
              data: {
                productId,
                partId: partId || null,
                mediaContent: []
              }
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        const xmlDoc = parseResult.xmlText!;

        console.log("Media XML Response Preview:", xmlDoc.substring(0, 2000));

        const urls = getXmlValues(xmlDoc, "url");
        const classTypeNames = getXmlValues(xmlDoc, "classTypeName");
        const productIds = getXmlValues(xmlDoc, "productId");
        const colors = getXmlValues(xmlDoc, "color");
        const partIds = getXmlValues(xmlDoc, "partId");
        const singleParts = getXmlValues(xmlDoc, "singlePart");

        console.log(`Parsed media data: ${urls.length} URLs, ${classTypeNames.length} classTypeNames, ${colors.length} colors, ${partIds.length} partIds`);

        const mediaArray = urls.map((url, i) => {
          const classTypeName = classTypeNames[i] || "";

          // Check if this is an actual image URL
          const hasImageExtension = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)(\?|$)/i);
          const isWebPage = url.match(/\.(aspx|html|htm|php|jsp|asp)(\?|$)/i);
          const isImageUrl = !isWebPage && hasImageExtension;

          return {
            url,
            productId: productIds[i] || "",
            partId: partIds[i] || "",
            classTypeName,
            color: colors[i] || "",
            singlePart: singleParts[i] === "true",
            isImage: isImageUrl,
          };
        }).filter(item => item.isImage);

        console.log(`Filtered to ${mediaArray.length} actual images`);
        if (mediaArray.length > 0) {
          console.log("First image:", mediaArray[0]);
        }

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: {
              productId,
              partId: partId || null,
              mediaContent: mediaArray,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: brands, product, search, inventory, pricing, or media" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error: any) {
    console.error("SSActivewear PromoStandards API error:", error);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
