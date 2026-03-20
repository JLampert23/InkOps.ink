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
