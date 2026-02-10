import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function buildProductDataEnvelope(credentials: any, styleNumber: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/"
  xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:GetProductRequest>
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${credentials.id}</shar:id>
      <shar:password>${credentials.password}</shar:password>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:productId>${styleNumber}</shar:productId>
    </ns:GetProductRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function buildProductSellableEnvelope(credentials: any, styleNumber: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns="http://www.promostandards.org/WSDL/ProductSellableService/2.0.0/"
  xmlns:shar="http://www.promostandards.org/WSDL/ProductSellableService/2.0.0/SharedObjects/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:GetProductSellableRequest>
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${credentials.id}</shar:id>
      <shar:password>${credentials.password}</shar:password>
      <shar:productId>${styleNumber}</shar:productId>
    </ns:GetProductSellableRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const style = url.searchParams.get("style") || "PC61";
    const companyId = url.searchParams.get("company_id");
    const service = url.searchParams.get("service") || "product-data";

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "company_id parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get credentials
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("sanmar_promo_username, sanmar_promo_password_encrypted")
      .eq("id", companyId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Failed to get credentials", details: settingsError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt password
    const decryptResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        action: "decrypt",
        token: settings.sanmar_promo_password_encrypted,
      }),
    });

    if (!decryptResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result: password } = await decryptResponse.json();
    const credentials = {
      id: settings.sanmar_promo_username,
      password,
    };

    // Test the actual SOAP call
    const normalizedStyle = style.toUpperCase().trim();

    let soapEnvelope: string;
    let endpoint: string;
    let soapAction: string;

    if (service === "sellable") {
      soapEnvelope = buildProductSellableEnvelope(credentials, normalizedStyle);
      endpoint = "https://ws.sanmar.com:8080/promostandards/ProductSellableServiceBinding?WSDL";
      soapAction = "getProductSellable";
    } else {
      soapEnvelope = buildProductDataEnvelope(credentials, normalizedStyle);
      endpoint = "https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2?WSDL";
      soapAction = "getProduct";
    }

    console.log("Testing SanMar API with style:", normalizedStyle);
    console.log("Using service:", service);
    console.log("Using username:", credentials.id);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": soapAction,
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          service,
          style: normalizedStyle,
          endpoint,
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseBody: await response.text(),
        }, null, 2),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseXml = await response.text();
    const xmlLength = responseXml.length;

    // Parse for parts (memory efficient)
    const partPattern = /<[^:]*:?Part[^>]*>([\s\S]*?)<\/[^:]*:?Part>/gi;
    const parts = [];
    let match;
    let matchCount = 0;

    while ((match = partPattern.exec(responseXml)) !== null && matchCount < 3) {
      parts.push(match[0].substring(0, 500));
      matchCount++;
    }

    const totalMatches = (responseXml.match(partPattern) || []).length;

    const result = {
      service,
      style: normalizedStyle,
      endpoint,
      username: credentials.id,
      response: {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      },
      xmlLength,
      xmlPreview: responseXml.substring(0, 1500),
      xmlTail: responseXml.substring(Math.max(0, xmlLength - 500)),
      hasFault: responseXml.includes("<faultcode>"),
      hasError: responseXml.includes("<errorCode>"),
      partMatches: totalMatches,
      sampleParts: parts,
    };

    return new Response(
      JSON.stringify(result, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
