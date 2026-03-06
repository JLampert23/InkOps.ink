import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { searchSanMarCatalog } from "./sanmar-provider.ts";
import {
  getSSActivewearImageCache,
  setSSActivewearImageCache,
  buildSSActivewearCdnFallbackUrl,
  logImageOperation,
} from "../_shared/image-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

  let cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

  // If it already has letters (like DG536, PC54, G500, etc.), it's a manufacturer style number
  // These should be passed through as-is (no B prefix needed)
  if (/[A-Z]/.test(cleaned) && !/^B\d+$/.test(cleaned)) {
    // It's a manufacturer style number like DG536, PC54, G500, etc.
    // Remove any leading B if it was incorrectly added previously
    if (cleaned.startsWith('B') && cleaned.length > 1 && /[A-Z]/.test(cleaned.substring(1))) {
      // But only if what follows has letters too (like BDG536 -> DG536)
      // Keep it if it's like B18500 (which is correct)
      const afterB = cleaned.substring(1);
      if (/[A-Z]/.test(afterB)) {
        cleaned = afterB;
      }
    }
    return cleaned;
  }

  // If it starts with B followed by numbers only (B18500), keep it
  if (/^B\d+$/.test(cleaned)) {
    return cleaned;
  }

  // Pure numeric input (like 18500) - these are S&S internal IDs and need B prefix
  if (/^\d+$/.test(cleaned)) {
    cleaned = cleaned.padStart(5, '0');
    return 'B' + cleaned;
  }

  // For anything else, return as-is
  return cleaned;
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
            console.log(`[SSA] Starting search for style: ${style}`);
            const cached = await searchSSActivewearCache(supabaseAdmin, companyId!, style);
            if (cached) {
              console.log(`[SSA] Cache HIT for ${style}`);
              results.push(cached);
            } else {
              console.log(`[SSA] Cache MISS for ${style}, calling live API...`);
              const liveResult = await fetchAndCacheSSActivewear(
                supabaseAdmin, supabaseUrl, supabaseServiceKey, companyId!, style
              );
              if (liveResult.product) {
                console.log(`[SSA] Live API returned result for ${style}`);
                results.push(liveResult.product);
              } else if (liveResult.error) {
                console.log(`[SSA] Live API error for ${style}: ${liveResult.error}`);
                searchErrors.push(liveResult.error);
              } else {
                console.log(`[SSA] Live API returned NO result for ${style}`);
                searchErrors.push(`SSActivewear: No product found for ${style}`);
              }
            }
          } catch (error: any) {
            console.error("[SSA] Search error:", error.message);
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

    // Fetch ALL images for ALL parts of this style at once
    const allPartInternalIds = partsData.map((p: any) => p.id);
    const { data: allImagesData } = await supabaseAdmin
      .from("images")
      .select("url, class_type, color, part_id")
      .in("part_id", allPartInternalIds);

    // Create a lookup: part internal ID -> color name
    const partIdToColorName = new Map<string, string>();
    for (const part of partsData) {
      partIdToColorName.set(part.id, part.color_name || "Default");
    }

    // Group images by color (using the part's color_name as the primary key)
    const imagesByColor = new Map<string, Array<{ url: string; class_type: string; color: string }>>();
    for (const img of (allImagesData || [])) {
      if (!img.url) continue;

      // Determine color: first try the image's color field, then fall back to part's color
      let imgColorKey = img.color;
      if (!imgColorKey && img.part_id) {
        imgColorKey = partIdToColorName.get(img.part_id) || "Default";
      }
      imgColorKey = (imgColorKey || "Default").toLowerCase();

      if (!imagesByColor.has(imgColorKey)) {
        imagesByColor.set(imgColorKey, []);
      }
      imagesByColor.get(imgColorKey)!.push(img);
    }

    console.log(`[SSA Cache] Found ${allImagesData?.length || 0} total images grouped into ${imagesByColor.size} colors`);

    // Assign images to each color - STRICTLY filter by matching color
    for (const [colorName, color] of colorMap) {
      const colorLower = colorName.toLowerCase().trim();

      let matchingImages: Array<{ url: string; class_type: string; color: string }> = [];

      if (imagesByColor.has(colorLower)) {
        matchingImages = imagesByColor.get(colorLower)!;
      } else {
        let bestMatch: { key: string; imgs: Array<{ url: string; class_type: string; color: string }>; score: number } | null = null;

        for (const [imgColor, imgs] of imagesByColor) {
          if (!imgColor || imgColor === 'default') continue;

          if (imgColor === colorLower) {
            bestMatch = { key: imgColor, imgs, score: 100 };
            break;
          }

          const colorWords = colorLower.split(/[\s/]+/);
          const imgWords = imgColor.split(/[\s/]+/);
          const matchingWords = colorWords.filter(w => w.length > 2 && imgWords.includes(w));
          const wordScore = (matchingWords.length * 2) / (colorWords.length + imgWords.length) * 80;

          if (wordScore > 0 && (!bestMatch || wordScore > bestMatch.score)) {
            bestMatch = { key: imgColor, imgs, score: wordScore };
          }
        }

        if (bestMatch && bestMatch.score >= 30) {
          matchingImages = bestMatch.imgs;
          console.log(`[SSA Cache] Fuzzy matched color "${colorName}" -> "${bestMatch.key}" (score: ${bestMatch.score.toFixed(0)})`);
        }
      }

      console.log(`[SSA Cache] Color "${colorName}": found ${matchingImages.length} matching images`);

      if (matchingImages.length > 0) {
        logImageOperation("ssactivewear", style, "cache_hit", { imageCount: matchingImages.length });

        // Assign images by type - prioritize exact class type matches
        let frontImg: string | null = null;
        let rearImg: string | null = null;
        let sideImg: string | null = null;

        for (const img of matchingImages) {
          const classType = (img.class_type || "").toLowerCase();

          if (classType.includes("front") && !frontImg) {
            frontImg = img.url;
          } else if ((classType.includes("rear") || classType.includes("back")) && !rearImg) {
            rearImg = img.url;
          } else if ((classType.includes("side") || classType.includes("sleeve")) && !sideImg) {
            sideImg = img.url;
          }
        }

        // If no front image found, use first available image
        if (!frontImg && matchingImages.length > 0) {
          frontImg = matchingImages[0].url;
        }

        color.image_url = frontImg || "";
        color.rear_image_url = rearImg || undefined;
        color.side_image_url = sideImg || undefined;

        console.log(`[SSA Cache] Color "${colorName}" assigned: front=${!!frontImg}, rear=${!!rearImg}, side=${!!sideImg}`);
      } else {
        // No cached images for this color - use CDN fallback
        logImageOperation("ssactivewear", style, "cdn_fallback", { fallbackUsed: true });
        const firstPartId = color.partIds?.[0];
        if (firstPartId) {
          const fallbackUrls = buildSSActivewearCdnFallbackUrl(styleData.style_number, firstPartId);
          if (fallbackUrls.length > 0) {
            color.image_url = fallbackUrls[0];
          }
        }
      }

      // Get pricing from cache
      const firstPartId = color.partIds?.[0];
      if (firstPartId) {
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

interface SSAFetchResult {
  product: ProductResult | null;
  error: string | null;
}

async function fetchAndCacheSSActivewear(
  supabaseAdmin: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  companyId: string,
  style: string
): Promise<SSAFetchResult> {
  try {
    console.log(`🔍 SSA: Fetching product data for ${style}`);

    const productUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
    console.log(`[SSA] Calling: ${productUrl}`);

    const productResponse = await fetch(productUrl, {
      headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
    });

    if (!productResponse.ok) {
      const errorText = await productResponse.text();
      console.log(`[SSA] API returned HTTP ${productResponse.status}: ${errorText.substring(0, 500)}`);
      return { product: null, error: `SSActivewear API returned HTTP ${productResponse.status}` };
    }

    const ssaData = await productResponse.json();
    console.log(`[SSA] API response:`, JSON.stringify(ssaData).substring(0, 800));

    if (ssaData.success === false || !ssaData.data?.[0]) {
      const errorMsg = ssaData.errorDetails || ssaData.error || 'Product not found';
      console.log(`[SSA] Product not found - error: ${ssaData.error || 'no data'}, errorDetails: ${ssaData.errorDetails || 'none'}`);
      return { product: null, error: `SSActivewear: ${errorMsg} (style: ${style})` };
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
      return { product: null, error: "Failed to cache style in database" };
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
    let cachedPricingMap: Map<string, number> | null = null;
    try {
      const pricingUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=pricing&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
      const pricingResponse = await fetch(pricingUrl, {
        headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
      });

      if (pricingResponse.ok) {
        const pricingData = await pricingResponse.json();
        console.log('SSA Pricing response:', JSON.stringify(pricingData).substring(0, 500));

        const parts = pricingData.success
          ? (Array.isArray(pricingData.data) ? pricingData.data : pricingData.data?.parts || [])
          : [];

        for (const part of parts) {
          if (!part.partId || !part.prices || part.prices.length === 0) continue;

          const firstPrice = part.prices[0];
          const minQty = firstPrice.minQuantity ?? firstPrice.quantity ?? 1;
          const secondPrice = part.prices[1];
          const nextMinQty = secondPrice?.minQuantity ?? secondPrice?.quantity ?? null;

          await supabaseAdmin
            .from("ss_catalog_pricing")
            .upsert({
              company_id: companyId,
              part_number: part.partId,
              unit_price: firstPrice.price,
              quantity_min: minQty,
              quantity_max: nextMinQty ? nextMinQty - 1 : 99999,
              discount_code: firstPrice.discountCode || null,
              price_expiry_date: null,
            }, {
              onConflict: "company_id,part_number,quantity_min"
            });

          if (!cachedPricingMap) cachedPricingMap = new Map();
          cachedPricingMap.set(part.partId, firstPrice.price);
        }
        if (parts.length > 0) {
          console.log(`Cached pricing for ${parts.length} parts`);
        }
      }
    } catch (pricingError: any) {
      console.warn('Failed to fetch/cache SSA pricing:', pricingError.message);
    }

    // Fetch and cache media (images) - check cache first, then PromoStandards, then REST API fallback
    let mediaContent: any[] = [];
    let imageCacheHit = false;
    let usedCdnFallback = false;

    // Step 1: Check image cache first
    const cachedImages = await getSSActivewearImageCache(supabaseAdmin, companyId, style);
    if (cachedImages && cachedImages.urls) {
      logImageOperation("ssactivewear", style, "cache_hit", {
        imageCount: (cachedImages.urls.frontImages?.length || 0) +
                   (cachedImages.urls.rearImages?.length || 0)
      });
      imageCacheHit = true;
      // Convert cached URLs to mediaContent format
      for (const url of cachedImages.urls.frontImages || []) {
        mediaContent.push({ url, partId: '', classTypeName: 'Front', color: '' });
      }
      for (const url of cachedImages.urls.rearImages || []) {
        mediaContent.push({ url, partId: '', classTypeName: 'Rear', color: '' });
      }
      for (const url of cachedImages.urls.sideImages || []) {
        mediaContent.push({ url, partId: '', classTypeName: 'Side', color: '' });
      }
    }

    // Step 2: If no cache, fetch from PromoStandards API
    if (!imageCacheHit) {
      logImageOperation("ssactivewear", style, "cache_miss", {});

      const mediaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=media&productId=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
      logImageOperation("ssactivewear", style, "api_fetch", { endpoint: "ssactivewear-api/media" });

      const mediaResponse = await fetch(mediaUrl, {
        headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
      });

      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        mediaContent = mediaData.data?.mediaContent || [];
        if (mediaContent.length > 0) {
          logImageOperation("ssactivewear", style, "api_fetch", { imageCount: mediaContent.length });
        }
      }

      // Step 3: If PromoStandards returned no images, try REST API fallback
      if (mediaContent.length === 0) {
        console.log('PromoStandards media empty, trying REST API fallback...');
        try {
          const { data: settings } = await supabaseAdmin
            .from("company_settings")
            .select("ssactivewear_username, ssactivewear_api_key_encrypted")
            .eq("id", companyId)
            .maybeSingle();

          if (settings?.ssactivewear_username && settings?.ssactivewear_api_key_encrypted) {
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
                  logImageOperation("ssactivewear", style, "api_fetch", { imageCount: mediaContent.length, endpoint: "REST API fallback" });
                }
              }
            }
          }
        } catch (restApiError: any) {
          console.warn('REST API fallback failed:', restApiError.message);
        }
      }

      // Step 4: If still no images, use CDN fallback
      if (mediaContent.length === 0) {
        logImageOperation("ssactivewear", style, "cdn_fallback", { fallbackUsed: true });
        usedCdnFallback = true;
        const fallbackUrls = buildSSActivewearCdnFallbackUrl(normalizedStyle);
        for (const url of fallbackUrls) {
          mediaContent.push({
            url,
            partId: '',
            classTypeName: url.includes('_f_') ? 'Front' : 'Other',
            color: '',
          });
        }
      }
    }

    // Cache all collected images - only if we have valid images and didn't use cache
    // Images are per-color, so cache them for ALL parts of the same color
    if (!imageCacheHit && mediaContent.length > 0) {
      let cachedCount = 0;

      // Log image type breakdown before caching
      const typeBreakdown = { Front: 0, Rear: 0, Side: 0, Swatch: 0, Other: 0 };
      for (const media of mediaContent) {
        const classType = (media.classTypeName || "").toLowerCase();
        if (classType.includes("front")) typeBreakdown.Front++;
        else if (classType.includes("rear") || classType.includes("back")) typeBreakdown.Rear++;
        else if (classType.includes("side")) typeBreakdown.Side++;
        else if (classType.includes("swatch")) typeBreakdown.Swatch++;
        else typeBreakdown.Other++;
      }
      console.log(`[SSA Cache] Image types to cache: Front=${typeBreakdown.Front}, Rear=${typeBreakdown.Rear}, Side=${typeBreakdown.Side}, Swatch=${typeBreakdown.Swatch}, Other=${typeBreakdown.Other}`);

      // Group images by color
      const imagesByColor = new Map<string, typeof mediaContent>();
      for (const media of mediaContent) {
        if (!media.url) continue;
        const colorKey = (media.color || 'default').toLowerCase();
        if (!imagesByColor.has(colorKey)) {
          imagesByColor.set(colorKey, []);
        }
        imagesByColor.get(colorKey)!.push(media);
      }

      console.log(`[SSA Cache] Grouped ${mediaContent.length} images into ${imagesByColor.size} color groups`);

      // Get all parts for this style
      const { data: allParts } = await supabaseAdmin
        .from("parts")
        .select("id, part_id, color_name")
        .eq("company_id", companyId)
        .eq("style_id", styleId);

      if (allParts && allParts.length > 0) {
        // Create lookup maps for matching
        // Map: external part_id (S&S SKU) -> internal part record
        const partByExternalId = new Map<string, any>();
        // Map: color_name (lowercase) -> array of parts
        const partsByColor = new Map<string, typeof allParts>();

        for (const part of allParts) {
          // Index by external part_id
          if (part.part_id) {
            partByExternalId.set(part.part_id.toUpperCase(), part);
          }
          // Index by color name
          const colorKey = (part.color_name || 'default').toLowerCase();
          if (!partsByColor.has(colorKey)) {
            partsByColor.set(colorKey, []);
          }
          partsByColor.get(colorKey)!.push(part);
        }

        console.log(`[SSA Cache] Parts: ${allParts.length} total, ${partsByColor.size} color groups, ${partByExternalId.size} external IDs`);

        // Cache each image - try to match by partId first, then by color
        for (const media of mediaContent) {
          if (!media.url) continue;

          let targetPart: any = null;

          // PRIORITY 1: Match by external partId (most accurate)
          if (media.partId) {
            targetPart = partByExternalId.get(media.partId.toUpperCase());
            if (targetPart) {
              console.log(`[SSA Cache] Matched image by partId: ${media.partId} -> part ${targetPart.part_id}`);
            }
          }

          // PRIORITY 2: Match by color name
          if (!targetPart && media.color) {
            const colorLower = media.color.toLowerCase();
            let matchingParts = partsByColor.get(colorLower);

            if (!matchingParts || matchingParts.length === 0) {
              let bestScore = 0;
              const mediaWords = colorLower.split(/[\s/]+/);
              for (const [partColor, parts] of partsByColor) {
                if (!partColor || partColor === 'default') continue;
                const partWords = partColor.split(/[\s/]+/);
                const matching = mediaWords.filter(w => w.length > 2 && partWords.includes(w));
                const score = (matching.length * 2) / (mediaWords.length + partWords.length);
                if (score > bestScore && score >= 0.3) {
                  bestScore = score;
                  matchingParts = parts;
                }
              }
            }

            if (matchingParts && matchingParts.length > 0) {
              targetPart = matchingParts[0];
              console.log(`[SSA Cache] Matched image by color: "${media.color}" -> part ${targetPart.part_id}`);
            }
          }

          // FALLBACK: Use first part if no match found
          if (!targetPart) {
            targetPart = allParts[0];
            console.log(`[SSA Cache] No match for image, using fallback part: ${targetPart.part_id}`);
          }

          // Determine the color to store - prefer part's color_name for consistency
          const colorToStore = targetPart.color_name || media.color || null;

          // Check if image already exists
          const { data: existingImage } = await supabaseAdmin
            .from("images")
            .select("id")
            .eq("company_id", companyId)
            .eq("part_id", targetPart.id)
            .eq("url", media.url)
            .maybeSingle();

          if (existingImage) {
            await supabaseAdmin
              .from("images")
              .update({
                class_type: media.classTypeName || null,
                color: colorToStore,
              })
              .eq("id", existingImage.id);
            cachedCount++;
          } else {
            const { error: insertError } = await supabaseAdmin
              .from("images")
              .insert({
                company_id: companyId,
                part_id: targetPart.id,
                class_type: media.classTypeName || null,
                url: media.url,
                color: colorToStore,
              });

            if (!insertError) {
              cachedCount++;
            } else {
              console.warn(`Failed to cache image ${media.url}: ${insertError.message}`);
            }
          }
        }

        // Log final cache breakdown by image type
        const finalBreakdown = { Front: 0, Rear: 0, Side: 0, Other: 0 };
        for (const media of mediaContent) {
          const ct = (media.classTypeName || "").toLowerCase();
          if (ct.includes("front")) finalBreakdown.Front++;
          else if (ct.includes("rear") || ct.includes("back")) finalBreakdown.Rear++;
          else if (ct.includes("side")) finalBreakdown.Side++;
          else finalBreakdown.Other++;
        }
        console.log(`[SSA Cache] Final cached: Front=${finalBreakdown.Front}, Rear=${finalBreakdown.Rear}, Side=${finalBreakdown.Side}, Other=${finalBreakdown.Other}`);
      }

      if (cachedCount > 0) {
        logImageOperation("ssactivewear", style, "cache_write", { imageCount: cachedCount });
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
          const wholesalePrice = cachedPricingMap?.get(part.partId) ?? 0;
          colorMap.set(colorName, {
            name: colorName,
            code: part.partId || "",
            partIds: [],
            sizes: [],
            image_url: "",
            pricing: { wholesale: wholesalePrice, retail: wholesalePrice },
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

      // Apply images from mediaContent - FILTER by color to avoid mixed-color images
      // Group mediaContent by color first
      const mediaByColor = new Map<string, typeof mediaContent>();
      for (const media of mediaContent) {
        const mediaColorKey = (media.color || "default").toLowerCase();
        if (!mediaByColor.has(mediaColorKey)) {
          mediaByColor.set(mediaColorKey, []);
        }
        mediaByColor.get(mediaColorKey)!.push(media);
      }

      for (const [colorName, color] of colorMap) {
        const colorLower = colorName.toLowerCase().trim();

        let matchingMedia: typeof mediaContent = [];

        if (mediaByColor.has(colorLower)) {
          matchingMedia = mediaByColor.get(colorLower)!;
        } else {
          let bestMatch: { key: string; media: typeof mediaContent; score: number } | null = null;
          const colorWords = colorLower.split(/[\s/]+/);

          for (const [mediaColor, mediaList] of mediaByColor) {
            if (!mediaColor || mediaColor === 'default') continue;
            const mediaWords = mediaColor.split(/[\s/]+/);
            const matching = colorWords.filter(w => w.length > 2 && mediaWords.includes(w));
            const score = (matching.length * 2) / (colorWords.length + mediaWords.length);
            if (score > 0 && (!bestMatch || score > bestMatch.score) && score >= 0.3) {
              bestMatch = { key: mediaColor, media: mediaList, score };
            }
          }

          if (bestMatch) {
            matchingMedia = bestMatch.media;
          }
        }

        // Apply only the matching images for this color
        for (const media of matchingMedia) {
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

        // Log if no images found for this color
        if (!color.image_url && matchingMedia.length === 0) {
          console.log(`[SSA] No matching images found for color "${colorName}"`);
        }
      }

      return {
        product: {
          supplier: "ssactivewear",
          style: style,
          brand: productData.productBrand || "",
          description: productData.productName || productData.description || "",
          category: "",
          colors: Array.from(colorMap.values()),
          cached: false,
          last_synced: new Date().toISOString(),
        },
        error: null
      };
    }

    return { product: cachedResult, error: null };
  } catch (error: any) {
    console.error("Error fetching/caching SSActivewear:", error.message);
    return { product: null, error: `SSActivewear error: ${error.message}` };
  }
}

