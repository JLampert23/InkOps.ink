import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SANMAR_API_BASE = "https://api.sanmar.com";

interface SanMarCredentials {
  apiKey: string;
  customerId: string;
  username?: string;
  password?: string;
}

interface ProductSearchParams {
  style: string;
  companyId: string;
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user and get company_id
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's company_id
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

    // Get SanMar credentials
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("sanmar_enabled, sanmar_credentials")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!settings?.sanmar_enabled) {
      return new Response(
        JSON.stringify({ error: "SanMar integration not enabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = settings.sanmar_credentials as SanMarCredentials;
    if (!credentials?.apiKey) {
      return new Response(
        JSON.stringify({ error: "SanMar credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const style = url.searchParams.get("style");

    if (!style) {
      return new Response(
        JSON.stringify({ error: "Style number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call SanMar API based on action
    let sanmarUrl = "";
    let method = "GET";

    switch (action) {
      case "search":
        // Search for products by style
        sanmarUrl = `${SANMAR_API_BASE}/products/search?style=${encodeURIComponent(style)}`;
        break;
      case "colors":
        // Get all colors for a style
        sanmarUrl = `${SANMAR_API_BASE}/products/${encodeURIComponent(style)}/colors`;
        break;
      case "pricing":
        const color = url.searchParams.get("color");
        if (!color) {
          return new Response(
            JSON.stringify({ error: "Color required for pricing" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        sanmarUrl = `${SANMAR_API_BASE}/products/${encodeURIComponent(style)}/pricing?color=${encodeURIComponent(color)}`;
        break;
      case "inventory":
        const colorCode = url.searchParams.get("color");
        if (!colorCode) {
          return new Response(
            JSON.stringify({ error: "Color required for inventory" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        sanmarUrl = `${SANMAR_API_BASE}/products/${encodeURIComponent(style)}/inventory?color=${encodeURIComponent(colorCode)}`;
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Make request to SanMar API
    const sanmarHeaders: Record<string, string> = {
      "Authorization": `Bearer ${credentials.apiKey}`,
      "Content-Type": "application/json",
    };

    if (credentials.customerId) {
      sanmarHeaders["X-Customer-Id"] = credentials.customerId;
    }

    const sanmarResponse = await fetch(sanmarUrl, {
      method,
      headers: sanmarHeaders,
    });

    if (!sanmarResponse.ok) {
      const errorText = await sanmarResponse.text();
      console.error("SanMar API error:", errorText);
      return new Response(
        JSON.stringify({
          error: "SanMar API request failed",
          details: errorText,
          status: sanmarResponse.status
        }),
        { status: sanmarResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await sanmarResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        supplier: "sanmar",
        data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("SanMar API function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
