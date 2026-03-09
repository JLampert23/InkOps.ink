import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-User-Token",
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

const VALID_SS_FOB_IDS = ['IL', 'KS', 'NJ', 'TX', 'GA', 'NV', 'DS'];

/**
 * Normalizes a user-facing style number for S&S MediaContent API.
 * S&S Activewear MediaContent uses the RAW style number (NOT B-prefixed like SanMar).
 * Example: "pc54" -> "PC54", "5000" -> "5000", "G500" -> "G500"
 *
 * NOTE: The "B" prefix is for SanMar, NOT S&S Activewear.
 */
function getSsMediaStyleNumber(styleNumber: string): string {
  if (!styleNumber) return '';

  // Remove non-alphanumeric characters and uppercase
  const cleaned = styleNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  // If incorrectly starts with B followed by letters (like BPC54), remove the B
  // This handles cases where SanMar-style IDs were mistakenly passed
  if (cleaned.startsWith('B') && cleaned.length > 1) {
    const afterB = cleaned.substring(1);
    // If the part after B has letters, it was likely a SanMar-style ID
    if (/[A-Z]/.test(afterB) && !/^\d+$/.test(afterB)) {
      return afterB;
    }
    // If it's like B5000 (B + pure numbers), also strip the B for S&S
    if (/^\d+$/.test(afterB)) {
      return afterB;
    }
  }

  return cleaned;
}

function normalizeSsProductId(input: string): string {
  if (!input) return '';
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function validateFobId(fobId: string | null): string {
  if (!fobId) return 'NJ';
  const upperFob = fobId.toUpperCase();
  return VALID_SS_FOB_IDS.includes(upperFob) ? upperFob : 'NJ';
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
  const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tagName}[^>]*>([^<]*)</(?:[a-zA-Z0-9]+:)?${tagName}>`, 'i');
  const match = xmlText.match(regex);
  return match ? match[1] : null;
}

function getXmlValues(xmlText: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'gi');
  const matches = xmlText.matchAll(regex);
  return Array.from(matches, m => m[1]);
}

function parseXmlResponse(xmlText: string): { success: boolean; xmlText?: string; error?: { code: string; description: string } } {
  if (xmlText.includes('soap:Fault') || xmlText.includes('faultstring')) {
    const faultString = getXmlValue(xmlText, 'faultstring') || 'Unknown SOAP fault';
    return {
      success: false,
      error: { code: 'SOAP_FAULT', description: faultString }
    };
  }

  const errorCodeMatch = xmlText.match(/<errorCode[^>]*>([^<]*)<\/errorCode>/i);
  const errorMessageMatch = xmlText.match(/<errorMessage[^>]*>([^<]*)<\/errorMessage>/i);

  if (errorCodeMatch && errorMessageMatch) {
    return {
      success: false,
      error: {
        code: errorCodeMatch[1],
        description: errorMessageMatch[1]
      }
    };
  }

  // Check for authentication failures in product name or description
  const productNameLower = (getXmlValue(xmlText, 'productName') || '').toLowerCase();
  const descriptionLower = (getXmlValue(xmlText, 'description') || '').toLowerCase();

  if (productNameLower.includes('authentication') ||
      productNameLower.includes('credentials failed') ||
      productNameLower.includes('unauthorized') ||
      descriptionLower.includes('authentication') ||
      descriptionLower.includes('credentials failed') ||
      descriptionLower.includes('unauthorized')) {
    return {
      success: false,
      error: {
        code: 'AUTH_FAILED',
        description: 'Authentication Credentials failed - check your SSActivewear username and API key'
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

    console.log("🔧 Edge Function environment:", {
      supabaseUrl: supabaseUrl?.substring(0, 40) + "...",
      hasServiceRole: !!supabaseServiceRoleKey
    });

    const userToken = req.headers.get("X-User-Token") || "";
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "") || "";
    const isServiceRoleKey = bearerToken === supabaseServiceRoleKey;
    const token = isServiceRoleKey ? bearerToken : (userToken || bearerToken);

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔑 Auth check:", {
      tokenLength: token.length,
      tokenStart: token.substring(0, 20),
      isServiceRoleKey
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
      console.log("Service role call - using company_id:", companyId);
    } else {
      // User JWT - validate using anon key client with user's JWT
      console.log("User JWT - validating token");

      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      console.log("🔧 Using anon key:", {
        hasAnonKey: !!supabaseAnonKey,
        anonKeyLength: supabaseAnonKey?.length
      });

      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      console.log("🔍 Decoding JWT...");
      // Decode JWT to get user ID (JWT is already validated by API Gateway)
      const jwtParts = token.split('.');
      if (jwtParts.length !== 3) {
        console.error("❌ Invalid JWT format");
        return new Response(
          JSON.stringify({ code: 401, message: "Invalid JWT format" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let userId: string;
      try {
        const payload = JSON.parse(atob(jwtParts[1]));
        userId = payload.sub;
        console.log("✅ JWT decoded, user ID:", userId);
      } catch (e) {
        console.error("❌ Failed to decode JWT:", e);
        return new Response(
          JSON.stringify({ code: 401, message: "Failed to decode JWT" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user's company_id using service role client
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("company_id")
        .eq("id", userId)
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
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
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

    console.log('🔐 Decrypted API key info:', {
      length: decryptedApiKey?.length,
      startsWithWhitespace: decryptedApiKey?.trim() !== decryptedApiKey,
      hasNewlines: decryptedApiKey?.includes('\n') || decryptedApiKey?.includes('\r'),
      first10: decryptedApiKey?.substring(0, 10),
      last10: decryptedApiKey?.substring(decryptedApiKey.length - 10)
    });

    // Trim any whitespace from credentials
    const cleanedApiKey = decryptedApiKey.trim();
    const cleanedAccountNumber = credentials.accountNumber.trim();

    console.log('🔐 Cleaned credentials:', {
      accountNumber: cleanedAccountNumber,
      apiKeyLength: cleanedApiKey.length,
      apiKeyFirst10: cleanedApiKey.substring(0, 10)
    });

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const productId = url.searchParams.get("productId") || url.searchParams.get("style");

    console.log('SSActivewear PromoStandards Request:', { action, productId });

    switch (action) {
      case "brands": {
        console.log('');
        console.log('==================================================');
        console.log('🧪 SSActivewear CONNECTION TEST - CALLING LIVE API');
        console.log('==================================================');
        console.log('📍 This is NOT using cached data from the database');
        console.log('📍 Making a REAL HTTP request to SSActivewear servers');
        console.log('📍 Endpoint: https://promostandards.ssactivewear.com');
        console.log('==================================================');
        console.log('');

        const testProductId = "64000";

        const soapBody = `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${escapeXml(credentials.accountNumber)}</shar:id>
  <shar:password>${escapeXml(decryptedApiKey)}</shar:password>
  <shar:productId>${testProductId}</shar:productId>
</ns2:GetProductRequest>`;

        try {
          console.log('🌐 Calling makePromoStandardsRequest...');
          console.log('🌐 Target: SSActivewear PromoStandards SOAP API');
          console.log('🌐 Action: getProduct');
          console.log('🌐 Product ID:', testProductId);

          const xmlResponse = await makePromoStandardsRequest(
            PROMOSTANDARDS_ENDPOINTS.productData,
            "getProduct",
            soapBody,
            cleanedAccountNumber,
            cleanedApiKey
          );

          console.log('');
          console.log('✅ RECEIVED RESPONSE FROM SSACTIVEWEAR SERVERS');
          console.log('📥 Response length:', xmlResponse.length, 'bytes');
          console.log('📥 Response preview (first 500 chars):', xmlResponse.substring(0, 500));
          console.log('');

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

        const normalizedProductId = normalizeSsProductId(productId);
        console.log(`[SS Product] Raw input: "${productId}" -> Normalized: "${normalizedProductId}"`);

        const soapBody = `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${escapeXml(credentials.accountNumber)}</shar:id>
  <shar:password>${escapeXml(decryptedApiKey)}</shar:password>
  <shar:productId>${escapeXml(normalizedProductId)}</shar:productId>
</ns2:GetProductRequest>`;

        console.log(`[SS Product] SOAP Request Body:\n${soapBody}`);

        const xmlResponse = await makePromoStandardsRequest(
          PROMOSTANDARDS_ENDPOINTS.productData,
          "getProduct",
          soapBody,
          credentials.accountNumber,
          decryptedApiKey
        );

        console.log(`[SS Product] SOAP Response (first 1000 chars):\n${xmlResponse.substring(0, 1000)}`);

        const parseResult = parseXmlResponse(xmlResponse);

        if (!parseResult.success) {
          console.error(`[SS Product] PromoStandards error for ${normalizedProductId}:`, parseResult.error);
          return new Response(
            JSON.stringify({
              success: false,
              vendor: "SSActivewear",
              supplier: "ssactivewear",
              action,
              error: "ProductNotFound",
              productId: normalizedProductId,
              rawInput: productId,
              errorDetails: parseResult.error?.description,
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

        console.log(`[SS Product] Parsed for ${normalizedProductId}:`, {
          productName,
          productBrand,
          colorCount: colorNames.length,
          partCount: partIds.length
        });

        if (partIds.length === 0) {
          console.warn(`[SS Product] No parts returned for ${normalizedProductId}`);
          return new Response(
            JSON.stringify({
              success: false,
              vendor: "SSActivewear",
              supplier: "ssactivewear",
              action,
              error: "ProductNotFound",
              productId: normalizedProductId,
              rawInput: productId,
              errorDetails: "No parts returned from S&S API",
              data: []
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        const colorArray = colorNames.map(name => ({ colorName: name }));
        const partsArray = partIds.map((id, i) => ({
          partId: id,
          colorName: colorNames[i] || "",
          labelSize: labelSizes[i] || "",
        }));

        const transformedData = [{
          productId: normalizedProductId,
          rawInput: productId,
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

        const normalizedProductId = normalizeSsProductId(productId);
        const fobId = validateFobId(url.searchParams.get("fobId"));
        console.log(`[SS Inventory] Raw input: "${productId}" -> Normalized: "${normalizedProductId}", FOB: ${fobId}`);

        const soapBody = `<ns2:GetInventoryLevelsRequest xmlns:ns2="http://www.promostandards.org/WSDL/InventoryService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${escapeXml(credentials.accountNumber)}</shar:id>
  <shar:password>${escapeXml(decryptedApiKey)}</shar:password>
  <shar:productId>${escapeXml(normalizedProductId)}</shar:productId>
</ns2:GetInventoryLevelsRequest>`;

        console.log(`[SS Inventory] SOAP Request Body:\n${soapBody}`);

        const xmlResponse = await makePromoStandardsRequest(
          PROMOSTANDARDS_ENDPOINTS.inventory,
          "getInventoryLevels",
          soapBody,
          credentials.accountNumber,
          decryptedApiKey
        );

        console.log(`[SS Inventory] SOAP Response (first 1000 chars):\n${xmlResponse.substring(0, 1000)}`);

        const parseResult = parseXmlResponse(xmlResponse);

        if (!parseResult.success) {
          console.error(`[SS Inventory] PromoStandards error for ${normalizedProductId}:`, parseResult.error);
          return new Response(
            JSON.stringify({
              success: false,
              vendor: "SSActivewear",
              supplier: "ssactivewear",
              action,
              error: "ProductNotFound",
              productId: normalizedProductId,
              rawInput: productId,
              errorDetails: parseResult.error?.description,
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

        console.log(`[SS Inventory] Found ${partIds.length} parts for ${normalizedProductId}`);

        if (partIds.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              vendor: "SSActivewear",
              supplier: "ssactivewear",
              action,
              error: "ProductNotFound",
              productId: normalizedProductId,
              rawInput: productId,
              errorDetails: "No inventory data returned",
              data: []
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        const inventoryArray = partIds.map((id, i) => ({
          partId: id,
          quantityAvailable: parseInt(quantities[i] || "0"),
        }));

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            productId: normalizedProductId,
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

        const normalizedProductId = normalizeSsProductId(productId);
        const fobId = validateFobId(url.searchParams.get("fobId"));
        console.log(`[SS Pricing] Raw input: "${productId}" -> Normalized: "${normalizedProductId}", FOB: ${fobId}`);

        const pricingIdsToTry: string[] = [normalizedProductId];

        const isAlreadyInternalId = /^B\d{4,5}$/i.test(normalizedProductId);
        if (!isAlreadyInternalId) {
          console.log(`[SS Pricing] Input "${normalizedProductId}" does not look like an internal ID (B#####), fetching Product Data to extract it...`);
          try {
            const prodSoapBody = `<ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${escapeXml(credentials.accountNumber)}</shar:id>
  <shar:password>${escapeXml(decryptedApiKey)}</shar:password>
  <shar:productId>${escapeXml(normalizedProductId)}</shar:productId>
</ns2:GetProductRequest>`;

            const prodXml = await makePromoStandardsRequest(
              PROMOSTANDARDS_ENDPOINTS.productData,
              "getProduct",
              prodSoapBody,
              credentials.accountNumber,
              decryptedApiKey
            );

            const partIdMatches = Array.from(
              prodXml.matchAll(/<(?:[a-zA-Z0-9]+:)?partId[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?partId>/gi),
              m => m[1].trim()
            );
            const bPrefixed = partIdMatches.find(id => /^B\d{5,}/i.test(id));
            if (bPrefixed) {
              const internalId = bPrefixed.substring(0, 6).toUpperCase();
              console.log(`[SS Pricing] Extracted internal pricing ID: ${bPrefixed} -> ${internalId}`);
              pricingIdsToTry.unshift(internalId);
            } else {
              console.log(`[SS Pricing] No B-prefixed partId found in Product Data response`);
            }
          } catch (prodErr: any) {
            console.warn(`[SS Pricing] Failed to fetch Product Data for internal ID extraction: ${prodErr.message}`);
          }
        }

        let parts: any[] = [];
        let usedPricingId = normalizedProductId;

        for (const pricingId of pricingIdsToTry) {
          console.log(`[SS Pricing] Trying pricing with productId: "${pricingId}"`);

          const soapBody = `<ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${escapeXml(credentials.accountNumber)}</shar:id>
  <shar:password>${escapeXml(decryptedApiKey)}</shar:password>
  <shar:productId>${escapeXml(pricingId)}</shar:productId>
  <shar:currency>USD</shar:currency>
  <shar:fobId>${escapeXml(fobId)}</shar:fobId>
  <shar:priceType>Customer</shar:priceType>
  <shar:localizationCountry>US</shar:localizationCountry>
  <shar:localizationLanguage>en</shar:localizationLanguage>
  <shar:configurationType>Blank</shar:configurationType>
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
            console.warn(`[SS Pricing] Error for "${pricingId}": ${parseResult.error?.description}`);
            continue;
          }

          const xmlDoc = parseResult.xmlText!;
          const partPattern = /<(?:[a-zA-Z0-9]+:)?Part[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?Part>/gi;
          let partMatch;

          while ((partMatch = partPattern.exec(xmlDoc)) !== null) {
            const partXml = partMatch[1];
            const partId = getXmlValue(partXml, "partId");

            const pricePattern = /<(?:[a-zA-Z0-9]+:)?PartPrice[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?PartPrice>/gi;
            const prices: any[] = [];
            let priceMatch;

            while ((priceMatch = pricePattern.exec(partXml)) !== null) {
              const priceXml = priceMatch[1];
              prices.push({
                quantity: parseInt(getXmlValue(priceXml, "minQuantity") || "1"),
                price: parseFloat(getXmlValue(priceXml, "price") || "0"),
              });
            }

            parts.push({ partId, prices });
          }

          if (parts.length > 0) {
            usedPricingId = pricingId;
            console.log(`[SS Pricing] SUCCESS with "${pricingId}": ${parts.length} parts with pricing`);
            break;
          } else {
            console.log(`[SS Pricing] No parts returned for "${pricingId}", trying next...`);
          }
        }

        if (parts.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              vendor: "SSActivewear",
              supplier: "ssactivewear",
              action,
              error: "ProductNotFound",
              productId: normalizedProductId,
              rawInput: productId,
              errorDetails: "No pricing data returned",
              triedIds: pricingIdsToTry,
              data: []
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            productId: usedPricingId,
            data: parts,
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
        const colorName = url.searchParams.get("colorName");
        const partIdTag = partId ? `<shar:partId>${escapeXml(partId)}</shar:partId>` : '';

        const mediaProductId = getSsMediaStyleNumber(productId);
        console.log(`[SS Media] Raw input: "${productId}" -> MediaContent productId: "${mediaProductId}", partId: "${partId || 'none'}", colorName: "${colorName || 'none'}"`);

        const soapBody = `<ns2:GetMediaContentRequest xmlns:ns2="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${escapeXml(credentials.accountNumber)}</shar:id>
  <shar:password>${escapeXml(decryptedApiKey)}</shar:password>
  <shar:mediaType>Image</shar:mediaType>
  <shar:productId>${escapeXml(mediaProductId)}</shar:productId>
  ${partIdTag}
</ns2:GetMediaContentRequest>`;

        console.log(`[SS Media] SOAP Request Body:\n${soapBody}`);

        const xmlResponse = await makePromoStandardsRequest(
          PROMOSTANDARDS_ENDPOINTS.media,
          "getMediaContent",
          soapBody,
          credentials.accountNumber,
          decryptedApiKey
        );

        console.log(`[SS Media] SOAP Response (first 1000 chars):\n${xmlResponse.substring(0, 1000)}`);

        const parseResult = parseXmlResponse(xmlResponse);

        if (!parseResult.success) {
          const is404 = parseResult.error?.code === '404' ||
                        parseResult.error?.description?.toLowerCase().includes('not found') ||
                        parseResult.error?.description?.toLowerCase().includes('no media');
          console.error(`[SS Media] PromoStandards error for ${mediaProductId}:`, parseResult.error);
          if (is404) {
            console.error(`[SS Media] 404 NOT FOUND - productId "${mediaProductId}" returned no media content`);
          }
          return new Response(
            JSON.stringify({
              success: false,
              vendor: "SSActivewear",
              supplier: "ssactivewear",
              action,
              error: "ProductNotFound",
              productId: mediaProductId,
              rawInput: productId,
              errorDetails: parseResult.error?.description,
              errorCode: parseResult.error?.code,
              data: {
                productId: mediaProductId,
                partId: partId || null,
                mediaContent: [],
                views: { front: null, back: null, side: null }
              }
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        const xmlDoc = parseResult.xmlText!;

        const urls = getXmlValues(xmlDoc, "url");
        const classTypeNames = getXmlValues(xmlDoc, "classTypeName");
        const productIds = getXmlValues(xmlDoc, "productId");
        const colors = getXmlValues(xmlDoc, "color");
        const partIds = getXmlValues(xmlDoc, "partId");
        const singleParts = getXmlValues(xmlDoc, "singlePart");

        console.log(`[SS Media] Parsed media data for ${mediaProductId}: ${urls.length} URLs`);

        if (urls.length === 0) {
          console.error(`[SS Media] 404 - No media content returned for productId "${mediaProductId}"`);
        }

        // Parse all images
        const allImages = urls.map((url, i) => {
          const classTypeName = classTypeNames[i] || "";
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

        console.log(`[SS Media] Total valid images: ${allImages.length}`);

        // FILTER BY COLOR (partId or colorName)
        let filteredImages = allImages;

        if (partId) {
          filteredImages = allImages.filter(img => img.partId === partId);
          console.log(`[SS Media] Filtered by partId "${partId}": ${filteredImages.length} images`);
        }

        if (filteredImages.length === 0 && colorName) {
          const lowerColorName = colorName.toLowerCase();
          filteredImages = allImages.filter(img => img.color?.toLowerCase() === lowerColorName);
          console.log(`[SS Media] Filtered by colorName "${colorName}": ${filteredImages.length} images`);
        }

        if (filteredImages.length === 0 && (partId || colorName)) {
          filteredImages = allImages.filter(img => img.singlePart === true);
          console.log(`[SS Media] Fallback to singlePart images: ${filteredImages.length} images`);
        }

        if (filteredImages.length === 0) {
          filteredImages = allImages;
          console.warn(`[SS Media] No color-specific images found, using all ${allImages.length} images`);
        }

        // EXTRACT ONLY Front/Rear/Side views
        const frontImg = filteredImages.find(img => img.classTypeName?.toLowerCase() === 'front');
        const rearImg = filteredImages.find(img =>
          img.classTypeName?.toLowerCase() === 'rear' || img.classTypeName?.toLowerCase() === 'back'
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

        // Build the views object with ONLY front/back/side
        const views = {
          front: frontImg?.url || null,
          back: rearImg?.url || null,
          side: sideImg?.url || null,
        };

        console.log(`[SS Media] Color-filtered views for ${mediaProductId}:`, {
          partId,
          colorName,
          filteredCount: filteredImages.length,
          front: !!views.front,
          back: !!views.back,
          side: !!views.side,
        });

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: {
              productId: mediaProductId,
              rawInput: productId,
              partId: partId || null,
              colorName: colorName || null,
              mediaContent: filteredImages,
              views,
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
