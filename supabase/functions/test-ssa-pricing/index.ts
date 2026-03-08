import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId") || "B22035";
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
      .select("ssactivewear_username, ssactivewear_password_encrypted")
      .eq("id", companyId)
      .single();

    if (settingsError || !settings || !settings.ssactivewear_username || !settings.ssactivewear_password_encrypted) {
      return new Response(
        JSON.stringify({ error: "SSActivewear credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const escapedId = escapeXml(settings.ssactivewear_username);
    const escapedPassword = escapeXml(settings.ssactivewear_password_encrypted);
    const escapedProductId = escapeXml(productId);

    const soapBody = `<ns2:GetConfigurationAndPricingRequest xmlns:ns2="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <shar:wsVersion>1.0.0</shar:wsVersion>
  <shar:id>${escapedId}</shar:id>
  <shar:password>${escapedPassword}</shar:password>
  <shar:productId>${escapedProductId}</shar:productId>
  <shar:currency>USD</shar:currency>
  <shar:fobId>1</shar:fobId>
  <shar:priceType>Customer</shar:priceType>
  <shar:localizationCountry>US</shar:localizationCountry>
  <shar:localizationLanguage>en</shar:localizationLanguage>
  <shar:configurationType>Blank</shar:configurationType>
</ns2:GetConfigurationAndPricingRequest>`;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    ${soapBody}
  </soap:Body>
</soap:Envelope>`;

    console.log(`📤 Testing pricing API with productId: "${productId}"`);

    const response = await fetch("https://ws.ssactivewear.com/v2/promostandards/PricingAndConfiguration", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "getConfigurationAndPricing",
      },
      body: soapEnvelope,
    });

    const xmlText = await response.text();

    console.log(`📥 Response status: ${response.status}`);
    console.log(`📥 Response length: ${xmlText.length} bytes`);
    console.log(`📥 Response sample:`, xmlText.substring(0, 1000));

    return new Response(
      JSON.stringify({
        success: response.ok,
        productId,
        httpStatus: response.status,
        responseLength: xmlText.length,
        xmlResponse: xmlText,
        analysis: {
          hasSoapFault: xmlText.toLowerCase().includes("<soap:fault"),
          hasError: xmlText.toLowerCase().includes("<errorcode"),
          hasConfiguration: xmlText.toLowerCase().includes("<configuration"),
          hasPart: xmlText.toLowerCase().includes("<part>"),
          hasPartPrice: xmlText.toLowerCase().includes("<partprice"),
        }
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
