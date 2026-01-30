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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Auth header present");

    // Create a client with the user's token to verify authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the JWT by trying to get the authenticated user
    console.log("Attempting to verify JWT...");
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      console.error("Auth verification failed");
      console.error("Auth error details:", {
        message: authError?.message,
        status: authError?.status,
        name: authError?.name,
      });
      return new Response(
        JSON.stringify({
          code: 401,
          error: "Unauthorized",
          message: authError?.message || "Invalid JWT",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Create admin client for database queries
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

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

    // Get integration settings from company_settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("company_settings")
      .select("sanmar_enabled, ssactivewear_enabled")
      .eq("id", profile.company_id)
      .maybeSingle();

    console.log("Integration settings:", {
      company_id: profile.company_id,
      settings,
      settingsError,
      ssactivewear_enabled: settings?.ssactivewear_enabled,
      sanmar_enabled: settings?.sanmar_enabled,
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

            // Fetch media/images for the product
            try {
              const mediaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=media&productId=${encodeURIComponent(style)}`;
              const mediaResponse = await fetch(mediaUrl, {
                headers: {
                  "Authorization": authHeader,
                },
              });

              if (mediaResponse.ok) {
                const mediaData = await mediaResponse.json();
                console.log("SSActivewear media response:", mediaData);

                if (mediaData.success && mediaData.data && ssaProducts.length > 0) {
                  // Add media URLs to the product colors
                  const product = ssaProducts[0];
                  const mediaContent = mediaData.data.mediaContent || [];

                  // Map media to colors by matching color names or part IDs
                  for (const media of mediaContent) {
                    const matchingColor = product.colors.find((c: any) =>
                      c.name === media.colorName || c.code === media.partId
                    );
                    if (matchingColor && media.url) {
                      matchingColor.image_url = media.url;
                    }
                  }

                  console.log("Updated product with media:", product);
                }
              }
            } catch (mediaError: any) {
              console.warn("Failed to fetch media for SSActivewear product:", mediaError.message);
            }

            results.push(...ssaProducts);
          }
        } else {
          const errorText = await ssaResponse.text();
          console.error("SSActivewear error response status:", ssaResponse.status);
          console.error("SSActivewear error response:", errorText);
          errors.push(`SSActivewear error (${ssaResponse.status}): ${errorText}`);
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

  // PromoStandards SOAP response format
  if (Array.isArray(data) && data.length > 0) {
    for (const item of data) {
      const colors: ColorOption[] = [];

      // PromoStandards returns 'parts' array with color/size combinations
      if (item.parts && Array.isArray(item.parts)) {
        // Group parts by color to create unique color options
        const colorMap = new Map<string, ColorOption>();

        for (const part of item.parts) {
          const colorName = part.colorName || "Default";

          if (!colorMap.has(colorName)) {
            colorMap.set(colorName, {
              name: colorName,
              code: part.partId || "",
              image_url: "",
              pricing: {
                wholesale: 0,
                retail: 0,
              },
              sizes: [],
              stock: {},
            });
          }

          // Add size if not already in the list
          const colorOption = colorMap.get(colorName)!;
          if (part.labelSize && !colorOption.sizes?.includes(part.labelSize)) {
            colorOption.sizes = colorOption.sizes || [];
            colorOption.sizes.push(part.labelSize);
          }
        }

        colors.push(...Array.from(colorMap.values()));
      }

      // If no parts/colors found, create a default entry
      if (colors.length === 0) {
        colors.push({
          name: "Default",
          code: "",
          image_url: "",
          pricing: {
            wholesale: 0,
            retail: 0,
          },
          sizes: [],
          stock: {},
        });
      }

      products.push({
        supplier: "ssactivewear",
        style: String(item.productId || style),
        brand: String(item.productBrand || ""),
        description: String(item.productName || item.description || ""),
        category: "",
        colors,
        raw_data: item,
      });
    }
  }

  return products;
}
