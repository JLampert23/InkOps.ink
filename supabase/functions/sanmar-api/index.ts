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

    // Get JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ code: 401, message: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's JWT for auth context
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get authenticated user from JWT (automatically validated by Supabase)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("❌ JWT validation failed:", authError?.message);
      return new Response(
        JSON.stringify({
          code: 401,
          message: "Invalid JWT",
          details: authError?.message
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ User authenticated:", user.id);

    // Get user's company_id using service role for direct database access
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.company_id) {
      console.error("❌ Company not found for user:", user.id);
      return new Response(
        JSON.stringify({ code: 404, message: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = profile.company_id;
    console.log("✅ Company ID:", companyId);

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

    // Parse request parameters
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "unified";
    const style = url.searchParams.get("style");
    const partId = url.searchParams.get("partId") || undefined;

    console.log(`📋 Request params: action=${action}, style=${style}, partId=${partId}`);

    let responseData: any;

    // Handle different action types
    switch (action) {
      case "test":
      case "brands":
        // Test connection using LOG105 (SanMar style number)
        const testResult = await testSanMarConnection(credentials);
        responseData = {
          success: testResult,
          supplier: "sanmar",
          action,
          authenticated: testResult,
          message: testResult
            ? "SanMar PromoStandards connection successful! Test product (LOG105) found."
            : "SanMar PromoStandards connection failed - check credentials"
        };
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
          error: error.message,
          code: error.code,
          supplier: "sanmar"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
