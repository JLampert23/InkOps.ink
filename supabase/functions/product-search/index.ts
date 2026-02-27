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

function normalizeSsProductId(input: string): string {
  if (!input) return '';
  let cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.startsWith('B') && cleaned.length > 1) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('G') && /^G\d+$/.test(cleaned)) {
    cleaned = cleaned.substring(1);
  }
  if (/^\d+$/.test(cleaned)) {
    cleaned = cleaned.padStart(5, '0');
  }
  return 'B' + cleaned;
}

interface ColorOption {
  name: string;
  code: string;
  partIds?: string[];
  image_url?: string;
  rear_image_url?: string;
  side_image_url?: string;
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
    const normalizedStyle = normalizeSsProductId(style);
    console.log(`[SSA Cache] Searching for raw="${style}" or normalized="${normalizedStyle}"`);

    let styleData = null;

    const { data: exactMatch } = await supabaseAdmin
      .from("styles")
      .select("id, style_number, brand, name, description, category, last_synced")
      .eq("company_id", companyId)
      .ilike("style_number", style)
      .maybeSingle();

    if (exactMatch) {
      styleData = exactMatch;
    } else {
      const { data: normalizedMatch } = await supabaseAdmin
        .from("styles")
        .select("id, style_number, brand, name, description, category, last_synced")
        .eq("company_id", companyId)
        .ilike("style_number", normalizedStyle)
        .maybeSingle();

      styleData = normalizedMatch;
    }

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
          const { data: imagesData } = await supabaseAdmin
            .from("images")
            .select("url, class_type")
            .eq("part_id", firstPart.id);

          if (imagesData && imagesData.length > 0) {
            for (const img of imagesData) {
              const classType = (img.class_type || "").toLowerCase();
              if (classType.includes("front") || !color.image_url) {
                color.image_url = img.url;
              }
              if (classType.includes("rear") || classType.includes("back")) {
                color.rear_image_url = img.url;
              }
              if (classType.includes("side") || classType.includes("sleeve")) {
                color.side_image_url = img.url;
              }
            }
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
    console.log(`🔍 SSA: Fetching product data for ${style}`);

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
    console.log(`🔍 SSA API response:`, JSON.stringify(ssaData).substring(0, 500));

    if (ssaData.success === false || !ssaData.data?.[0]) {
      console.log("SSActivewear: Product not found or error:", ssaData.error || "no data");
      return null;
    }

    const productData = ssaData.data[0];
    const normalizedStyle = productData.productId || style;
    console.log(`🔍 SSA: Found product: ${productData.productName}, ${productData.parts?.length || 0} parts, normalized style: ${normalizedStyle}`);

    // Cache the style using both raw input and normalized form for lookup
    const { data: newStyleData } = await supabaseAdmin
      .from("styles")
      .upsert({
        company_id: companyId,
        style_number: normalizedStyle,
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

    // Fetch and cache media (images) - try PromoStandards first, then REST API fallback
    let mediaContent: any[] = [];

    const mediaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=media&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
    const mediaResponse = await fetch(mediaUrl, {
      headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
    });

    if (mediaResponse.ok) {
      const mediaData = await mediaResponse.json();
      mediaContent = mediaData.data?.mediaContent || [];
      console.log(`PromoStandards media returned ${mediaContent.length} images`);
    }

    // If PromoStandards returned no images, try REST API fallback
    if (mediaContent.length === 0) {
      console.log('PromoStandards media empty, trying REST API fallback...');
      try {
        const { data: settings } = await supabaseAdmin
          .from("company_settings")
          .select("ssactivewear_username, ssactivewear_api_key_encrypted")
          .eq("id", companyId)
          .maybeSingle();

        if (settings?.ssactivewear_username && settings?.ssactivewear_api_key_encrypted) {
          // Decrypt the API key
          const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              action: "decrypt",
              token: settings.ssactivewear_api_key_encrypted,
            }),
          });

          if (decryptResponse.ok) {
            const decryptResult = await decryptResponse.json();
            const decryptedApiKey = decryptResult.result;

            const ssaRestApiUrl = `https://api.ssactivewear.com/v2/products/?style=${encodeURIComponent(style)}`;
            const restApiResponse = await fetch(ssaRestApiUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${btoa(`${settings.ssactivewear_username}:${decryptedApiKey}`)}`,
                'Content-Type': 'application/json',
              },
            });

            if (restApiResponse.ok) {
              const restApiData = await restApiResponse.json();
              console.log(`REST API returned ${Array.isArray(restApiData) ? restApiData.length : 0} products`);

              if (Array.isArray(restApiData) && restApiData.length > 0) {
                // Extract images from REST API response
                for (const product of restApiData) {
                  if (product.colorFrontImage) {
                    mediaContent.push({
                      url: product.colorFrontImage,
                      partId: product.sku || product.partID,
                      classTypeName: 'Front',
                      color: product.colorName,
                    });
                  }
                  if (product.colorBackImage) {
                    mediaContent.push({
                      url: product.colorBackImage,
                      partId: product.sku || product.partID,
                      classTypeName: 'Rear',
                      color: product.colorName,
                    });
                  }
                  if (product.colorSideImage) {
                    mediaContent.push({
                      url: product.colorSideImage,
                      partId: product.sku || product.partID,
                      classTypeName: 'Side',
                      color: product.colorName,
                    });
                  }
                  if (product.colorSwatchImage) {
                    mediaContent.push({
                      url: product.colorSwatchImage,
                      partId: product.sku || product.partID,
                      classTypeName: 'Swatch',
                      color: product.colorName,
                    });
                  }
                }
                console.log(`REST API fallback extracted ${mediaContent.length} images`);
              }
            }
          }
        }
      } catch (restApiError: any) {
        console.warn('REST API fallback failed:', restApiError.message);
      }
    }

    // Cache all collected images
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

    console.log(`Cached ${mediaContent.length} images for style ${style}`);

    console.log(`✅ SSA: Cached ${mediaContent.length} images for style ${style}, now fetching from cache`);

    // Now return the cached data
    const cachedResult = await searchSSActivewearCache(supabaseAdmin, companyId, style);

    // If cache doesn't return (timing issue), build result directly from productData
    if (!cachedResult && productData) {
      console.log(`⚠️ SSA: Cache miss after insert, building result from productData`);

      const colorMap = new Map<string, ColorOption>();

      for (const part of (productData.parts || [])) {
        const colorName = part.colorName || "Default";

        if (!colorMap.has(colorName)) {
          colorMap.set(colorName, {
            name: colorName,
            code: part.partId || "",
            partIds: [],
            sizes: [],
            image_url: "",
            pricing: { wholesale: 0, retail: 0 },
            stock: {},
          });
        }

        const color = colorMap.get(colorName)!;
        if (part.partId && !color.partIds?.includes(part.partId)) {
          color.partIds?.push(part.partId);
        }
        if (part.labelSize && !color.sizes?.includes(part.labelSize)) {
          color.sizes?.push(part.labelSize);
        }
      }

      // Apply images from mediaContent
      for (const media of mediaContent) {
        const mediaColor = (media.color || "").toLowerCase();
        for (const [colorName, color] of colorMap) {
          if (colorName.toLowerCase() === mediaColor || mediaColor.includes(colorName.toLowerCase())) {
            const classType = (media.classTypeName || "").toLowerCase();
            if (classType.includes("front") || !color.image_url) {
              color.image_url = media.url;
            }
            if (classType.includes("rear") || classType.includes("back")) {
              color.rear_image_url = media.url;
            }
            if (classType.includes("side")) {
              color.side_image_url = media.url;
            }
          }
        }
      }

      return {
        supplier: "ssactivewear",
        style: style,
        brand: productData.productBrand || "",
        description: productData.productName || productData.description || "",
        category: "",
        colors: Array.from(colorMap.values()),
        cached: false,
        last_synced: new Date().toISOString(),
      };
    }

    return cachedResult;
  } catch (error: any) {
    console.error("Error fetching/caching SSActivewear:", error.message);
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
