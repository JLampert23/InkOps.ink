import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") || "5f36fe64-8b67-4b62-a023-29590da87c41";

    const diagnostics: any = {
      step1_fetch_credentials: null,
      step2_decrypt_password: null,
      step3_build_soap_request: null,
      step4_api_call: null,
      step5_response: null,
    };

    // Step 1: Fetch credentials
    try {
      const { data: settings, error } = await supabaseAdmin
        .from("company_settings")
        .select("sanmar_promo_username, sanmar_promo_password_encrypted")
        .eq("id", companyId)
        .maybeSingle();

      diagnostics.step1_fetch_credentials = {
        success: !!settings,
        has_username: !!settings?.sanmar_promo_username,
        username: settings?.sanmar_promo_username || null,
        has_encrypted_password: !!settings?.sanmar_promo_password_encrypted,
        error: error?.message || null,
      };

      if (!settings?.sanmar_promo_username || !settings?.sanmar_promo_password_encrypted) {
        throw new Error("Missing SanMar credentials in database");
      }

      // Step 2: Decrypt password
      try {
        const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceRoleKey}`,
          },
          body: JSON.stringify({
            action: "decrypt",
            token: settings.sanmar_promo_password_encrypted,
          }),
        });

        const decryptBody = await decryptResponse.json();
        diagnostics.step2_decrypt_password = {
          status: decryptResponse.status,
          ok: decryptResponse.ok,
          has_result: !!decryptBody.result,
          password_length: decryptBody.result?.length || 0,
        };

        if (!decryptResponse.ok) {
          throw new Error(`Decryption failed: ${decryptBody.error || 'Unknown error'}`);
        }

        const decryptedPassword = decryptBody.result;

        // Step 3: Build SOAP request
        const username = settings.sanmar_promo_username;
        const escapeXml = (str: string) => str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/"
  xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:GetProductRequest>
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${escapeXml(username)}</shar:id>
      <shar:password>${escapeXml(decryptedPassword)}</shar:password>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:productId>PC54</shar:productId>
    </ns:GetProductRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

        diagnostics.step3_build_soap_request = {
          success: true,
          username: username,
          password_provided: !!decryptedPassword,
          soap_length: soapEnvelope.length,
        };

        // Step 4: Make API call
        const wsdlUrl = "https://ws.sanmar.com:8080/promostandards/ProductDataServiceBindingV2?WSDL";

        try {
          const apiResponse = await fetch(wsdlUrl, {
            method: "POST",
            headers: {
              "Content-Type": "text/xml; charset=utf-8",
              "SOAPAction": "getProduct",
            },
            body: soapEnvelope,
          });

          const responseText = await apiResponse.text();

          diagnostics.step4_api_call = {
            status: apiResponse.status,
            ok: apiResponse.ok,
            response_length: responseText.length,
            response_preview: responseText.substring(0, 1000),
          };

          // Step 5: Parse response
          const hasError = responseText.includes('<errorCode>') || responseText.includes('<faultcode>');
          const errorCodeMatch = responseText.match(/<errorCode>(\d+)<\/errorCode>/i);
          const errorMessageMatch = responseText.match(/<errorMessage>([^<]+)<\/errorMessage>/i);
          const hasFault = responseText.includes('<faultstring>');
          const faultMatch = responseText.match(/<faultstring>([^<]+)<\/faultstring>/i);

          diagnostics.step5_response = {
            has_error: hasError,
            error_code: errorCodeMatch ? parseInt(errorCodeMatch[1]) : null,
            error_message: errorMessageMatch ? errorMessageMatch[1] : null,
            has_soap_fault: hasFault,
            fault_string: faultMatch ? faultMatch[1] : null,
            has_product_data: responseText.includes('GetProductResponse') || responseText.includes('productName'),
          };

        } catch (apiError: any) {
          diagnostics.step4_api_call = {
            error: apiError.message,
            stack: apiError.stack,
          };
        }

      } catch (decryptError: any) {
        diagnostics.step2_decrypt_password = {
          error: decryptError.message,
          stack: decryptError.stack,
        };
      }

    } catch (credError: any) {
      diagnostics.step1_fetch_credentials = {
        error: credError.message,
        stack: credError.stack,
      };
    }

    // Step 7: Direct pricing SOAP call to see raw response
    try {
      const supabaseUrl7 = Deno.env.get("SUPABASE_URL")!;
      const serviceKey7 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase7 = createClient(supabaseUrl7, serviceKey7);

      const { data: creds7 } = await supabase7
        .from("company_settings")
        .select("sanmar_promo_username, sanmar_promo_password_encrypted")
        .eq("id", companyId)
        .maybeSingle();

      if (creds7?.sanmar_promo_password_encrypted) {
        const decResp7 = await fetch(`${supabaseUrl7}/functions/v1/crypto-service`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey7}` },
          body: JSON.stringify({ action: "decrypt", token: creds7.sanmar_promo_password_encrypted }),
        });
        const decBody7 = await decResp7.json();
        const pw7 = decBody7.result;
        const un7 = creds7.sanmar_promo_username;

        const escXml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

        const pricingSoap = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/"
  xmlns:shar="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/SharedObjects/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:GetConfigurationAndPricingRequest>
      <shar:wsVersion>1.0.0</shar:wsVersion>
      <shar:id>${escXml(un7)}</shar:id>
      <shar:password>${escXml(pw7)}</shar:password>
      <shar:productId>PC54</shar:productId>
      <shar:currency>USD</shar:currency>
      <shar:fobId>1</shar:fobId>
      <shar:priceType>Net</shar:priceType>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:configurationType>Blank</shar:configurationType>
    </ns:GetConfigurationAndPricingRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

        const pricingUrl = "https://ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBinding";
        const pricingResp = await fetch(pricingUrl, {
          method: "POST",
          headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "getConfigurationAndPricing" },
          body: pricingSoap,
        });
        const pricingText = await pricingResp.text();

        const partPriceCount = (pricingText.match(/<(?:[^:>]*:)?PartPrice/gi) || []).length;
        const partCount = (pricingText.match(/<(?:[^:>]*:)?Part>/gi) || []).length;
        const priceValues = pricingText.match(/<(?:[^:>]*:)?price>([^<]+)<\/(?:[^:>]*:)?price>/gi) || [];

        diagnostics.step7_pricing_direct = {
          status: pricingResp.status,
          ok: pricingResp.ok,
          response_length: pricingText.length,
          response_preview: pricingText.substring(0, 3000),
          partCount,
          partPriceCount,
          samplePrices: priceValues.slice(0, 10).map((p: string) => p.replace(/<[^>]+>/g, '')),
          hasError: pricingText.includes('<errorCode>') || pricingText.includes('<faultcode>'),
        };
      }
    } catch (step7Error: any) {
      diagnostics.step7_pricing_direct = { error: step7Error.message };
    }

    // Step 6: Call through sanmar-api (same way product-search does)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sanmarApiUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=product&style=PC54&companyId=${companyId}`;
      
      const apiCallStart = Date.now();
      const sanmarApiResponse = await fetch(sanmarApiUrl, {
        headers: { "Authorization": `Bearer ${supabaseServiceRoleKey}` },
      });
      const apiCallDuration = Date.now() - apiCallStart;
      const sanmarApiBody = await sanmarApiResponse.text();
      
      diagnostics.step6_via_sanmar_api = {
        url: sanmarApiUrl,
        status: sanmarApiResponse.status,
        ok: sanmarApiResponse.ok,
        duration_ms: apiCallDuration,
        response_length: sanmarApiBody.length,
        response_preview: sanmarApiBody.substring(0, 2000),
      };
    } catch (step6Error: any) {
      diagnostics.step6_via_sanmar_api = {
        error: step6Error.message,
        stack: step6Error.stack,
      };
    }

    // Step 8: Call sanmar-api PRICING route (same way product-search does)
    try {
      const supabaseUrl8 = Deno.env.get("SUPABASE_URL")!;
      const serviceKey8 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const pricingApiUrl = `${supabaseUrl8}/functions/v1/sanmar-api?action=pricing&style=PC54&companyId=${companyId}`;
      
      const pricingStart = Date.now();
      const pricingApiResp = await fetch(pricingApiUrl, {
        headers: { "Authorization": `Bearer ${serviceKey8}` },
      });
      const pricingDuration = Date.now() - pricingStart;
      const pricingApiBody = await pricingApiResp.text();
      
      let parsedPricing = null;
      try { parsedPricing = JSON.parse(pricingApiBody); } catch {}
      
      diagnostics.step8_pricing_via_sanmar_api = {
        url: pricingApiUrl,
        status: pricingApiResp.status,
        ok: pricingApiResp.ok,
        duration_ms: pricingDuration,
        response_length: pricingApiBody.length,
        partsCount: parsedPricing?.data?.parts?.length || 0,
        samplePart: parsedPricing?.data?.parts?.[0] || null,
        warning: parsedPricing?.warning || null,
        error: parsedPricing?.error || null,
        response_preview: pricingApiBody.substring(0, 1000),
      };
    } catch (step8Error: any) {
      diagnostics.step8_pricing_via_sanmar_api = { error: step8Error.message };
    }

    return new Response(
      JSON.stringify(diagnostics, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Test function error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
