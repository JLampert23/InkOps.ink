import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SSA_REST_API_BASE = "https://api.ssactivewear.com/v2";

interface SSActivewearCredentials {
  accountNumber: string;
  apiKey: string;
}

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

    const token = authHeader.replace("Bearer ", "");

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Invalid JWT" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: profile } = await supabase
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

    const { data: settings } = await supabase
      .from("integration_settings")
      .select("ssactivewear_enabled, ssactivewear_credentials")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!settings?.ssactivewear_enabled || !settings?.ssactivewear_credentials) {
      return new Response(
        JSON.stringify({ error: "SSActivewear credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = {
      accountNumber: settings.ssactivewear_credentials.accountNumber,
      apiKey: settings.ssactivewear_credentials.apiKey
    } as SSActivewearCredentials;

    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        action: "decrypt",
        token: credentials.apiKey,
      }),
    });

    if (!decryptResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result: decryptedApiKey } = await decryptResponse.json();

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const productId = url.searchParams.get("productId") || url.searchParams.get("style");
    const sku = url.searchParams.get("sku");

    const basicAuth = btoa(`${credentials.accountNumber}:${decryptedApiKey}`);

    const ssaHeaders = {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    let endpoint = "";

    switch (action) {
      case "product":
      case "colors":
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID (style number) required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        endpoint = `${SSA_REST_API_BASE}/products/?style=${encodeURIComponent(productId)}`;
        break;

      case "styles":
        endpoint = `${SSA_REST_API_BASE}/styles/`;
        if (productId) {
          endpoint = `${SSA_REST_API_BASE}/styles/${encodeURIComponent(productId)}`;
        }
        break;

      case "inventory":
        if (sku) {
          endpoint = `${SSA_REST_API_BASE}/inventory/?sku=${encodeURIComponent(sku)}`;
        } else if (productId) {
          endpoint = `${SSA_REST_API_BASE}/inventory/?style=${encodeURIComponent(productId)}`;
        } else {
          return new Response(
            JSON.stringify({ error: "SKU or style number required for inventory" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;

      case "categories":
        endpoint = `${SSA_REST_API_BASE}/categories/`;
        break;

      case "brands":
        endpoint = `${SSA_REST_API_BASE}/brands/`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: product, styles, inventory, categories, or brands" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log('Making SSActivewear REST API request:', {
      endpoint,
      accountNumber: credentials.accountNumber,
      action,
      productId,
    });

    const ssaResponse = await fetch(endpoint, {
      method: "GET",
      headers: ssaHeaders,
    });

    console.log('SSActivewear API response:', {
      status: ssaResponse.status,
      statusText: ssaResponse.statusText,
    });

    if (!ssaResponse.ok) {
      const errorText = await ssaResponse.text();
      console.error("SSActivewear REST API error:", {
        status: ssaResponse.status,
        error: errorText,
        endpoint,
      });

      let userMessage = "SSActivewear API request failed";
      if (ssaResponse.status === 401 || ssaResponse.status === 403) {
        userMessage = "SSActivewear authentication failed. Please verify your account number and API key are correct.";
      } else if (ssaResponse.status === 404) {
        userMessage = `Product ${productId || sku} not found in SSActivewear catalog`;
      }

      return new Response(
        JSON.stringify({
          error: userMessage,
          status: ssaResponse.status,
        }),
        { status: ssaResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await ssaResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        supplier: "ssactivewear",
        action,
        data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("SSActivewear API function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
