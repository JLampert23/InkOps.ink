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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ code: 401, message: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const url = new URL(req.url);

    let companyId: string;

    if (token === supabaseServiceRoleKey) {
      const qsCompanyId = url.searchParams.get("companyId");
      if (!qsCompanyId) {
        return new Response(
          JSON.stringify({ code: 400, message: "companyId query param required for service-role calls" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = qsCompanyId;
    } else {
      // Create client with the user's auth header for proper JWT validation
      const userAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: authHeader }
        },
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { data: { user }, error: authError } = await userAuthClient.auth.getUser();

      if (authError || !user) {
        console.error('JWT validation failed:', authError?.message, 'Token prefix:', token.substring(0, 30));
        return new Response(
          JSON.stringify({ code: 401, message: `Invalid JWT: ${authError?.message || 'No user found'}` }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log('✅ User authenticated:', user.id);

      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("company_id")
        .eq("id", user.id)
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
      .select("sanmar_promo_username, sanmar_promo_password_encrypted")
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

    const { result: decryptedPassword } = await decryptResponse.json();

    const credentials: SanMarCredentials = {
      id: settings.sanmar_promo_username,
      password: decryptedPassword
    };

    console.log(`🔑 SanMar credentials loaded for company ${companyId}`);
    console.log(`👤 Username: ${credentials.id}`);

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
        const productData = await fetchSanMarProductData(credentials, style);
        responseData = {
          success: true,
          supplier: "sanmar",
          action: "product",
          data: productData
        };
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
        // Fetch pricing for a specific part
        if (!partId) {
          return new Response(
            JSON.stringify({ error: "Part ID required for pricing lookup" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const pricingData = await fetchSanMarPricing(credentials, partId);
        responseData = {
          success: true,
          supplier: "sanmar",
          action: "pricing",
          data: pricingData
        };
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
