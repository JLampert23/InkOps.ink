import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getXmlValue(xmlText: string, tagName: string): string | null {
  const regex = new RegExp(`<[^:]*:?${tagName}[^>]*>([^<]*)<\/[^:]*:?${tagName}>`, 'i');
  const match = xmlText.match(regex);
  return match ? match[1].trim() : null;
}

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

    // Optimize: Decrypt with timeout
    const decryptController = new AbortController();
    const decryptTimeout = setTimeout(() => decryptController.abort(), 5000);

    let decryptResponse;
    try {
      decryptResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/crypto-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          action: "decrypt",
          token: settings.sanmar_promo_password_encrypted,
        }),
        signal: decryptController.signal,
      });
    } catch (error: any) {
      clearTimeout(decryptTimeout);
      if (error.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: "Decrypt timeout" }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }
    clearTimeout(decryptTimeout);

    if (!decryptResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result: password } = await decryptResponse.json();
    const credentials = { id: settings.sanmar_promo_username, password };

    const normalizedStyle = style.toUpperCase().trim();
    const endpoint = "https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2?WSDL";
    const soapAction = "getProduct";
    const soapEnvelope = buildProductDataEnvelope(credentials, normalizedStyle);

    console.log("Testing SanMar Product Data API");
    console.log("Style:", normalizedStyle);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": soapAction,
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          success: false,
          style: normalizedStyle,
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: errorText.substring(0, 500),
        }, null, 2),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseXml = await response.text();

    // Check for errors
    const hasFault = responseXml.includes("<faultcode>");
    const hasError = responseXml.includes("<errorCode>");

    if (hasFault || hasError) {
      return new Response(
        JSON.stringify({
          success: false,
          style: normalizedStyle,
          error: "SOAP Fault or Error in response",
          preview: responseXml.substring(0, 1000),
        }, null, 2),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract product info
    const productName = getXmlValue(responseXml, "productName");
    const description = getXmlValue(responseXml, "description");
    const productBrand = getXmlValue(responseXml, "productBrand");

    // Parse first 5 parts as examples
    const partPattern = /<[^:]*:?Part[^>]*>([\s\S]*?)<\/[^:]*:?Part>/gi;
    const sampleParts = [];
    let match;

    for (let i = 0; i < 5 && (match = partPattern.exec(responseXml)); i++) {
      const partXml = match[0];
      sampleParts.push({
        partId: getXmlValue(partXml, "partId"),
        colorName: getXmlValue(partXml, "colorName"),
        size: getXmlValue(partXml, "labelSize"),
        hex: getXmlValue(partXml, "hex"),
      });
    }

    // Count all parts (efficient)
    partPattern.lastIndex = 0;
    let totalParts = 0;
    while (partPattern.exec(responseXml) !== null) totalParts++;

    return new Response(
      JSON.stringify({
        success: true,
        style: normalizedStyle,
        product: {
          name: productName,
          description: description?.substring(0, 200),
          brand: productBrand,
        },
        variants: {
          totalParts,
          sampleParts,
        },
        info: {
          endpoint: "Product Data Service V2.0.0",
          note: "SanMar ONLY implements Product Data service. There is no ProductSellableService.",
          dataReturned: "Product Data returns all colors, sizes, and part IDs",
        },
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
