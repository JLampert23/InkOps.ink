import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// SSActivewear REST API endpoints
const SSA_REST_API_BASE = "https://api.ssactivewear.com/v2";

interface SSActivewearCredentials {
  accountNumber: string;
  apiKey: string;
}

async function makeRestApiRequest(endpoint: string, accountNumber: string, apiKey: string) {
  const basicAuth = btoa(`${accountNumber}:${apiKey}`);

  const headers: Record<string, string> = {
    "Authorization": `Basic ${basicAuth}`,
    "Accept": "application/json",
  };

  console.log('Making REST API request to:', endpoint);

  const response = await fetch(endpoint, {
    method: "GET",
    headers,
  });

  const responseText = await response.text();

  console.log('REST API Response:', {
    status: response.status,
    statusText: response.statusText,
    bodyLength: responseText.length,
    bodyPreview: responseText.substring(0, 500)
  });

  if (!response.ok) {
    throw new Error(`REST API request failed: ${response.status} ${response.statusText} - ${responseText}`);
  }

  return JSON.parse(responseText);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SSActivewear API Request Started ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    console.log("Has auth header:", !!authHeader);
    console.log("Auth header length:", authHeader?.length);

    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token length:", token.length);
    console.log("Token first 20 chars:", token.substring(0, 20));

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log("Verifying JWT...");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    console.log("Auth result:", { hasUser: !!user, hasError: !!authError, errorMessage: authError?.message });

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ code: 401, message: "Invalid JWT", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

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
      .from("company_settings")
      .eq("id", profile.company_id)
      .select("ssactivewear_enabled, ssactivewear_username, ssactivewear_api_key_encrypted")
      .maybeSingle();

    if (!settings?.ssactivewear_enabled || !settings?.ssactivewear_api_key_encrypted || !settings?.ssactivewear_username) {
      return new Response(
        JSON.stringify({ error: "SSActivewear credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = {
      accountNumber: settings.ssactivewear_username,
      apiKey: settings.ssactivewear_api_key_encrypted
    } as SSActivewearCredentials;

    // Decrypt the API key
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

    console.log('Decrypted API key first 10 chars:', decryptedApiKey?.substring(0, 10));
    console.log('Account number:', credentials.accountNumber);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const productId = url.searchParams.get("productId") || url.searchParams.get("style");

    console.log('SSActivewear REST API Request:', { action, productId });

    // Handle different actions using REST API
    switch (action) {
      case "brands": {
        // Get list of brands
        const endpoint = `${SSA_REST_API_BASE}/categories/?type=Brand`;
        const brandsData = await makeRestApiRequest(endpoint, credentials.accountNumber, decryptedApiKey);

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: brandsData,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "product":
      case "search":
      case "colors": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID (style number) required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get product details from REST API
        const endpoint = `${SSA_REST_API_BASE}/products/?style=${encodeURIComponent(productId)}`;
        const productData = await makeRestApiRequest(endpoint, credentials.accountNumber, decryptedApiKey);

        console.log('Product data received:', {
          count: Array.isArray(productData) ? productData.length : 'not array',
          firstItem: Array.isArray(productData) && productData.length > 0 ? productData[0] : null
        });

        // Transform to consistent format
        const transformedData = Array.isArray(productData)
          ? productData.map((product: any) => ({
              productId: product.styleID || product.style,
              productName: product.styleName || product.description,
              description: product.description || product.styleName,
              productBrand: product.brandName || product.brand,
              parts: (product.colors || []).map((color: any) => ({
                partId: color.colorID || color.color,
                colorName: color.colorName || color.color,
                labelSize: color.size || '',
              })),
              colors: product.colors || [],
              categories: product.categories || [],
              raw: product,
            }))
          : [];

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: transformedData,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "inventory": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const endpoint = `${SSA_REST_API_BASE}/products/${encodeURIComponent(productId)}/inventory`;
        const inventoryData = await makeRestApiRequest(endpoint, credentials.accountNumber, decryptedApiKey);

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: inventoryData,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "pricing": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const endpoint = `${SSA_REST_API_BASE}/products/?style=${encodeURIComponent(productId)}`;
        const productData = await makeRestApiRequest(endpoint, credentials.accountNumber, decryptedApiKey);

        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            data: productData,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: product, search, inventory, or pricing" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error: any) {
    console.error("SSActivewear API function error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString(),
        type: error.constructor.name
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
