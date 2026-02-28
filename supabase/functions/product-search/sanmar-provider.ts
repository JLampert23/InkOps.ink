import {
  getSanMarImageCache,
  setSanMarImageCache,
  buildSanMarCdnFallbackUrl,
  logImageOperation,
} from "../_shared/image-cache.ts";

export interface ColorOption {
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

export interface ProductResult {
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

export async function searchSanMarCatalog(
  supabaseAdmin: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  companyId: string,
  style: string
): Promise<{
  results: ProductResult[];
  errors: string[];
}> {
  const results: ProductResult[] = [];
  const errors: string[] = [];

  try {
    console.log(`[SanMar] ========== SEARCH START ==========`);
    console.log(`[SanMar] Style: ${style}, Company: ${companyId}`);

    const cachedData = await getCachedProduct(supabaseAdmin, companyId, style);
    if (cachedData) {
      console.log(`[SanMar] CACHE HIT for ${style}`);
      results.push(cachedData);
      return { results, errors };
    }

    console.log(`[SanMar] CACHE MISS - calling sanmar-api edge function for ${style}`);

    const apiUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=product&style=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
    console.log(`[SanMar] API URL: ${apiUrl}`);

    let productResponse;
    let productData;

    try {
      console.log(`[SanMar] Calling sanmar-api...`);
      productResponse = await fetch(apiUrl, {
        headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
      });

      const responseText = await productResponse.text();
      console.log(`[SanMar] API response status: ${productResponse.status}, body length: ${responseText.length}`);
      console.log(`[SanMar] API response preview: ${responseText.substring(0, 500)}`);

      if (!productResponse.ok) {
        console.log(`[SanMar] ERROR: returned ${productResponse.status} for ${style}`);
        console.log(`[SanMar] ERROR body: ${responseText.substring(0, 1000)}`);
        if (productResponse.status === 401 || productResponse.status === 403) {
          errors.push(`SanMar authentication error`);
        } else if (productResponse.status === 500) {
          errors.push(`SanMar API error: ${productResponse.status}`);
        } else {
          errors.push(`SanMar HTTP ${productResponse.status}`);
        }
        return { results, errors };
      }

      try {
        productData = JSON.parse(responseText);
      } catch (parseErr) {
        console.error(`Failed to parse SanMar response as JSON:`, responseText.substring(0, 500));
        errors.push(`SanMar API returned invalid JSON`);
        return { results, errors };
      }
    } catch (fetchErr: any) {
      console.error(`SanMar API fetch failed:`, fetchErr.message);
      errors.push(`SanMar API fetch failed: ${fetchErr.message}`);
      return { results, errors };
    }

    // Check for error response from API
    if (productData.success === false || productData.error) {
      console.log(`[SanMar] API returned error for ${style}: ${productData.error || productData.message || 'unknown'}`);
      console.log(`[SanMar] Full error response: ${JSON.stringify(productData)}`);
      if (productData.error) {
        errors.push(`SanMar: ${productData.error}`);
      }
      return { results, errors };
    }

    if (!productData?.data?.parts || productData.data.parts.length === 0) {
      console.log(`[SanMar] No parts found for ${style} - productData.data: ${JSON.stringify(productData.data || {}).substring(0, 500)}`);
      errors.push(`SanMar: No product data for ${style}`);
      return { results, errors };
    }

    console.log(`[SanMar] SUCCESS: Found ${productData.data.parts.length} parts for ${style}`);

    let mediaData = null;
    let pricingData = null;
    let imageCacheHit = false;
    let usedCdnFallback = false;

    // Step 1: Check image cache first
    const cachedImages = await getSanMarImageCache(supabaseAdmin, companyId, style);
    if (cachedImages && cachedImages.urls) {
      logImageOperation("sanmar", style, "cache_hit", {
        imageCount: (cachedImages.urls.frontImages?.length || 0) +
                   (cachedImages.urls.rearImages?.length || 0) +
                   (cachedImages.urls.sideImages?.length || 0)
      });
      imageCacheHit = true;
      mediaData = {
        images: [],
        views: cachedImages.urls,
      };
    }

    // Step 2: If no cache, fetch from vendor API
    if (!imageCacheHit) {
      logImageOperation("sanmar", style, "cache_miss", {});

      try {
        const mediaUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=media&style=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
        logImageOperation("sanmar", style, "api_fetch", { endpoint: "sanmar-api/media" });

        const mediaResponse = await fetch(mediaUrl, {
          headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
        });
        if (mediaResponse.ok) {
          const mediaJson = await mediaResponse.json();
          mediaData = mediaJson.data || null;

          if (mediaData?.images?.length > 0) {
            logImageOperation("sanmar", style, "api_fetch", { imageCount: mediaData.images.length });
          }
        }
      } catch (mediaError: any) {
        console.warn(`Media fetch failed (non-critical): ${mediaError.message}`);
      }

      // Step 3: If API returned no images, use CDN fallback
      if (!mediaData?.images || mediaData.images.length === 0) {
        logImageOperation("sanmar", style, "cdn_fallback", { fallbackUsed: true });
        usedCdnFallback = true;

        const fallbackUrls = buildSanMarCdnFallbackUrl(style);
        if (fallbackUrls.length > 0) {
          mediaData = {
            images: fallbackUrls.map(url => ({
              url,
              productId: style,
              partId: "",
              classTypeName: url.includes("_fm") ? "Front" : url.includes("_bm") ? "Back" : "Other",
              color: "",
              singlePart: false,
            })),
            views: {
              front: fallbackUrls[0] || null,
              rear: fallbackUrls.find(u => u.includes("_bm")) || null,
              side: null,
              lifestyle: null,
              frontImages: fallbackUrls.filter(u => u.includes("_fm")),
              rearImages: fallbackUrls.filter(u => u.includes("_bm")),
              sideImages: [],
              lifestyleImages: [],
              otherImages: [],
            },
          };
        }
      }

      // Step 4: Write to cache only if we have valid images
      if (mediaData?.images && mediaData.images.length > 0) {
        await setSanMarImageCache(supabaseAdmin, companyId, style, mediaData);
        logImageOperation("sanmar", style, "cache_write", { imageCount: mediaData.images.length });
      }
    }

    // Fetch pricing for the first part to get wholesale price
    const firstPartId = productData.data.parts?.[0]?.partId;
    if (firstPartId) {
      try {
        const pricingUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=pricing&partId=${encodeURIComponent(firstPartId)}&companyId=${encodeURIComponent(companyId)}`;
        const pricingResponse = await fetch(pricingUrl, {
          headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
        });
        if (pricingResponse.ok) {
          const pricingJson = await pricingResponse.json();
          pricingData = pricingJson.data || null;
          console.log(`Fetched pricing for part ${firstPartId}:`, pricingData?.parts?.[0]?.prices?.[0]?.price);
        }
      } catch (pricingError: any) {
        console.warn(`Pricing fetch failed (non-critical): ${pricingError.message}`);
      }
    }

    const apiDataForTransform = {
      success: true,
      styleNumber: style,
      partId: null,
      style: productData.data,
      inventory: { items: [] },
      pricing: pricingData || { parts: [] },
      media: mediaData || {
        images: [],
        views: {
          front: null, rear: null, side: null, lifestyle: null,
          frontImages: [], rearImages: [], sideImages: [],
          lifestyleImages: [], otherImages: [],
        }
      },
    };

    const product = transformSanMarData(apiDataForTransform);
    if (productData.data?._debug) {
      product.raw_data = { _debug: productData.data._debug };
    }
    results.push(product);

    await cacheProduct(supabaseAdmin, companyId, style, productData.data, mediaData);
    console.log(`Found ${product.colors.length} colors from SanMar`);

  } catch (error: any) {
    console.error("SanMar search error:", error);
    errors.push(`SanMar error: ${error.message}`);
  }

  return { results, errors };
}

async function getCachedProduct(
  supabaseAdmin: any,
  companyId: string,
  style: string
): Promise<ProductResult | null> {
  try {
    const cacheKey = `style:${style.toUpperCase()}`;

    const { data: productCache } = await supabaseAdmin
      .from("sanmar_product_cache")
      .select("data, expires_at")
      .eq("company_id", companyId)
      .eq("cache_key", cacheKey)
      .eq("cache_type", "style")
      .maybeSingle();

    if (!productCache) return null;

    if (new Date(productCache.expires_at) < new Date()) {
      console.log(`Cache expired for ${style}`);
      return null;
    }

    // Check image cache using dedicated utility
    const cachedImages = await getSanMarImageCache(supabaseAdmin, companyId, style);
    let mediaData = null;

    if (cachedImages && cachedImages.urls) {
      logImageOperation("sanmar", style, "cache_hit", {
        imageCount: (cachedImages.urls.frontImages?.length || 0) +
                   (cachedImages.urls.rearImages?.length || 0)
      });
      mediaData = {
        images: [],
        views: cachedImages.urls,
      };
    } else {
      // Fallback to legacy media cache table
      const { data: legacyMediaCache } = await supabaseAdmin
        .from("sanmar_media_cache")
        .select("data, expires_at")
        .eq("company_id", companyId)
        .eq("cache_key", cacheKey)
        .eq("cache_type", "style")
        .maybeSingle();

      mediaData = legacyMediaCache?.data || null;

      // If still no images, try CDN fallback
      if (!mediaData?.images || mediaData.images.length === 0) {
        logImageOperation("sanmar", style, "cdn_fallback", { fallbackUsed: true });
        const fallbackUrls = buildSanMarCdnFallbackUrl(style);
        if (fallbackUrls.length > 0) {
          mediaData = {
            images: fallbackUrls.map(url => ({
              url,
              productId: style,
              partId: "",
              classTypeName: url.includes("_fm") ? "Front" : "Other",
              color: "",
              singlePart: false,
            })),
            views: {
              front: fallbackUrls[0] || null,
              rear: null,
              side: null,
              lifestyle: null,
              frontImages: fallbackUrls,
              rearImages: [],
              sideImages: [],
              lifestyleImages: [],
              otherImages: [],
            },
          };
        }
      }
    }

    const productData = productCache.data;

    const apiData = {
      success: true,
      styleNumber: style,
      partId: null,
      style: productData,
      inventory: { items: [] },
      pricing: { parts: [] },
      media: mediaData || {
        images: [],
        views: {
          front: null, rear: null, side: null, lifestyle: null,
          frontImages: [], rearImages: [], sideImages: [],
          lifestyleImages: [], otherImages: [],
        }
      },
    };

    const product = transformSanMarData(apiData);
    product.cached = true;
    product.last_synced = productCache.expires_at;
    return product;
  } catch (error) {
    console.error("Error getting cached product:", error);
    return null;
  }
}

async function cacheProduct(
  supabaseAdmin: any,
  companyId: string,
  style: string,
  productData: any,
  mediaData: any
): Promise<void> {
  try {
    const cacheKey = `style:${style.toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await supabaseAdmin
      .from("sanmar_product_cache")
      .upsert({
        company_id: companyId,
        cache_key: cacheKey,
        cache_type: "style",
        data: productData,
        expires_at: expiresAt.toISOString(),
      }, { onConflict: "company_id,cache_key" });

    if (mediaData) {
      await supabaseAdmin
        .from("sanmar_media_cache")
        .upsert({
          company_id: companyId,
          cache_key: cacheKey,
          cache_type: "style",
          data: mediaData,
          expires_at: expiresAt.toISOString(),
        }, { onConflict: "company_id,cache_key" });
    }

    console.log(`Cached product data for ${style}`);
  } catch (error) {
    console.error("Error caching product:", error);
  }
}

function transformSanMarData(apiData: any): ProductResult {
  const style = apiData.style;
  const colors: ColorOption[] = [];

  const mediaImages = apiData.media?.images || [];
  console.log(`🖼️ SanMar transform: ${mediaImages.length} media images available`);
  if (mediaImages.length > 0) {
    console.log(`🖼️ Sample media image:`, JSON.stringify(mediaImages[0]));
  }

  if (style.colors && Array.isArray(style.colors)) {
    for (const color of style.colors) {
      const partIds = (color.partIds || []).map((p: any) => p.partId);
      const sizes = (color.partIds || []).map((p: any) => p.size).filter(Boolean);

      let pricing = { wholesale: 0, retail: 0 };
      if (apiData.pricing?.parts) {
        const firstPartId = partIds[0];
        const partPricing = apiData.pricing.parts.find((p: any) => p.partId === firstPartId);
        if (partPricing?.prices && partPricing.prices.length > 0) {
          pricing.wholesale = partPricing.prices[0].price || 0;
          pricing.retail = partPricing.prices[0].price || 0;
        }
      }

      const stock: Record<string, number> = {};
      if (apiData.inventory?.items) {
        for (const inv of apiData.inventory.items) {
          if (partIds.includes(inv.partId)) {
            stock[inv.partId] = inv.quantityAvailable || 0;
          }
        }
      }

      let imageUrl = "";
      let rearImageUrl = "";
      let sideImageUrl = "";

      const colorName = color.colorName?.toLowerCase() || "";

      const colorImages = mediaImages.filter((img: any) => {
        if (img.partId && partIds.includes(img.partId)) return true;

        const imgColor = (img.color || "").toLowerCase().trim();
        const productColor = colorName.trim();

        if (!imgColor || !productColor) return false;
        if (imgColor === productColor) return true;

        const imgWords = imgColor.split(/[\s/]+/);
        const colorWords = productColor.split(/[\s/]+/);
        const matching = colorWords.filter(w => w.length > 2 && imgWords.includes(w));
        const score = (matching.length * 2) / (colorWords.length + imgWords.length);
        return score >= 0.5;
      });

      if (colorImages.length > 0) {
        const frontImg = colorImages.find((img: any) =>
          (img.classTypeName || "").toLowerCase().includes("front")
        );
        const rearImg = colorImages.find((img: any) => {
          const cls = (img.classTypeName || "").toLowerCase();
          return cls.includes("rear") || cls.includes("back");
        });
        const sideImg = colorImages.find((img: any) => {
          const cls = (img.classTypeName || "").toLowerCase();
          return cls.includes("side") || cls.includes("sleeve");
        });

        imageUrl = frontImg?.url || colorImages[0]?.url || "";
        rearImageUrl = rearImg?.url || "";
        sideImageUrl = sideImg?.url || "";
      }

      // Fallback: use first available front image if no color match
      if (!imageUrl && mediaImages.length > 0) {
        const anyFrontImg = mediaImages.find((img: any) =>
          (img.classTypeName || "").toLowerCase().includes("front")
        );
        imageUrl = anyFrontImg?.url || mediaImages[0]?.url || "";
      }

      // Final fallback to views
      if (!imageUrl) {
        imageUrl =
          apiData.media?.views?.front ||
          apiData.media?.views?.lifestyle ||
          (apiData.media?.views?.frontImages?.[0]) ||
          "";
      }

      colors.push({
        name: color.colorName,
        code: partIds[0] || color.hex || "",
        partIds,
        sizes,
        image_url: imageUrl,
        rear_image_url: rearImageUrl,
        side_image_url: sideImageUrl,
        pricing,
        stock,
      });
    }
  }

  console.log(`🖼️ SanMar transform complete: ${colors.length} colors, first has image: ${!!colors[0]?.image_url}`);

  return {
    supplier: "sanmar",
    style: style.styleNumber,
    brand: style.productBrand || "",
    description: style.productName || style.description || "",
    category: style.productCategory || "",
    colors,
    cached: false,
    raw_data: apiData,
  };
}
