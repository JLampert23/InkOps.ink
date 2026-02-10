import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function buildSOAPEnvelope(credentials: any, styleNumber: string): string {
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const style = url.searchParams.get("style") || "PC61";
    const companyId = url.searchParams.get("company_id");

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
    const soapEnvelope = buildSOAPEnvelope(credentials, normalizedStyle);
    const endpoint = "https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2?WSDL";

    console.log("Testing SanMar API with style:", normalizedStyle);
    console.log("Using username:", credentials.id);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "getProduct",
      },
      body: soapEnvelope,
    });

    const responseXml = await response.text();

    // Parse for parts
    const partPattern = /<[^:]*:?Part[^>]*>([\s\S]*?)<\/[^:]*:?Part>/gi;
    const parts = [];
    let match;
    while ((match = partPattern.exec(responseXml)) !== null) {
      parts.push(match[0].substring(0, 500)); // First 500 chars of each part
    }

    return new Response(
      JSON.stringify({
        style: normalizedStyle,
        endpoint,
        username: credentials.id,
        response: {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        },
        xmlLength: responseXml.length,
        xmlPreview: responseXml.substring(0, 2000),
        xmlTail: responseXml.substring(responseXml.length - 500),
        hasFault: responseXml.includes("<faultcode>"),
        hasError: responseXml.includes("<errorCode>"),
        partMatches: parts.length,
        partSamples: parts.slice(0, 3),
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
