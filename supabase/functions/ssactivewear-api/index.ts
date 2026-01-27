import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SSACTIVEWEAR_API_BASE = "https://api.ssactivewear.com/v2";

interface SSActivewearCredentials {
  apiKey: string;
  customerId: string;
  username?: string;
  password?: string;
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

    // Get SSActivewear credentials
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("ssactivewear_enabled, ssactivewear_credentials")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (!settings?.ssactivewear_enabled) {
      return new Response(
        JSON.stringify({ error: "SSActivewear integration not enabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = settings.ssactivewear_credentials as SSActivewearCredentials;
    if (!credentials?.username || !credentials?.password) {
      return new Response(
        JSON.stringify({ error: "SSActivewear credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt the password
    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        action: "decrypt",
        token: credentials.password,
      }),
    });

    if (!decryptResponse.ok) {
      console.error("Failed to decrypt SSActivewear password");
      return new Response(
        JSON.stringify({ error: "Failed to decrypt credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { result: decryptedPassword } = await decryptResponse.json();

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

    // Call SSActivewear API based on action
    let ssaUrl = "";
    let method = "GET";

    switch (action) {
      case "search":
        // Search for products by style
        ssaUrl = `${SSACTIVEWEAR_API_BASE}/products?style=${encodeURIComponent(style)}`;
        break;
      case "colors":
        // Get all colors for a style
        ssaUrl = `${SSACTIVEWEAR_API_BASE}/styles/${encodeURIComponent(style)}`;
        break;
      case "pricing":
        const color = url.searchParams.get("color");
        if (!color) {
          return new Response(
            JSON.stringify({ error: "Color required for pricing" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        ssaUrl = `${SSACTIVEWEAR_API_BASE}/products/${encodeURIComponent(style)}/${encodeURIComponent(color)}/pricing`;
        break;
      case "inventory":
        const colorCode = url.searchParams.get("color");
        if (!colorCode) {
          return new Response(
            JSON.stringify({ error: "Color required for inventory" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        ssaUrl = `${SSACTIVEWEAR_API_BASE}/products/${encodeURIComponent(style)}/${encodeURIComponent(colorCode)}/inventory`;
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Create Basic Auth header with decrypted password
    const authString = btoa(`${credentials.username}:${decryptedPassword}`);

    // Make request to SSActivewear API
    const ssaHeaders: Record<string, string> = {
      "Authorization": `Basic ${authString}`,
      "Content-Type": "application/json",
    };

    if (credentials.customerId) {
      ssaHeaders["X-Customer-Id"] = credentials.customerId;
    }

    const ssaResponse = await fetch(ssaUrl, {
      method,
      headers: ssaHeaders,
    });

    if (!ssaResponse.ok) {
      const errorText = await ssaResponse.text();
      console.error("SSActivewear API error:", errorText);
      return new Response(
        JSON.stringify({
          error: "SSActivewear API request failed",
          details: errorText,
          status: ssaResponse.status
        }),
        { status: ssaResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await ssaResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        supplier: "ssactivewear",
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
