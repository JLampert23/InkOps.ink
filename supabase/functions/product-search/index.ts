import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { searchSanMarCatalog } from "./sanmar-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Max-Age": "86400",
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const rawStyle = url.searchParams.get("style");

    if (!rawStyle) {
      return new Response(
        JSON.stringify({ error: "Style number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const style = rawStyle.trim();
    console.log(`🔍 Quick search for: ${style}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let companyId: string | null = null;
    const companyIdParam = url.searchParams.get("companyId");

    if (companyIdParam) {
      companyId = companyIdParam;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const jwtParts = token.split('.');

      if (jwtParts.length !== 3) {
        return new Response(
          JSON.stringify({ error: "Invalid JWT format" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let userId: string;
      try {
        const payload = JSON.parse(atob(jwtParts[1]));
        userId = payload.sub;
        console.log("Decoded user ID from JWT:", userId);
      } catch (e) {
        return new Response(
          JSON.stringify({ error: "Failed to decode JWT" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("company_id")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.company_id) {
        return new Response(
          JSON.stringify({ error: "User company not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      companyId = profile.company_id;
      console.log("Using company_id from user profile:", companyId);
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "No company found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ProductResult[] = [];
    const searchErrors: string[] = [];

    const { data: settings } = await supabaseAdmin
      .from("company_settings")
      .select("sanmar_enabled, ssactivewear_enabled")
      .eq("id", companyId)
      .maybeSingle();

    const searchPromises: Promise<void>[] = [];

    if (settings?.ssactivewear_enabled) {
      searchPromises.push(
        (async () => {
          try {
            const cached = await searchSSActivewearCache(supabaseAdmin, companyId!, style);
            if (cached) {
              results.push(cached);
            } else {
              console.log(`SSA cache miss for ${style}, calling live API...`);
              const liveResult = await fetchAndCacheSSActivewear(
                supabaseAdmin, supabaseUrl, supabaseServiceKey, companyId!, style
              );
              if (liveResult) {
                results.push(liveResult);
              }
            }
          } catch (error: any) {
            console.error("SSA search error:", error.message);
            searchErrors.push(`SSA: ${error.message}`);
          }
        })()
      );
    }

    if (settings?.sanmar_enabled) {
      searchPromises.push(
        (async () => {
          try {
            const apiResult = await withTimeout(
              searchSanMarCatalog(
                supabaseAdmin,
                supabaseUrl,
                supabaseServiceKey,
                companyId!,
                style
              ),
              20000,
              "SanMar search timeout"
            );
            if (apiResult.results.length > 0) {
              results.push(...apiResult.results);
            }
            if (apiResult.errors.length > 0) {
              searchErrors.push(...apiResult.errors);
            }
          } catch (error: any) {
            console.error("SanMar search exception:", error.message);
            searchErrors.push(`SanMar: ${error.message}`);
          }
        })()
      );
    }

    await Promise.allSettled(searchPromises);

    const diagnostics = {
      companyId,
      settingsChecked: !!settings,
      sanmarEnabled: settings?.sanmar_enabled || false,
      ssaEnabled: settings?.ssactivewear_enabled || false,
      searchPromisesCount: searchPromises.length,
      errors: searchErrors,
    };

    return new Response(
      JSON.stringify({
        success: true,
        style,
        results,
        count: results.length,
        diagnostics,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function searchSSActivewearCache(
  supabaseAdmin: any,
  companyId: string,
  style: string
): Promise<ProductResult | null> {
  try {
    const { data: styleData } = await supabaseAdmin
      .from("styles")
      .select("id, style_number, brand, name, description, category, last_synced")
      .eq("company_id", companyId)
      .ilike("style_number", style)
      .maybeSingle();

    if (!styleData) return null;

    const { data: partsData } = await supabaseAdmin
      .from("parts")
      .select("id, part_id, color_name, size")
      .eq("style_id", styleData.id)
      .order("color_name", { ascending: true });

    if (!partsData || partsData.length === 0) return null;

    const colorMap = new Map<string, ColorOption>();

    for (const part of partsData) {
      const colorName = part.color_name || "Default";

      if (!colorMap.has(colorName)) {
        colorMap.set(colorName, {
          name: colorName,
          code: part.part_id || "",
          partIds: [],
          sizes: [],
          image_url: "",
          pricing: { wholesale: 0, retail: 0 },
          stock: {},
        });
      }

      const color = colorMap.get(colorName)!;
      if (part.part_id && !color.partIds?.includes(part.part_id)) {
        color.partIds?.push(part.part_id);
      }
      if (part.size && !color.sizes?.includes(part.size)) {
        color.sizes?.push(part.size);
      }
    }

    // Get images and pricing for first part of each color
    for (const [_, color] of colorMap) {
      if (color.partIds && color.partIds.length > 0) {
        const firstPartId = color.partIds[0];
        const firstPart = partsData.find(p => p.part_id === firstPartId);

        if (firstPart) {
          const { data: imageData } = await supabaseAdmin
            .from("images")
            .select("url")
            .eq("part_id", firstPart.id)
            .limit(1)
            .maybeSingle();

          if (imageData?.url) {
            color.image_url = imageData.url;
          }
        }

        // Get pricing from cache
        const { data: pricingData } = await supabaseAdmin
          .from("ss_catalog_pricing")
          .select("unit_price")
          .eq("company_id", companyId)
          .eq("part_number", firstPartId)
          .order("quantity_min", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (pricingData?.unit_price) {
          color.pricing = {
            wholesale: parseFloat(pricingData.unit_price),
            retail: parseFloat(pricingData.unit_price),
          };
        }
      }
    }

    return {
      supplier: "ssactivewear",
      style: styleData.style_number,
      brand: styleData.brand || "",
      description: styleData.name || styleData.description || "",
      category: styleData.category || "",
      colors: Array.from(colorMap.values()),
      cached: true,
      last_synced: styleData.last_synced,
    };
  } catch (error) {
    console.error("SSActivewear cache error:", error);
    return null;
  }
}

async function fetchAndCacheSSActivewear(
  supabaseAdmin: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  companyId: string,
  style: string
): Promise<ProductResult | null> {
  try {
    // Fetch product data
    const productUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
    const productResponse = await fetch(productUrl, {
      headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
    });

    if (!productResponse.ok) {
      console.log(`SSActivewear API returned ${productResponse.status}`);
      return null;
    }

    const ssaData = await productResponse.json();

    if (ssaData.success === false || !ssaData.data?.[0]) {
      console.log("SSActivewear: Product not found");
      return null;
    }

    const productData = ssaData.data[0];

    // Cache the style
    const { data: newStyleData } = await supabaseAdmin
      .from("styles")
      .upsert({
        company_id: companyId,
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

    if (!newStyleData) {
      console.error("Failed to cache style");
      return null;
    }

    const styleId = newStyleData.id;

    // Cache parts
    if (productData.parts && Array.isArray(productData.parts)) {
      for (const part of productData.parts) {
        if (!part.partId) continue;

        await supabaseAdmin
          .from("parts")
          .upsert({
            company_id: companyId,
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
    }

    // Fetch and cache pricing via PromoStandards
    try {
      const pricingUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=pricing&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
      const pricingResponse = await fetch(pricingUrl, {
        headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
      });

      if (pricingResponse.ok) {
        const pricingData = await pricingResponse.json();
        console.log('SSA Pricing response:', JSON.stringify(pricingData).substring(0, 500));

        if (pricingData.success && pricingData.data?.parts) {
          for (const part of pricingData.data.parts) {
            if (!part.partId || !part.prices || part.prices.length === 0) continue;

            const firstPrice = part.prices[0];
            await supabaseAdmin
              .from("ss_catalog_pricing")
              .upsert({
                company_id: companyId,
                part_number: part.partId,
                unit_price: firstPrice.price,
                quantity_min: firstPrice.minQuantity || 1,
                quantity_max: part.prices[1]?.minQuantity ? part.prices[1].minQuantity - 1 : 99999,
                discount_code: firstPrice.discountCode || null,
                price_expiry_date: null,
              }, {
                onConflict: "company_id,part_number,quantity_min"
              });
          }
          console.log(`Cached pricing for ${pricingData.data.parts.length} parts`);
        }
      }
    } catch (pricingError: any) {
      console.warn('Failed to fetch/cache SSA pricing:', pricingError.message);
    }

    // Fetch and cache media (images)
    const mediaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=media&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
    const mediaResponse = await fetch(mediaUrl, {
      headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
    });

    if (mediaResponse.ok) {
      const mediaData = await mediaResponse.json();
      const mediaContent = mediaData.data?.mediaContent || [];

      for (const media of mediaContent) {
        if (!media.url) continue;

        const { data: partForImage } = await supabaseAdmin
          .from("parts")
          .select("id")
          .eq("company_id", companyId)
          .eq("style_id", styleId)
          .eq("part_id", media.partId || productData.parts?.[0]?.partId)
          .maybeSingle();

        if (partForImage) {
          await supabaseAdmin
            .from("images")
            .upsert({
              company_id: companyId,
              part_id: partForImage.id,
              class_type: media.classTypeName || null,
              url: media.url,
            }, {
              onConflict: "company_id,part_id,class_type"
            });
        }
      }
    }

    // Now return the cached data
    return await searchSSActivewearCache(supabaseAdmin, companyId, style);
  } catch (error: any) {
    console.error("Error fetching/caching SSActivewear:", error);
    return null;
  }
}

async function searchSanMarCache(
  supabaseAdmin: any,
  companyId: string,
  style: string
): Promise<ProductResult | null> {
  try {
    const { data: styleData } = await supabaseAdmin
      .from("sanmar_catalog_styles")
      .select("id, style_number, style_name, brand_name, category, updated_at")
      .eq("company_id", companyId)
      .ilike("style_number", style)
      .eq("is_active", true)
      .maybeSingle();

    if (!styleData) return null;

    const { data: productsData } = await supabaseAdmin
      .from("sanmar_catalog_products")
      .select("sku, color_name, color_code, size_name, image_front")
      .eq("style_id", styleData.id)
      .order("color_name", { ascending: true });

    if (!productsData || productsData.length === 0) return null;

    const colorMap = new Map<string, ColorOption>();

    for (const product of productsData) {
      const colorName = product.color_name || "Default";

      if (!colorMap.has(colorName)) {
        colorMap.set(colorName, {
          name: colorName,
          code: product.color_code || "",
          partIds: [],
          sizes: [],
          image_url: product.image_front || "",
          pricing: { wholesale: 0, retail: 0 },
          stock: {},
        });
      }

      const color = colorMap.get(colorName)!;
      if (product.sku && !color.partIds?.includes(product.sku)) {
        color.partIds?.push(product.sku);
      }
      if (product.size_name && !color.sizes?.includes(product.size_name)) {
        color.sizes?.push(product.size_name);
      }
    }

    return {
      supplier: "sanmar",
      style: styleData.style_number,
      brand: styleData.brand_name || "",
      description: styleData.style_name || "",
      category: styleData.category || "",
      colors: Array.from(colorMap.values()),
      cached: true,
      last_synced: styleData.updated_at,
    };
  } catch (error) {
    console.error("SanMar cache error:", error);
    return null;
  }
}
