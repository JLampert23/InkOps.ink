import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PROMO_STANDARDS_BASE = "https://ws.ssactivewear.com";

interface SSActivewearCredentials {
  accountNumber: string;
  apiKey: string;
}

function createSoapEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;
}

function createProductDataRequest(productId: string, accountNumber: string, apiKey: string): string {
  const body = `<ns:GetProductRequest xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${accountNumber}</shar:id>
  <shar:password>${apiKey}</shar:password>
  <shar:localizationCountry>US</shar:localizationCountry>
  <shar:localizationLanguage>en</shar:localizationLanguage>
  <shar:productId>${productId}</shar:productId>
</ns:GetProductRequest>`;
  return createSoapEnvelope(body);
}

function createPricingRequest(partId: string, accountNumber: string, apiKey: string, quantity?: number): string {
  const body = `<ns:GetConfigurationAndPricingRequest xmlns:ns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${accountNumber}</shar:id>
  <shar:password>${apiKey}</shar:password>
  <shar:productId>${partId}</shar:productId>
  <shar:currency>USD</shar:currency>
  <shar:fobId>IL</shar:fobId>
  <shar:priceType>Customer</shar:priceType>
  <shar:localizationCountry>US</shar:localizationCountry>
  <shar:localizationLanguage>en</shar:localizationLanguage>
  <shar:configurationType>Blank</shar:configurationType>
</ns:GetConfigurationAndPricingRequest>`;
  return createSoapEnvelope(body);
}

function createInventoryRequest(partId: string, accountNumber: string, apiKey: string): string {
  const body = `<ns:GetInventoryLevelsRequest xmlns:ns="http://www.promostandards.org/WSDL/Inventory/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">
  <shar:wsVersion>2.0.0</shar:wsVersion>
  <shar:id>${accountNumber}</shar:id>
  <shar:password>${apiKey}</shar:password>
  <shar:productId>${partId}</shar:productId>
</ns:GetInventoryLevelsRequest>`;
  return createSoapEnvelope(body);
}

function createMediaContentRequest(partId: string, accountNumber: string, apiKey: string): string {
  const body = `<ns:GetMediaContentRequest xmlns:ns="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${accountNumber}</shar:id>
  <shar:password>${apiKey}</shar:password>
  <shar:mediaType>Image</shar:mediaType>
  <shar:productId>${partId}</shar:productId>
</ns:GetMediaContentRequest>`;
  return createSoapEnvelope(body);
}

function parseXmlValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function parseXmlArray(xml: string, arrayTag: string, itemTag: string): string[] {
  const arrayRegex = new RegExp(`<${arrayTag}[^>]*>(.*?)</${arrayTag}>`, 'is');
  const arrayMatch = xml.match(arrayRegex);
  if (!arrayMatch) return [];

  const itemRegex = new RegExp(`<${itemTag}[^>]*>(.*?)</${itemTag}>`, 'gis');
  const items: string[] = [];
  let match;
  while ((match = itemRegex.exec(arrayMatch[1])) !== null) {
    items.push(match[1]);
  }
  return items;
}

function parseProductData(xml: string): any {
  const productId = parseXmlValue(xml, 'productId');
  const productName = parseXmlValue(xml, 'productName');
  const description = parseXmlValue(xml, 'description');
  const productBrand = parseXmlValue(xml, 'productBrand');

  const partArray = parseXmlArray(xml, 'PartArray', 'Part');
  const colors: any[] = [];
  const partIds: string[] = [];

  for (const part of partArray) {
    const partId = parseXmlValue(part, 'partId');
    const colorName = parseXmlValue(part, 'colorName');

    const colorArray = parseXmlArray(part, 'ColorArray', 'Color');
    const colorDetails = colorArray.map(color => ({
      colorName: parseXmlValue(color, 'colorName'),
      hex: parseXmlValue(color, 'hex'),
      approximatePmsColor: parseXmlValue(color, 'approximatePmsColor'),
    })).filter(c => c.colorName);

    if (partId) {
      partIds.push(partId);
      colors.push({
        partId,
        colorName,
        colors: colorDetails.length > 0 ? colorDetails : [{ colorName, hex: null }],
      });
    }
  }

  return {
    productId,
    productName,
    description,
    productBrand,
    colors,
    partIds,
  };
}

function parsePricingData(xml: string): any {
  const partId = parseXmlValue(xml, 'partId');
  const currency = parseXmlValue(xml, 'currency') || 'USD';

  const priceArray = parseXmlArray(xml, 'PriceArray', 'Price');
  const prices = priceArray.map(price => ({
    minQuantity: parseInt(parseXmlValue(price, 'minQuantity') || '0'),
    price: parseFloat(parseXmlValue(price, 'price') || '0'),
    discountCode: parseXmlValue(price, 'discountCode'),
    priceEffectiveDate: parseXmlValue(price, 'priceEffectiveDate'),
    priceExpiryDate: parseXmlValue(price, 'priceExpiryDate'),
  }));

  return {
    partId,
    currency,
    prices,
  };
}

function parseInventoryData(xml: string): any {
  const partId = parseXmlValue(xml, 'partId');

  const inventoryArray = parseXmlArray(xml, 'Inventory', 'InventoryLocation');
  const inventory = inventoryArray.map(inv => ({
    quantityAvailable: parseInt(parseXmlValue(inv, 'quantityAvailable') || '0'),
    postalCode: parseXmlValue(inv, 'postalCode'),
  }));

  return {
    partId,
    inventory,
  };
}

function parseMediaData(xml: string): any {
  const partId = parseXmlValue(xml, 'partId');

  const mediaArray = parseXmlArray(xml, 'MediaContentArray', 'MediaContent');
  const media = mediaArray.map(m => ({
    url: parseXmlValue(m, 'url'),
    mediaType: parseXmlValue(m, 'mediaType'),
    classType: parseXmlValue(m, 'classType'),
    description: parseXmlValue(m, 'description'),
    fileSize: parseXmlValue(m, 'fileSize'),
    width: parseXmlValue(m, 'width'),
    height: parseXmlValue(m, 'height'),
  }));

  return {
    partId,
    media,
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Use ANON key to validate the user token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth validation failed:', authError);
      return new Response(
        JSON.stringify({
          code: 401,
          message: authError?.message || "Invalid JWT"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    console.log('Profile lookup:', { hasProfile: !!profile, companyId: profile?.company_id });

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from("integration_settings")
      .select("ssactivewear_enabled, ssactivewear_credentials")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    console.log('Settings lookup:', {
      companyId: profile.company_id,
      hasSettings: !!settings,
      enabled: settings?.ssactivewear_enabled,
      hasCredentials: !!settings?.ssactivewear_credentials,
      credentialsStructure: settings?.ssactivewear_credentials ? Object.keys(settings.ssactivewear_credentials) : null,
      settingsError: settingsError
    });

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
      console.error("Failed to decrypt SSActivewear API key");
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result: decryptedApiKey } = await decryptResponse.json();

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const productId = url.searchParams.get("productId") || url.searchParams.get("style");
    const partId = url.searchParams.get("partId");

    let endpoint = "";
    let soapBody = "";
    let parseFunction: ((xml: string) => any) | null = null;

    let soapAction = "";

    switch (action) {
      case "product":
      case "colors":
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        endpoint = `${PROMO_STANDARDS_BASE}/v2/productdata/`;
        soapBody = createProductDataRequest(productId, credentials.accountNumber, decryptedApiKey);
        soapAction = "http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct";
        parseFunction = parseProductData;
        break;

      case "pricing":
        if (!partId) {
          return new Response(
            JSON.stringify({ error: "Part ID required for pricing" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        endpoint = `${PROMO_STANDARDS_BASE}/v1/pricing/`;
        soapBody = createPricingRequest(partId, credentials.accountNumber, decryptedApiKey);
        soapAction = "http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/GetConfigurationAndPricing";
        parseFunction = parsePricingData;
        break;

      case "inventory":
        if (!partId) {
          return new Response(
            JSON.stringify({ error: "Part ID required for inventory" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        endpoint = `${PROMO_STANDARDS_BASE}/v2/inventory/`;
        soapBody = createInventoryRequest(partId, credentials.accountNumber, decryptedApiKey);
        soapAction = "http://www.promostandards.org/WSDL/Inventory/2.0.0/GetInventoryLevels";
        parseFunction = parseInventoryData;
        break;

      case "media":
        if (!partId) {
          return new Response(
            JSON.stringify({ error: "Part ID required for media" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        endpoint = `${PROMO_STANDARDS_BASE}/v1/media/`;
        soapBody = createMediaContentRequest(partId, credentials.accountNumber, decryptedApiKey);
        soapAction = "http://www.promostandards.org/WSDL/MediaService/1.0.0/GetMediaContent";
        parseFunction = parseMediaData;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: product, pricing, inventory, or media" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // PromoStandards uses HTTP Basic Auth
    const basicAuth = btoa(`${credentials.accountNumber}:${decryptedApiKey}`);

    console.log('Making SSActivewear PromoStandards request:', {
      endpoint,
      accountNumber: credentials.accountNumber,
      apiKeyLength: decryptedApiKey?.length,
      apiKeyPrefix: decryptedApiKey?.substring(0, 10),
      action,
      productId,
      soapBodyLength: soapBody.length
    });

    const ssaResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": `"${soapAction}"`,
      },
      body: soapBody,
    });

    console.log('SSActivewear API response:', {
      status: ssaResponse.status,
      statusText: ssaResponse.statusText,
      headers: Object.fromEntries(ssaResponse.headers.entries())
    });

    if (!ssaResponse.ok) {
      const errorText = await ssaResponse.text();
      console.error("SSActivewear PromoStandards API error:", {
        status: ssaResponse.status,
        error: errorText,
        endpoint,
        accountNumber: credentials.accountNumber,
        hasApiKey: !!decryptedApiKey
      });

      let userMessage = "SSActivewear API request failed";
      if (ssaResponse.status === 403) {
        userMessage = "SSActivewear authentication failed. Please verify your account number and API key are correct, and that your account has PromoStandards API access enabled.";
      } else if (ssaResponse.status === 404) {
        userMessage = `Product ${productId || partId} not found in SSActivewear catalog`;
      }

      return new Response(
        JSON.stringify({
          error: userMessage,
          details: errorText.length > 1000 ? `${errorText.substring(0, 1000)}...` : errorText,
          status: ssaResponse.status,
          hint: ssaResponse.status === 403 ? "Check that your SSActivewear credentials are correct and PromoStandards API is enabled for your account" : undefined
        }),
        { status: ssaResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const xmlResponse = await ssaResponse.text();
    const parsedData = parseFunction ? parseFunction(xmlResponse) : { raw: xmlResponse };

    return new Response(
      JSON.stringify({
        success: true,
        supplier: "ssactivewear",
        action,
        data: parsedData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("SSActivewear PromoStandards API function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
