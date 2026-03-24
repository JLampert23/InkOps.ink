import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  fetchUnifiedSanMarData,
  fetchSanMarProductData,
  fetchSanMarInventory,
  fetchSanMarPricing,
  fetchSanMarMedia,
  testSanMarConnection,
  type SanMarCredentials,
  type SanMarUnifiedResponse,
} from "../_shared/sanmar-promostandards-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-User-Token",
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

    const userToken = req.headers.get("X-User-Token") || "";
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.replace('Bearer ', '').trim() || "";
    const isServiceRoleKey = bearerToken === supabaseServiceRoleKey.trim();
    const token = isServiceRoleKey ? bearerToken : (userToken || bearerToken);

    console.log('🔐 Auth Debug:', {
      hasAuthHeader: !!authHeader,
      bearerTokenLength: bearerToken.length,
      serviceKeyLength: supabaseServiceRoleKey.length,
      isServiceRoleKey,
      bearerPrefix: bearerToken.substring(0, 20),
      servicePrefix: supabaseServiceRoleKey.substring(0, 20),
      match: bearerToken === supabaseServiceRoleKey.trim()
    });

    if (!token) {
      return new Response(
        JSON.stringify({ code: 401, message: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);

    let companyId: string;

    if (isServiceRoleKey) {
      const qsCompanyId = url.searchParams.get("companyId");
      if (!qsCompanyId) {
        return new Response(
          JSON.stringify({ code: 400, message: "companyId query param required for service-role calls" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = qsCompanyId;
    } else {
      const jwtParts = token.split('.');
      if (jwtParts.length !== 3) {
        return new Response(
          JSON.stringify({ code: 401, message: "Invalid JWT format" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let userId: string;
      try {
        const payload = JSON.parse(atob(jwtParts[1]));
        userId = payload.sub;
        if (!userId) throw new Error("No sub claim in JWT");
        console.log('✅ JWT decoded, user ID:', userId);
      } catch (e) {
        console.error('Failed to decode JWT:', e);
        return new Response(
          JSON.stringify({ code: 401, message: "Failed to decode JWT" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("company_id")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.company_id) {
        return new Response(
          JSON.stringify({ code: 404, message: "Company not found for user" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = profile.company_id;
    }

    // Get SanMar PromoStandards credentials from company_settings
    const { data: settings } = await supabaseAdmin
      .from("company_settings")
      .select("sanmar_promo_username, sanmar_promo_password_encrypted, ssactivewear_fob_id")
      .eq("id", companyId)
      .maybeSingle();

    if (!settings?.sanmar_promo_username || !settings?.sanmar_promo_password_encrypted) {
      return new Response(
        JSON.stringify({
          error: "SanMar PromoStandards credentials not configured",
          message: "Please configure your SanMar username and password in Account Settings > Integrations > SanMar"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt the password
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

    if (!decryptResponse.ok) {
      console.error("Failed to decrypt SanMar password");
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decryptJson = await decryptResponse.json();
    const decryptedPassword = decryptJson.result;

    if (!decryptedPassword || typeof decryptedPassword !== 'string' || decryptedPassword.trim().length === 0) {
      console.error('❌ Decryption returned empty or invalid password', {
        hasResult: 'result' in decryptJson,
        resultType: typeof decryptedPassword,
        resultLength: decryptedPassword?.length ?? 0,
      });
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials — password is empty after decryption" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials: SanMarCredentials = {
      id: settings.sanmar_promo_username.trim(),
      password: decryptedPassword.trim(),
      fobId: settings.ssactivewear_fob_id || undefined
    };

    console.log(`🔑 SanMar credentials loaded for company ${companyId}`);
    console.log(`👤 Username: ${credentials.id} (length: ${credentials.id.length})`);
    console.log(`🔒 Password length: ${credentials.password.length}`);

    const action = url.searchParams.get("action") || "unified";
    const style = url.searchParams.get("style");
    const partId = url.searchParams.get("partId") || undefined;

    console.log(`📋 Request params: action=${action}, style=${style}, partId=${partId}`);

    let responseData: any;

    // Handle different action types
    switch (action) {
      case "test":
      case "brands":
        // Test connection using PC54 (SanMar style number)
        console.log('🧪 Starting SanMar connection test...');
        try {
          const testResult = await Promise.race([
            testSanMarConnection(credentials),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Connection test timed out after 25 seconds')), 25000)
            )
          ]) as boolean;

          responseData = {
            success: testResult,
            supplier: "sanmar",
            action,
            authenticated: testResult,
            message: testResult
              ? "SanMar PromoStandards connection successful! Test product (PC54) found."
              : "SanMar PromoStandards connection failed - check credentials"
          };
          console.log('✅ SanMar connection test completed:', testResult);
        } catch (error: any) {
          console.error('❌ SanMar connection test error:', error.message);
          responseData = {
            success: false,
            supplier: "sanmar",
            action,
            authenticated: false,
            error: error.message || 'Connection test failed',
            message: `SanMar connection test failed: ${error.message}`
          };
        }
        break;

      case "unified":
        // Fetch all data in parallel (recommended)
        if (!style) {
          return new Response(
            JSON.stringify({ error: "Style number required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        responseData = await fetchUnifiedSanMarData(credentials, {
          styleNumber: style,
          partId
        });
        break;

      case "product":
        // Fetch only product data
        if (!style) {
          return new Response(
            JSON.stringify({ error: "Style number required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        try {
          const productData = await fetchSanMarProductData(credentials, style);
          responseData = {
            success: true,
            supplier: "sanmar",
            action: "product",
            data: productData
          };
        } catch (productError: any) {
          console.error(`Product fetch failed for ${style}:`, productError.message);
          const isAuthError = productError.name === 'PromoStandardsError' &&
            [100, 104, 105, 110].includes(productError.code);
          const statusCode = isAuthError ? 401 : 200;
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "sanmar",
              action: "product",
              error: productError.message || "Product not found",
              code: productError.code || undefined,
              style: style
            }),
            { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;

      case "inventory":
        // Fetch inventory for a specific part
        if (!partId) {
          return new Response(
            JSON.stringify({ error: "Part ID required for inventory lookup" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const inventoryData = await fetchSanMarInventory(credentials, partId);
        responseData = {
          success: true,
          supplier: "sanmar",
          action: "inventory",
          data: inventoryData
        };
        break;

      case "pricing":
        // Fetch pricing for a style (pricing API uses style numbers, not partIds)
        if (!style) {
          return new Response(
            JSON.stringify({ error: "Style number required for pricing lookup" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        try {
          const pricingData = await fetchSanMarPricing(credentials, style);
          responseData = {
            success: true,
            supplier: "sanmar",
            action: "pricing",
            data: pricingData
          };
          console.log(`✅ Pricing fetch successful for ${style}: ${pricingData.parts.length} parts`);
        } catch (pricingError: any) {
          console.warn(`⚠️ Pricing unavailable for ${style}:`, pricingError.message);
          // Return empty pricing data instead of failing
          responseData = {
            success: true,
            supplier: "sanmar",
            action: "pricing",
            data: { parts: [] },
            warning: `Pricing unavailable: ${pricingError.message}`
          };
        }
        break;

      case "media":
        // Fetch media/images
        if (!style) {
          return new Response(
            JSON.stringify({ error: "Style number required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const mediaData = await fetchSanMarMedia(credentials, style, partId);
        console.log(`[SanMar Media Action] Style: ${style}, images returned: ${mediaData.images?.length || 0}`);
        if (mediaData.images?.length === 0) {
          console.warn(`[SanMar Media Action] WARNING: Zero images returned from PromoStandards Media API for ${style}. The Media Content Service may not be included in this SanMar account.`);
        } else {
          const colorSample = [...new Set(mediaData.images.map((i: any) => i.color).filter(Boolean))].slice(0, 5);
          console.log(`[SanMar Media Action] Colors in images: ${colorSample.join(', ')}`);
        }
        responseData = {
          success: true,
          supplier: "sanmar",
          action: "media",
          data: mediaData
        };
        break;

      case "search":
        // Legacy compatibility - treat as unified product search
        if (!style) {
          return new Response(
            JSON.stringify({ error: "Style number required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const searchData = await fetchUnifiedSanMarData(credentials, {
          styleNumber: style,
          partId
        });
        responseData = {
          success: true,
          supplier: "sanmar",
          action: "search",
          data: searchData
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("SanMar API function error:", error);

    // Check if it's a PromoStandards authentication error
    if (error.name === 'PromoStandardsError') {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          code: error.code,
          supplier: "sanmar",
          message: `SanMar PromoStandards authentication failed: ${error.message}`
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return clear error messages
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
        supplier: "sanmar",
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
