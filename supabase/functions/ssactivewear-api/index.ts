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

function parseXmlResponse(xmlText: string): string {
  const errorCode = getXmlValue(xmlText, 'code');
  const errorDesc = getXmlValue(xmlText, 'description');

  if (errorCode && errorDesc) {
    throw new Error(`PromoStandards Error ${errorCode}: ${errorDesc}`);
  }

  return xmlText;
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

    // Log all incoming headers (for debugging)
    console.log("=== DIAGNOSTIC: Incoming Headers ===");
    const allHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      // Mask sensitive values but show they exist
      if (key.toLowerCase() === 'authorization') {
        allHeaders[key] = value.substring(0, 20) + '...' + value.substring(value.length - 10);
      } else {
        allHeaders[key] = value;
      }
    });
    console.log("Headers received:", allHeaders);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Log environment variables status
    console.log("=== DIAGNOSTIC: Environment Variables ===");
    console.log("SUPABASE_URL present:", !!supabaseUrl);
    console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!supabaseServiceRoleKey);
    console.log("SUPABASE_URL value:", supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING');

    const authHeader = req.headers.get("Authorization");

    console.log("=== DIAGNOSTIC: Authorization Header ===");
    console.log("Authorization header present:", !!authHeader);
    if (authHeader) {
      console.log("Authorization header format:", authHeader.substring(0, 10) + '...');
      console.log("Authorization header length:", authHeader.length);
      console.log("Starts with 'Bearer ':", authHeader.startsWith('Bearer '));
    }

    if (!authHeader) {
      console.error("DIAGNOSTIC ERROR: Authorization header is missing!");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    console.log("=== DIAGNOSTIC: JWT Token ===");
    console.log("Token extracted successfully:", !!token);
    console.log("Token length:", token.length);
    console.log("Token preview (first 20 chars):", token.substring(0, 20) + '...');
    console.log("Token preview (last 10 chars):", '...' + token.substring(token.length - 10));

    console.log("=== DIAGNOSTIC: Creating Supabase Client ===");
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log("Supabase client created successfully");

    console.log("=== DIAGNOSTIC: Validating JWT with getUser() ===");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    console.log("=== DIAGNOSTIC: getUser() Result ===");
    console.log("User present:", !!user);
    console.log("Auth error present:", !!authError);
    if (user) {
      console.log("User ID:", user.id);
      console.log("User email:", user.email);
    }
    if (authError) {
      console.error("Auth error details:", {
        name: authError.name,
        message: authError.message,
        status: authError.status,
        code: authError.code
      });
    }

    if (authError || !user) {
      console.error("DIAGNOSTIC ERROR: JWT validation failed!");
      console.error("Full auth error object:", JSON.stringify(authError, null, 2));
      return new Response(
        JSON.stringify({
          code: 401,
          message: "Invalid JWT",
          details: authError?.message,
          errorName: authError?.name,
          errorCode: authError?.code,
          errorStatus: authError?.status
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== DIAGNOSTIC: JWT Validation Passed ===");

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

    const { data: settings } = await supabase
      .from("company_settings")
      .select("ssactivewear_enabled, ssactivewear_username, ssactivewear_api_key_encrypted")
      .eq("id", profile.company_id)
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
        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            message: "SSActivewear connection verified. Use 'product' action to search products.",
            authenticated: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
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

        const xmlDoc = parseXmlResponse(xmlResponse);

        const productName = getXmlValue(xmlDoc, "productName") || "";
        const description = getXmlValue(xmlDoc, "description") || "";
        const productBrand = getXmlValue(xmlDoc, "productBrand") || "";

        const colorNames = getXmlValues(xmlDoc, "colorName");
        const partIds = getXmlValues(xmlDoc, "partId");
        const labelSizes = getXmlValues(xmlDoc, "labelSize");

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

        const xmlDoc = parseXmlResponse(xmlResponse);

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

        const xmlDoc = parseXmlResponse(xmlResponse);

        const partIds = getXmlValues(xmlDoc, "partId");
        const quantities = getXmlValues(xmlDoc, "quantity");
        const prices = getXmlValues(xmlDoc, "price");

        const partArray = partIds.map((id) => ({
          partId: id,
          prices: prices.map((price, i) => ({
            quantity: parseInt(quantities[i] || "0"),
            price: parseFloat(price),
          })),
        }));

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

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: brands, product, search, inventory, or pricing" }),
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
