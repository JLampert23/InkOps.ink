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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = req.headers.get("Authorization");
    let companyId: string | null = null;

    if (authHeader) {
      try {
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false }
        });

        const { data: { user } } = await supabaseClient.auth.getUser();

        if (user) {
          const { data: profileData } = await supabaseAdmin
            .from("user_profiles")
            .select("company_id")
            .eq("id", user.id)
            .maybeSingle();

          companyId = profileData?.company_id || null;
        }
      } catch {
        // Continue without auth
      }
    }

    if (!companyId) {
      const url = new URL(req.url);
      const companyIdParam = url.searchParams.get("companyId");

      if (companyIdParam) {
        companyId = companyIdParam;
      } else {
        const { data: firstCompany } = await supabaseAdmin
          .from("company_settings")
          .select("id")
          .limit(1)
          .maybeSingle();

        companyId = firstCompany?.id || null;
      }
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "No company found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const rawStyle = url.searchParams.get("style");

    if (!rawStyle) {
      return new Response(
        JSON.stringify({ error: "Style number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const style = rawStyle.trim();
    const results: ProductResult[] = [];

    const { data: settings } = await supabaseAdmin
      .from("company_settings")
      .select("sanmar_enabled, ssactivewear_enabled")
      .eq("id", companyId)
      .maybeSingle();

    console.log(`🔍 Searching for style: ${style}`);

    // Run both searches in parallel with timeout
    const searchPromises: Promise<void>[] = [];

    // 1. SSActivewear search
    if (settings?.ssactivewear_enabled) {
      searchPromises.push(
        (async () => {
          try {
            console.log("📦 Checking SSActivewear cache...");
            const ssaCached = await withTimeout(
              searchSSActivewearCache(supabaseAdmin, companyId, style),
              5000,
              "SSActivewear cache timeout"
            );

            if (ssaCached) {
              console.log("✅ Found in SSActivewear cache");
              results.push(ssaCached);
            } else {
              console.log("❌ Not in SSActivewear cache, fetching from API...");
              const ssaLive = await withTimeout(
                fetchAndCacheSSActivewear(
                  supabaseAdmin,
                  supabaseUrl,
                  supabaseServiceKey,
                  companyId,
                  style
                ),
                15000,
                "SSActivewear API timeout"
              );

              if (ssaLive) {
                console.log("✅ Found and cached SSActivewear product");
                results.push(ssaLive);
              }
            }
          } catch (error: any) {
            console.error("SSActivewear search failed:", error.message);
          }
        })()
      );
    }

    // 2. SanMar search
    if (settings?.sanmar_enabled) {
      searchPromises.push(
        (async () => {
          try {
            console.log("📦 Checking SanMar cache...");
            const sanmarCached = await withTimeout(
              searchSanMarCache(supabaseAdmin, companyId, style),
              5000,
              "SanMar cache timeout"
            );

            if (sanmarCached) {
              console.log("✅ Found in SanMar cache");
              results.push(sanmarCached);
            } else {
              console.log("❌ Not in SanMar cache, fetching from API...");
              const sanmarResult = await withTimeout(
                searchSanMarCatalog(
                  supabaseAdmin,
                  supabaseUrl,
                  supabaseServiceKey,
                  companyId,
                  style
                ),
                15000,
                "SanMar API timeout"
              );

              if (sanmarResult.results.length > 0) {
                console.log("✅ Found and cached SanMar product");
                results.push(...sanmarResult.results);
              }
            }
          } catch (error: any) {
            console.error("SanMar search failed:", error.message);
          }
        })()
      );
    }

    // Wait for all searches to complete (max 20 seconds total)
    await Promise.race([
      Promise.allSettled(searchPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Global search timeout")), 20000))
    ]).catch(err => {
      console.error("Search timeout:", err);
    });

    console.log(`🏁 Search complete: found ${results.length} result(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        style,
        results,
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

    // Get images for first part of each color
    for (const [_, color] of colorMap) {
      if (color.partIds && color.partIds.length > 0) {
        const firstPart = partsData.find(p => p.part_id === color.partIds![0]);
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
