import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Max-Age": "86400",
};

const SSA_REST_API_BASE = "https://api.ssactivewear.com/v2";

interface SSActivewearCredentials {
  accountNumber: string;
  apiKey: string;
}

async function makeSSARestRequest(
  endpoint: string,
  accountNumber: string,
  apiKey: string
) {
  const basicAuth = btoa(`${accountNumber}:${apiKey}`);

  console.log('Making SSActivewear REST API request:', {
    endpoint,
    accountNumber: accountNumber.substring(0, 4) + '***',
  });

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
  });

  const responseText = await response.text();

  console.log('SSActivewear REST API Response:', {
    status: response.status,
    statusText: response.statusText,
    bodyLength: responseText.length,
  });

  if (!response.ok) {
    throw new Error(`SSActivewear REST API request failed: ${response.status} ${response.statusText}`);
  }

  return JSON.parse(responseText);
}

Deno.serve(async (req: Request) => {
  console.log("🚀 FUNCTION INVOKED - Method:", req.method, "URL:", req.url);

  if (req.method === "OPTIONS") {
    console.log("✅ OPTIONS request - returning CORS headers");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SSActivewear REST API Request Started ===");

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

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
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
      console.log("Service role call - using company_id:", companyId);
    } else {
      // User JWT - validate using anon key client with user's JWT
      console.log("User JWT - validating token");

      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

      if (authError || !user) {
        console.error("Auth error:", authError);
        return new Response(
          JSON.stringify({ error: "Unauthorized", details: authError?.message }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user's company_id using service role client
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
      companyId = profile.company_id;
      console.log("User authenticated - company_id:", companyId);
    }

    const { data: settings } = await supabase
      .from("company_settings")
      .select("ssactivewear_enabled, ssactivewear_username, ssactivewear_api_key_encrypted")
      .eq("id", companyId)
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

    console.log('SSActivewear REST API Request:', { action, productId });

    switch (action) {
      case "brands": {
        return new Response(
          JSON.stringify({
            success: true,
            supplier: "ssactivewear",
            action,
            message: "SSActivewear connection verified. Use 'product' action to search products.",
            authenticated: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      case "product":
      case "search": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID (style number) required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const productData = await makeSSARestRequest(
            `${SSA_REST_API_BASE}/products/?style=${encodeURIComponent(productId)}`,
            credentials.accountNumber,
            decryptedApiKey
          );

          if (!productData || productData.length === 0) {
            return new Response(
              JSON.stringify({
                success: false,
                supplier: "ssactivewear",
                action,
                error: `Product not found`,
                data: []
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }

          // Transform REST API response to match expected format
          const product = productData[0];
          const transformedData = [{
            productId: product.styleID || productId,
            productName: product.styleName || "",
            description: product.description || "",
            productBrand: product.brandName || "",
            colors: (product.colorArray || []).map((c: any) => ({
              colorName: c.colorName || "",
            })),
            parts: (product.colorArray || []).flatMap((color: any) =>
              (color.sizeArray || []).map((size: any) => ({
                partId: size.sku || "",
                colorName: color.colorName || "",
                labelSize: size.size || "",
              }))
            ),
          }];

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
        } catch (error: any) {
          console.error("Product search error:", error);
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "ssactivewear",
              action,
              error: error.message,
              data: []
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
      }

      case "inventory": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const inventoryData = await makeSSARestRequest(
            `${SSA_REST_API_BASE}/inventory/?style=${encodeURIComponent(productId)}`,
            credentials.accountNumber,
            decryptedApiKey
          );

          const inventoryArray = (inventoryData || []).map((item: any) => ({
            partId: item.sku || "",
            quantityAvailable: item.qty || 0,
          }));

          return new Response(
            JSON.stringify({
              success: true,
              supplier: "ssactivewear",
              action,
              data: inventoryArray,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        } catch (error: any) {
          console.error("Inventory error:", error);
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "ssactivewear",
              action,
              error: error.message,
              data: []
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
      }

      case "pricing": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const productData = await makeSSARestRequest(
            `${SSA_REST_API_BASE}/products/?style=${encodeURIComponent(productId)}`,
            credentials.accountNumber,
            decryptedApiKey
          );

          if (!productData || productData.length === 0) {
            return new Response(
              JSON.stringify({
                success: false,
                supplier: "ssactivewear",
                action,
                error: "Product not found",
                data: []
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }

          const product = productData[0];
          const partArray = (product.colorArray || []).flatMap((color: any) =>
            (color.sizeArray || []).map((size: any) => ({
              partId: size.sku || "",
              prices: [{
                quantity: 1,
                price: parseFloat(size.customerPrice || size.casePrice || "0"),
              }],
            }))
          );

          return new Response(
            JSON.stringify({
              success: true,
              supplier: "ssactivewear",
              action,
              data: partArray,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        } catch (error: any) {
          console.error("Pricing error:", error);
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "ssactivewear",
              action,
              error: error.message,
              data: []
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
      }

      case "media": {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: "Product ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const productData = await makeSSARestRequest(
            `${SSA_REST_API_BASE}/products/?style=${encodeURIComponent(productId)}`,
            credentials.accountNumber,
            decryptedApiKey
          );

          if (!productData || productData.length === 0) {
            return new Response(
              JSON.stringify({
                success: false,
                supplier: "ssactivewear",
                action,
                error: "Product not found",
                data: {
                  productId,
                  partId: null,
                  mediaContent: []
                }
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }

          const product = productData[0];
          const mediaArray: any[] = [];

          // Add product-level images
          if (product.imageArray) {
            for (const img of product.imageArray) {
              mediaArray.push({
                url: img.image || "",
                productId: product.styleID || productId,
                partId: "",
                classTypeName: img.imageType || "Front",
                color: "",
                singlePart: false,
                isImage: true,
              });
            }
          }

          // Add color-specific images
          for (const color of product.colorArray || []) {
            if (color.colorFrontImage) {
              mediaArray.push({
                url: color.colorFrontImage,
                productId: product.styleID || productId,
                partId: "",
                classTypeName: "Front",
                color: color.colorName || "",
                singlePart: false,
                isImage: true,
              });
            }
            if (color.colorBackImage) {
              mediaArray.push({
                url: color.colorBackImage,
                productId: product.styleID || productId,
                partId: "",
                classTypeName: "Back",
                color: color.colorName || "",
                singlePart: false,
                isImage: true,
              });
            }
            if (color.colorSideImage) {
              mediaArray.push({
                url: color.colorSideImage,
                productId: product.styleID || productId,
                partId: "",
                classTypeName: "Side",
                color: color.colorName || "",
                singlePart: false,
                isImage: true,
              });
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              supplier: "ssactivewear",
              action,
              data: {
                productId,
                partId: null,
                mediaContent: mediaArray,
              },
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        } catch (error: any) {
          console.error("Media error:", error);
          return new Response(
            JSON.stringify({
              success: false,
              supplier: "ssactivewear",
              action,
              error: error.message,
              data: {
                productId,
                partId: null,
                mediaContent: []
              }
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: brands, product, search, inventory, pricing, or media" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error: any) {
    console.error("SSActivewear REST API error:", error);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
