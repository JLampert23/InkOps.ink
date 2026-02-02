import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Max-Age": "86400",
};

interface ColorOption {
  name: string;
  code: string;
  partIds?: string[];
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

    if (!authHeader) {
      return new Response(
        JSON.stringify({ code: 401, message: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace("Bearer ", "");

    // Create admin client for all operations (using service role key)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the JWT by passing the token explicitly
    console.log('Validating JWT token...');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError) {
      console.error("JWT validation error:", userError);
      return new Response(
        JSON.stringify({ code: 401, message: "Invalid JWT", details: userError.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user) {
      console.error("No user found in JWT");
      return new Response(
        JSON.stringify({ code: 401, message: "Invalid JWT - no user found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("JWT validated successfully for user:", user.id);

    // Get the user's company from their profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.company_id) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "Company not found for user" }),
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
    const rawStyle = url.searchParams.get("style");

    if (!rawStyle) {
      return new Response(
        JSON.stringify({ error: "Style number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trim whitespace from style number
    const style = rawStyle.trim();

    const results: ProductResult[] = [];
    const errors: string[] = [];

    // Search SanMar if enabled
    if (settings?.sanmar_enabled) {
      try {
        const sanmarUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=search&style=${encodeURIComponent(style)}&companyId=${encodeURIComponent(profile.company_id)}`;
        const sanmarResponse = await fetch(sanmarUrl, {
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
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
        const ssaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&style=${encodeURIComponent(style)}&companyId=${encodeURIComponent(profile.company_id)}`;
        const ssaResponse = await fetch(ssaUrl, {
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
        });

        if (ssaResponse.ok) {
          const ssaData = await ssaResponse.json();
          console.log("SSActivewear response data count:", ssaData?.data?.length || 0);
          if (ssaData.success && ssaData.data) {
            const ssaProducts = transformSSActivewearData(ssaData.data, style);
            console.log("Transformed products count:", ssaProducts.length);

            // Fetch all media for the product at once (much faster than per-color)
            try {
              if (ssaProducts.length > 0) {
                const product = ssaProducts[0];

                // Fetch all media for this style (without partId to get all colors)
                const mediaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=media&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(profile.company_id)}`;

                console.log(`Fetching all media for style ${style}`);

                const mediaResponse = await fetch(mediaUrl, {
                  headers: {
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                  },
                });

                if (mediaResponse.ok) {
                  const mediaData = await mediaResponse.json();
                  const mediaContent = mediaData.data?.mediaContent || [];

                  console.log(`Received ${mediaContent.length} total images for ${product.colors.length} colors`);

                  // Match media to colors by partId
                  for (const color of product.colors) {
                    if (!color.partIds || color.partIds.length === 0) continue;

                    // Find all media for this color by matching any of its partIds
                    const colorMedia = mediaContent.filter((media: any) => {
                      return color.partIds.some((partId: string) => partId === media.partId);
                    });

                    console.log(`Found ${colorMedia.length} images for ${color.name} (partIds: ${color.partIds.join(', ')})`);

                    if (colorMedia.length > 0) {
                      // Try to find a front image first
                      let bestImage = colorMedia.find((m: any) =>
                        (m.classTypeName || '').toLowerCase().includes('front')
                      );

                      // If no front image, try back/rear image
                      if (!bestImage) {
                        bestImage = colorMedia.find((m: any) => {
                          const type = (m.classTypeName || '').toLowerCase();
                          return type.includes('back') || type.includes('rear');
                        });
                      }

                      // If still no image, use the first available image
                      if (!bestImage) {
                        bestImage = colorMedia[0];
                      }

                      if (bestImage && bestImage.url) {
                        color.image_url = bestImage.url;
                        console.log(`✓ Assigned ${bestImage.classTypeName} image to ${color.name}`);
                      }
                    } else {
                      console.warn(`No media found for ${color.name} with partIds: ${color.partIds.join(', ')}`);
                    }
                  }
                } else {
                  const errorText = await mediaResponse.text();
                  console.error("Media API error:", errorText);
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
        const colorMap = new Map<string, any>();

        for (const part of item.parts) {
          const colorName = part.colorName || "Default";

          if (!colorMap.has(colorName)) {
            colorMap.set(colorName, {
              name: colorName,
              code: part.partId || "",
              partIds: [part.partId], // Store all partIds for this color
              image_url: "",
              pricing: {
                wholesale: 0,
                retail: 0,
              },
              sizes: [],
              stock: {},
            });
          } else {
            // Add this partId to the existing color
            const colorOption = colorMap.get(colorName)!;
            if (part.partId && !colorOption.partIds.includes(part.partId)) {
              colorOption.partIds.push(part.partId);
            }
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
          partIds: [],
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
