import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ColorOption {
  name: string;
  code: string;
  image_url?: string;
  pricing?: {
    wholesale?: number;
    retail?: number;
  };
  stock?: Record<string, number>;
  sizes?: string[];
}

interface ProductResult {
  supplier: "sanmar" | "ssactivewear";
  style: string;
  brand: string;
  description: string;
  category?: string;
  colors: ColorOption[];
  raw_data?: any;
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with anon key and user's JWT for RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: authError?.message }),
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

    // Get integration settings
    const { data: settings, error: settingsError } = await supabase
      .from("integration_settings")
      .select("*")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    console.log("Integration settings:", {
      company_id: profile.company_id,
      settings,
      settingsError,
      ssactivewear_enabled: settings?.ssactivewear_enabled,
    });

    // Parse request
    const url = new URL(req.url);
    const style = url.searchParams.get("style");

    if (!style) {
      return new Response(
        JSON.stringify({ error: "Style number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ProductResult[] = [];
    const errors: string[] = [];

    // Search SanMar if enabled
    if (settings?.sanmar_enabled) {
      try {
        const sanmarUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=search&style=${encodeURIComponent(style)}`;
        const sanmarResponse = await fetch(sanmarUrl, {
          headers: {
            "Authorization": authHeader,
          },
        });

        if (sanmarResponse.ok) {
          const sanmarData = await sanmarResponse.json();
          if (sanmarData.success && sanmarData.data) {
            // Transform SanMar data to common format
            const sanmarProducts = transformSanMarData(sanmarData.data, style);
            results.push(...sanmarProducts);
          }
        } else {
          const errorText = await sanmarResponse.text();
          errors.push(`SanMar: ${errorText}`);
        }
      } catch (error: any) {
        console.error("SanMar search error:", error);
        errors.push(`SanMar: ${error.message}`);
      }
    }

    // Search SSActivewear if enabled
    if (settings?.ssactivewear_enabled) {
      try {
        const ssaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&style=${encodeURIComponent(style)}`;
        const ssaResponse = await fetch(ssaUrl, {
          headers: {
            "Authorization": authHeader,
          },
        });

        if (ssaResponse.ok) {
          const ssaData = await ssaResponse.json();
          console.log("SSActivewear response data count:", ssaData?.data?.length || 0);
          console.log("SSActivewear first item:", ssaData?.data?.[0]);
          if (ssaData.success && ssaData.data) {
            const ssaProducts = transformSSActivewearData(ssaData.data, style);
            console.log("Transformed products count:", ssaProducts.length);
            console.log("First transformed product:", ssaProducts[0]);
            // Don't filter here - let the client do it so we can see what's coming through
            results.push(...ssaProducts);
          }
        } else {
          const errorText = await ssaResponse.text();
          console.error("SSActivewear error response:", errorText);
          if (!errorText.includes("not found")) {
            errors.push(`SSActivewear: ${errorText}`);
          }
        }
      } catch (error: any) {
        console.error("SSActivewear search error:", error);
        errors.push(`SSActivewear: ${error.message}`);
      }
    }

    // Check if any integrations are enabled
    if (!settings?.sanmar_enabled && !settings?.ssactivewear_enabled) {
      return new Response(
        JSON.stringify({
          error: "No supplier integrations enabled",
          message: "Please enable at least one supplier integration in Account Settings"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        style,
        results,
        errors: errors.length > 0 ? errors : undefined,
        count: results.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Product search error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function transformSanMarData(data: any, style: string): ProductResult[] {
  // Transform SanMar API response to common format
  // This is a placeholder - adjust based on actual SanMar API response structure
  const products: ProductResult[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      products.push({
        supplier: "sanmar",
        style: item.styleNumber || style,
        brand: item.brandName || item.brand || "",
        description: item.productName || item.description || "",
        category: item.category || item.productCategory,
        colors: (item.colors || []).map((color: any) => ({
          name: color.colorName || color.name,
          code: color.colorCode || color.code,
          image_url: color.imageUrl || color.image,
          pricing: {
            wholesale: color.wholesalePrice || color.price,
            retail: color.retailPrice || color.msrp,
          },
          stock: color.inventory || {},
          sizes: color.sizes || color.availableSizes || [],
        })),
        raw_data: item,
      });
    }
  } else if (data.product || data.products) {
    const product = data.product || data.products[0];
    if (product) {
      products.push({
        supplier: "sanmar",
        style: product.styleNumber || style,
        brand: product.brandName || product.brand || "",
        description: product.productName || product.description || "",
        category: product.category || product.productCategory,
        colors: (product.colors || []).map((color: any) => ({
          name: color.colorName || color.name,
          code: color.colorCode || color.code,
          image_url: color.imageUrl || color.image,
          pricing: {
            wholesale: color.wholesalePrice || color.price,
            retail: color.retailPrice || color.msrp,
          },
          stock: color.inventory || {},
          sizes: color.sizes || color.availableSizes || [],
        })),
        raw_data: product,
      });
    }
  }

  return products;
}

function transformSSActivewearData(data: any, style: string): ProductResult[] {
  const products: ProductResult[] = [];

  // SSActivewear /styles/ endpoint returns style objects with color info
  if (Array.isArray(data) && data.length > 0) {
    for (const item of data) {
      const colors: ColorOption[] = [];

      // SSA styles endpoint returns colorArray or similar
      if (item.colors && Array.isArray(item.colors)) {
        for (const color of item.colors) {
          colors.push({
            name: color.colorName || color.name || "Default",
            code: color.colorCode || "",
            image_url: color.colorFrontImage || color.colorSwatchImage || color.imageUrl || "",
            pricing: {
              wholesale: parseFloat(color.customerPrice) || parseFloat(color.piecePrice) || 0,
              retail: parseFloat(color.msrp) || 0,
            },
            sizes: color.sizes || [],
            stock: {},
          });
        }
      }

      // If no colors array, create a default entry from the item itself
      if (colors.length === 0) {
        colors.push({
          name: item.colorName || "Default",
          code: item.colorCode || "",
          image_url: item.styleImage || item.brandImage || "",
          pricing: {
            wholesale: parseFloat(item.basePrice) || 0,
            retail: parseFloat(item.msrp) || 0,
          },
          sizes: [],
          stock: {},
        });
      }

      products.push({
        supplier: "ssactivewear",
        style: item.styleID || item.style || style,
        brand: item.brandName || item.brand || "",
        description: item.title || item.styleName || item.description || "",
        category: item.categoryName || item.category || "",
        colors,
        raw_data: item,
      });
    }
  }

  return products;
}
