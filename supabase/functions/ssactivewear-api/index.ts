import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// PromoStandards SOAP endpoints
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

function buildProductDataSOAP(productId: string, accountNumber: string, apiKey: string, useJWT: boolean = false): string {
  const authFields = useJWT ? '' : `
      <ns:id>${accountNumber}</ns:id>
      <ns:password>${apiKey}</ns:password>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <soap:Body>
    <ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>${authFields}
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
      <ns:productId>${productId}</ns:productId>
    </ns:GetProductRequest>
  </soap:Body>
</soap:Envelope>`;
}

function buildInventorySOAP(productId: string, accountNumber: string, apiKey: string, useJWT: boolean = false): string {
  const authFields = useJWT ? '' : `
      <ns:id>${accountNumber}</ns:id>
      <ns:password>${apiKey}</ns:password>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/InventoryService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/InventoryService/2.0.0/SharedObjects/">
  <soap:Body>
    <ns:GetInventoryLevelsRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>${authFields}
      <ns:productId>${productId}</ns:productId>
    </ns:GetInventoryLevelsRequest>
  </soap:Body>
</soap:Envelope>`;
}

function buildPricingSOAP(productId: string, accountNumber: string, apiKey: string, useJWT: boolean = false): string {
  const authFields = useJWT ? '' : `
      <ns:id>${accountNumber}</ns:id>
      <ns:password>${apiKey}</ns:password>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <soap:Body>
    <ns:GetConfigurationAndPricingRequest>
      <ns:wsVersion>1.0.0</ns:wsVersion>${authFields}
      <ns:productId>${productId}</ns:productId>
      <ns:currency>USD</ns:currency>
      <ns:fobId>ALL</ns:fobId>
      <ns:priceType>Customer</ns:priceType>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetConfigurationAndPricingRequest>
  </soap:Body>
</soap:Envelope>`;
}

function buildMediaContentSOAP(productId: string, accountNumber: string, apiKey: string, useJWT: boolean = false): string {
  const authFields = useJWT ? '' : `
      <ns:id>${accountNumber}</ns:id>
      <ns:password>${apiKey}</ns:password>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
  <soap:Body>
    <ns:GetMediaContentRequest>
      <ns:wsVersion>1.0.0</ns:wsVersion>${authFields}
      <ns:productId>${productId}</ns:productId>
      <ns:mediaType>Image</ns:mediaType>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetMediaContentRequest>
  </soap:Body>
</soap:Envelope>`;
}

async function makeSOAPRequest(endpoint: string, soapXML: string, jwtToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": "",
  };

  // Add JWT authorization if provided
  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: soapXML,
  });

  const responseText = await response.text();

  console.log('SOAP Response:', {
    status: response.status,
    statusText: response.statusText,
    bodyLength: responseText.length,
    bodyPreview: responseText.substring(0, 500)
  });

  // Check for SOAP faults in the response
  if (responseText.includes('faultcode') || responseText.includes('Fault')) {
    console.error('SOAP Fault detected:', responseText.substring(0, 1000));

    // Extract fault message if available
    const faultMatch = responseText.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
    const faultMessage = faultMatch ? faultMatch[1] : 'Unknown SOAP fault';

    throw new Error(`SOAP Fault: ${faultMessage}`);
  }

  if (!response.ok) {
    throw new Error(`SOAP request failed: ${response.status} ${response.statusText}`);
  }

  return responseText;
}

function parseProductDataXML(xml: string): any {
  // Simple XML parsing - extract key product information
  const productIdMatch = xml.match(/<productId[^>]*>([^<]+)<\/productId>/i);
  const productNameMatch = xml.match(/<productName[^>]*>([^<]+)<\/productName>/i);
  const descriptionMatch = xml.match(/<description[^>]*>([^<]+)<\/description>/i);
  const productBrandMatch = xml.match(/<productBrand[^>]*>([^<]+)<\/productBrand>/i);

  // Extract all part information (colors/sizes)
  const partRegex = /<Part>([\s\S]*?)<\/Part>/gi;
  const parts = [];
  let partMatch;

  while ((partMatch = partRegex.exec(xml)) !== null) {
    const partXML = partMatch[1];
    const partIdMatch = partXML.match(/<partId[^>]*>([^<]+)<\/partId>/i);
    const colorNameMatch = partXML.match(/<colorName[^>]*>([^<]+)<\/colorName>/i);
    const labelSizeMatch = partXML.match(/<labelSize[^>]*>([^<]+)<\/labelSize>/i);

    if (partIdMatch) {
      parts.push({
        partId: partIdMatch[1],
        colorName: colorNameMatch ? colorNameMatch[1] : '',
        labelSize: labelSizeMatch ? labelSizeMatch[1] : '',
      });
    }
  }

  return {
    productId: productIdMatch ? productIdMatch[1] : '',
    productName: productNameMatch ? productNameMatch[1] : '',
    description: descriptionMatch ? descriptionMatch[1] : '',
    productBrand: productBrandMatch ? productBrandMatch[1] : '',
    parts,
  };
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
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Invalid JWT" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
      .from("integration_settings")
      .eq("company_id", profile.company_id)
      .select("ssactivewear_enabled, ssactivewear_credentials")
      .maybeSingle();

    if (!settings?.ssactivewear_enabled || !settings?.ssactivewear_credentials) {
      return new Response(
        JSON.stringify({ error: "SSActivewear credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = {
      accountNumber: settings.ssactivewear_credentials.accountNumber,
      apiKey: settings.ssactivewear_credentials.apiKey
    } as SSActivewearCredentials;

    // Decrypt the API key
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

    console.log('Decrypted API key first 10 chars:', decryptedApiKey?.substring(0, 10));
    console.log('Account number:', credentials.accountNumber);

    // Determine if we're using JWT authentication
    const useJWT = settings.ssactivewear_credentials.authType === 'jwt' || decryptedApiKey.includes('-');
    console.log('Using JWT authentication:', useJWT);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const productId = url.searchParams.get("productId") || url.searchParams.get("style");
    const partId = url.searchParams.get("partId");

    console.log('SSActivewear API Request:', { action, productId, partId });

    // Handle different actions
    switch (action) {
      case "product":
      case "search":
      case "colors": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID (style number) required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const soapXML = buildProductDataSOAP(productId, credentials.accountNumber, decryptedApiKey, useJWT);
        const responseXML = await makeSOAPRequest(PROMOSTANDARDS_ENDPOINTS.productData, soapXML, useJWT ? decryptedApiKey : undefined);
        const parsedData = parseProductDataXML(responseXML);

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: [parsedData], // Return as array for compatibility
            rawXML: responseXML,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "inventory": {
        const targetId = partId || productId;
        if (!targetId) {
          return new Response(
            JSON.stringify({ error: "Product ID or Part ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const soapXML = buildInventorySOAP(targetId, credentials.accountNumber, decryptedApiKey, useJWT);
        const responseXML = await makeSOAPRequest(PROMOSTANDARDS_ENDPOINTS.inventory, soapXML, useJWT ? decryptedApiKey : undefined);

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: responseXML,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "pricing": {
        const targetId = partId || productId;
        if (!targetId) {
          return new Response(
            JSON.stringify({ error: "Product ID or Part ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const soapXML = buildPricingSOAP(targetId, credentials.accountNumber, decryptedApiKey, useJWT);
        const responseXML = await makeSOAPRequest(PROMOSTANDARDS_ENDPOINTS.pricing, soapXML, useJWT ? decryptedApiKey : undefined);

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: responseXML,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "media": {
        const targetId = partId || productId;
        if (!targetId) {
          return new Response(
            JSON.stringify({ error: "Product ID or Part ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const soapXML = buildMediaContentSOAP(targetId, credentials.accountNumber, decryptedApiKey, useJWT);
        const responseXML = await makeSOAPRequest(PROMOSTANDARDS_ENDPOINTS.media, soapXML, useJWT ? decryptedApiKey : undefined);

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: responseXML,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: product, inventory, pricing, or media" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error: any) {
    console.error("SSActivewear API function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
