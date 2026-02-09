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
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if it's a service role key (internal call) or user JWT
    const token = authHeader.replace("Bearer ", "");
    const isServiceRoleKey = token === supabaseServiceRoleKey;

    // Create admin client for all operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    let companyId: string;

    if (isServiceRoleKey) {
      // Internal call from another edge function - get company_id from query params
      const url = new URL(req.url);
      const companyIdParam = url.searchParams.get("companyId");
      if (!companyIdParam) {
        return new Response(
          JSON.stringify({ error: "Company ID required for service calls" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = companyIdParam;
    } else {
      // User JWT - validate and get company_id from profile
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        console.error("Auth error:", authError);
        return new Response(
          JSON.stringify({ error: "Unauthorized", details: authError?.message }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user's company_id
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        return new Response(
          JSON.stringify({ error: "Company not found" }),
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
        // Test connection using LOG105
        const testResult = await testSanMarConnection(credentials);
        responseData = {
          success: testResult,
          supplier: "sanmar",
          action: "test",
          message: testResult
            ? "SanMar PromoStandards connection successful"
            : "SanMar PromoStandards connection failed"
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
