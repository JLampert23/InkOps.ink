import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Inline decryption to avoid nested edge function calls
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function decryptToken(encryptedToken: string, encryptionKey: string): Promise<string> {
  const combined = new Uint8Array(
    atob(encryptedToken).split('').map(c => c.charCodeAt(0))
  );

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedData = combined.slice(28);

  const key = await deriveKey(encryptionKey, salt);

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}

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

    // Use inline decryption to avoid nested edge function calls
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ error: "ENCRYPTION_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let password: string;
    try {
      password = await decryptToken(settings.sanmar_promo_password_encrypted, encryptionKey);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
