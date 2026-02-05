import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { searchSanMarCatalog } from "./sanmar-provider.ts";

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
  cached: boolean;
  last_synced?: string;
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

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Try to get authenticated user, but don't fail if auth fails (dev mode)
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

    let userId: string | null = null;
    let profile: any = null;

    if (authHeader) {
      try {
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false }
        });

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (user && !userError) {
          userId = user.id;
          console.log("User authenticated:", userId);

          // Get the user's company from their profile
          const { data: profileData } = await supabaseAdmin
            .from("user_profiles")
            .select("company_id")
            .eq("id", userId)
            .maybeSingle();

          if (profileData?.company_id) {
            profile = profileData;
            console.log("User company:", profile.company_id);
          }
        }
      } catch (authError) {
        console.log("Auth check failed, continuing without auth:", authError);
      }
    }

    // If no authenticated user, try to find any company (dev mode fallback)
    if (!profile) {
      console.log("No authenticated user, using first available company");
      const { data: firstCompany } = await supabaseAdmin
        .from("company_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (firstCompany) {
        profile = { company_id: firstCompany.id };
        console.log("Using fallback company:", profile.company_id);
      } else {
        return new Response(
          JSON.stringify({ error: "No company found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // Search local cache for SSActivewear (if enabled)
    if (settings?.ssactivewear_enabled) {
      try {
        console.log(`Searching local cache for style: ${style}`);

        // Query the styles table for matching style_number
        const { data: styleData, error: styleError } = await supabaseAdmin
          .from("styles")
          .select(`
            id,
            style_number,
            brand,
            name,
            description,
            category,
            primary_image,
            last_synced
          `)
          .eq("company_id", profile.company_id)
          .ilike("style_number", style)
          .maybeSingle();

        if (styleError) {
          console.error("Style lookup error:", styleError);
          errors.push(`Cache lookup error: ${styleError.message}`);
        } else if (!styleData) {
          console.log(`Style ${style} not found in cache - fetching from SSActivewear...`);

          // Fetch from SSActivewear API and cache it
          try {
            const ssaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(profile.company_id)}`;
            const ssaResponse = await fetch(ssaUrl, {
              headers: {
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
            });

            if (!ssaResponse.ok) {
              const errorText = await ssaResponse.text();
              console.log("SSActivewear API response (not found):", {
                status: ssaResponse.status,
                statusText: ssaResponse.statusText,
                errorBody: errorText.substring(0, 200)
              });

              // Don't add error for product not found - this is expected when searching across multiple suppliers
              // Only log it for debugging
              console.log(`SSActivewear: Style ${style} not found in catalog`);
            } else {
              const ssaData = await ssaResponse.json();

              // Check if API returned an error (success: false)
              if (ssaData.success === false) {
                console.log(`SSActivewear API error:`, ssaData.error);
                errors.push(`Style ${style} not found.`);
              } else {
                const productData = ssaData.data?.[0];

                if (!productData) {
                  console.log(`Style ${style} not found in SSActivewear API`);
                  errors.push(`Style ${style} not found.`);
                } else {
                console.log(`Fetched style ${style} from SSActivewear - caching it...`);

                // Upsert style data into cache
                const { data: newStyleData, error: upsertError } = await supabaseAdmin
                  .from("styles")
                  .upsert({
                    company_id: profile.company_id,
                    style_number: style,
                    brand: productData.productBrand || null,
                    name: productData.productName || null,
                    description: productData.description || null,
                    category: null,
                    primary_image: null,
                    last_synced: new Date().toISOString(),
                  }, {
                    onConflict: "company_id,style_number"
                  })
                  .select("id")
                  .maybeSingle();

                if (upsertError || !newStyleData) {
                  console.error("Failed to cache style:", upsertError);
                  errors.push(`Failed to cache style ${style}`);
                } else {
                  const styleId = newStyleData.id;
                  console.log(`Cached style ${style} with id: ${styleId}`);

                  // Upsert parts data
                  if (productData.parts && Array.isArray(productData.parts)) {
                    for (const part of productData.parts) {
                      if (!part.partId) continue;

                      await supabaseAdmin
                        .from("parts")
                        .upsert({
                          company_id: profile.company_id,
                          style_id: styleId,
                          part_id: part.partId,
                          color_name: part.colorName || null,
                          hex: null,
                          size: part.labelSize || null,
                          weight: null,
                          gtin: null,
                        }, {
                          onConflict: "company_id,part_id"
                        });
                    }
                    console.log(`Cached ${productData.parts.length} parts for style ${style}`);
                  }

                  // Fetch and cache media/images
                  const mediaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=media&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(profile.company_id)}`;
                  const mediaResponse = await fetch(mediaUrl, {
                    headers: {
                      "Authorization": `Bearer ${supabaseServiceKey}`,
                    },
                  });

                  if (mediaResponse.ok) {
                    const mediaData = await mediaResponse.json();
                    const mediaContent = mediaData.data?.mediaContent || [];

                    for (const media of mediaContent) {
                      if (!media.url) continue;

                      const { data: partForImage } = await supabaseAdmin
                        .from("parts")
                        .select("id")
                        .eq("company_id", profile.company_id)
                        .eq("style_id", styleId)
                        .eq("part_id", media.partId || productData.parts?.[0]?.partId)
                        .maybeSingle();

                      if (partForImage) {
                        await supabaseAdmin
                          .from("images")
                          .upsert({
                            company_id: profile.company_id,
                            part_id: partForImage.id,
                            class_type: media.classTypeName || null,
                            url: media.url,
                          }, {
                            onConflict: "company_id,part_id,class_type"
                          });
                      }
                    }
                    console.log(`Cached ${mediaContent.length} images for style ${style}`);
                  }

                  // Fetch live pricing from unified endpoint
                  console.log(`🔍 Fetching live pricing for style: ${style}`);
                  const pricingUrl = `${supabaseUrl}/functions/v1/promostandards-unified?styleNumber=${encodeURIComponent(style)}`;
                  const pricingResponse = await fetch(pricingUrl, {
                    headers: {
                      "Authorization": `Bearer ${supabaseServiceKey}`,
                    },
                  });

                  let pricingMap = new Map<string, number>();
                  console.log(`💰 Pricing API response status: ${pricingResponse.status}`);

                  if (pricingResponse.ok) {
                    const unifiedData = await pricingResponse.json();
                    console.log(`💰 Unified data success:`, unifiedData.success);

                    // Extract pricing from unified response
                    const pricingParts = unifiedData.pricing?.parts || [];
                    console.log(`💰 Found ${pricingParts.length} parts with pricing`);

                    for (const partPricing of pricingParts) {
                      if (partPricing.prices && partPricing.prices.length > 0) {
                        // Use the first price (lowest quantity) as the base price
                        const price = partPricing.prices[0].price;
                        pricingMap.set(partPricing.partId, price);
                        console.log(`💰 Part ${partPricing.partId}: $${price}`);
                      }
                    }
                    console.log(`✅ Fetched pricing for ${pricingMap.size} parts`);
                  } else {
                    const errorText = await pricingResponse.text();
                    console.error(`❌ Pricing API failed: ${pricingResponse.status} - ${errorText}`);
                  }

                  // Now re-query the cached data and return it
                  const { data: cachedStyle } = await supabaseAdmin
                    .from("styles")
                    .select(`
                      id,
                      style_number,
                      brand,
                      name,
                      description,
                      category,
                      primary_image,
                      last_synced
                    `)
                    .eq("id", styleId)
                    .maybeSingle();

                  if (cachedStyle) {
                    // Get all parts for this style grouped by color
                    const { data: partsData } = await supabaseAdmin
                      .from("parts")
                      .select("id, part_id, color_name, hex, size")
                      .eq("style_id", cachedStyle.id)
                      .order("color_name", { ascending: true })
                      .order("size", { ascending: true });

                    // Group parts by color to create color options
                    const colorMap = new Map<string, ColorOption>();

                    for (const part of partsData || []) {
                      const colorName = part.color_name || "Default";
                      const partPrice = pricingMap.get(part.part_id || "") || 0;

                      if (!colorMap.has(colorName)) {
                        colorMap.set(colorName, {
                          name: colorName,
                          code: part.part_id || "",
                          partIds: [],
                          sizes: [],
                          image_url: "",
                          pricing: {
                            wholesale: partPrice,
                            retail: 0,
                          },
                          stock: {},
                        });
                      }

                      const colorOption = colorMap.get(colorName)!;
                      if (part.part_id && !colorOption.partIds?.includes(part.part_id)) {
                        colorOption.partIds?.push(part.part_id);
                      }
                      if (part.size && !colorOption.sizes?.includes(part.size)) {
                        colorOption.sizes?.push(part.size);
                      }
                      // Update pricing if we found a price for this part
                      if (partPrice > 0 && colorOption.pricing) {
                        colorOption.pricing.wholesale = Math.max(colorOption.pricing.wholesale || 0, partPrice);
                      }
                    }

                    const colors = Array.from(colorMap.values());

                    // Get primary image for each color
                    for (const color of colors) {
                      if (!color.partIds || color.partIds.length === 0) continue;

                      const firstPartId = partsData?.find(p =>
                        p.part_id === color.partIds![0]
                      )?.id;

                      if (!firstPartId) continue;

                      const { data: imageData } = await supabaseAdmin
                        .from("images")
                        .select("url, class_type")
                        .eq("part_id", firstPartId)
                        .order("class_type", { ascending: true });

                      if (imageData && imageData.length > 0) {
                        let bestImage = imageData.find((img) =>
                          (img.class_type || "").toLowerCase().includes("front")
                        );

                        if (!bestImage) {
                          bestImage = imageData.find((img) => {
                            const type = (img.class_type || "").toLowerCase();
                            return type.includes("rear") || type.includes("back");
                          });
                        }

                        if (!bestImage) {
                          bestImage = imageData[0];
                        }

                        if (bestImage?.url) {
                          color.image_url = bestImage.url;
                        }
                      }
                    }

                    results.push({
                      supplier: "ssactivewear",
                      style: cachedStyle.style_number,
                      brand: cachedStyle.brand || "",
                      description: cachedStyle.name || cachedStyle.description || "",
                      category: cachedStyle.category || "",
                      colors,
                      cached: true,
                      last_synced: cachedStyle.last_synced,
                    });

                    console.log(`Successfully loaded ${colors.length} colors from newly cached style`);
                  }
                }
              }
              }
            }
          } catch (fetchError: any) {
            console.error("Error fetching/caching style:", fetchError);
            errors.push(`Failed to fetch style ${style}: ${fetchError.message}`);
          }
        } else {
          console.log(`Found style in cache: ${styleData.style_number}`);

          // Fetch live pricing for cached style from unified endpoint
          console.log(`🔍 Fetching live pricing for cached style: ${style}`);
          const pricingUrl = `${supabaseUrl}/functions/v1/promostandards-unified?styleNumber=${encodeURIComponent(style)}`;
          const pricingResponse = await fetch(pricingUrl, {
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
          });

          let pricingMap = new Map<string, number>();
          console.log(`💰 Pricing API response status: ${pricingResponse.status}`);

          if (pricingResponse.ok) {
            const unifiedData = await pricingResponse.json();
            console.log(`💰 Unified data success:`, unifiedData.success);

            // Extract pricing from unified response
            const pricingParts = unifiedData.pricing?.parts || [];
            console.log(`💰 Found ${pricingParts.length} parts with pricing`);

            for (const partPricing of pricingParts) {
              if (partPricing.prices && partPricing.prices.length > 0) {
                const price = partPricing.prices[0].price;
                pricingMap.set(partPricing.partId, price);
                console.log(`💰 Part ${partPricing.partId}: $${price}`);
              }
            }
            console.log(`✅ Fetched live pricing for ${pricingMap.size} parts`);
          } else {
            const errorText = await pricingResponse.text();
            console.error(`❌ Pricing API failed: ${pricingResponse.status} - ${errorText}`);
          }

          // Get all parts for this style grouped by color
          const { data: partsData, error: partsError } = await supabaseAdmin
            .from("parts")
            .select("id, part_id, color_name, hex, size")
            .eq("style_id", styleData.id)
            .order("color_name", { ascending: true })
            .order("size", { ascending: true });

          if (partsError) {
            console.error("Parts lookup error:", partsError);
            errors.push(`Parts lookup error: ${partsError.message}`);
          } else {
            console.log(`Found ${partsData?.length || 0} parts for style ${styleData.style_number}`);

            // Group parts by color to create color options
            const colorMap = new Map<string, ColorOption>();

            for (const part of partsData || []) {
              const colorName = part.color_name || "Default";
              const partPrice = pricingMap.get(part.part_id || "") || 0;

              if (!colorMap.has(colorName)) {
                colorMap.set(colorName, {
                  name: colorName,
                  code: part.part_id || "",
                  partIds: [],
                  sizes: [],
                  image_url: "",
                  pricing: {
                    wholesale: partPrice,
                    retail: 0,
                  },
                  stock: {},
                });
              }

              const colorOption = colorMap.get(colorName)!;
              if (part.part_id && !colorOption.partIds?.includes(part.part_id)) {
                colorOption.partIds?.push(part.part_id);
              }
              if (part.size && !colorOption.sizes?.includes(part.size)) {
                colorOption.sizes?.push(part.size);
              }
              // Update pricing if we found a price for this part
              if (partPrice > 0 && colorOption.pricing) {
                colorOption.pricing.wholesale = Math.max(colorOption.pricing.wholesale || 0, partPrice);
              }
            }

            const colors = Array.from(colorMap.values());

            // Get primary image for each color (front view preferred)
            for (const color of colors) {
              if (!color.partIds || color.partIds.length === 0) continue;

              // Get the first part_id UUID for this color
              const firstPartId = partsData?.find(p =>
                p.part_id === color.partIds![0]
              )?.id;

              if (!firstPartId) continue;

              // Query images for this part
              const { data: imageData } = await supabaseAdmin
                .from("images")
                .select("url, class_type")
                .eq("part_id", firstPartId)
                .order("class_type", { ascending: true });

              if (imageData && imageData.length > 0) {
                // Try to find front image first
                let bestImage = imageData.find((img) =>
                  (img.class_type || "").toLowerCase().includes("front")
                );

                // If no front, try rear/back
                if (!bestImage) {
                  bestImage = imageData.find((img) => {
                    const type = (img.class_type || "").toLowerCase();
                    return type.includes("rear") || type.includes("back");
                  });
                }

                // Otherwise use first available
                if (!bestImage) {
                  bestImage = imageData[0];
                }

                if (bestImage?.url) {
                  color.image_url = bestImage.url;
                }
              }
            }

            results.push({
              supplier: "ssactivewear",
              style: styleData.style_number,
              brand: styleData.brand || "",
              description: styleData.name || styleData.description || "",
              category: styleData.category || "",
              colors,
              cached: true,
              last_synced: styleData.last_synced,
            });

            console.log(`Successfully loaded ${colors.length} colors from cache`);
          }
        }
      } catch (error: any) {
        console.error("Cache search error:", error);
        errors.push(`Cache error: ${error.message}`);
      }
    }

    // Search SanMar catalog cache if enabled
    if (settings?.sanmar_enabled) {
      try {
        console.log(`🔍 Searching SanMar catalog (cache + live enrichment)...`);
        const sanmarResult = await searchSanMarCatalog(
          supabaseAdmin,
          supabaseUrl,
          supabaseServiceKey,
          profile.company_id,
          style
        );

        if (sanmarResult.results.length > 0) {
          results.push(...sanmarResult.results);
          console.log(`✅ Found ${sanmarResult.results.length} SanMar result(s)`);
        }

        if (sanmarResult.errors.length > 0) {
          errors.push(...sanmarResult.errors);
        }
      } catch (error: any) {
        console.error("SanMar search error:", error);
        errors.push(`SanMar: ${error.message}`);
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
