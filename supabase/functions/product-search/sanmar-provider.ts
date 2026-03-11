import {
  getSanMarImageCache,
  setSanMarImageCache,
  logImageOperation,
  proxySanMarUrl,
  buildSanMarCdnFallbackUrl,
} from "../_shared/image-cache.ts";
import {
  resolveSanMarImages,
  sanMarImagesFresh,
  type ResolvedColorImages,
} from "../_shared/sanmar-image-resolver.ts";

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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractColorCode(partId: string, style: string): string {
  if (!partId) return "";
  const escaped = escapeRegExp(style.toUpperCase());
  const stripped = partId.toUpperCase().replace(new RegExp(`^${escaped}-?`), "");
  const dashIdx = stripped.lastIndexOf("-");
  if (dashIdx > 0) {
    return stripped.substring(0, dashIdx);
  }
  return stripped;
}

async function validateSanMarImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InkOps/1.0)",
        Accept: "image/*",
      },
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location") || "";
      const lower = location.toLowerCase();
      if (lower.includes("imagenotavailable") || lower.includes("image404errorhandler") || lower.includes("notavailable")) {
        return false;
      }
    }

    return response.ok;
  } catch {
    return false;
  }
}

async function filterValidImages(
  images: any[]
): Promise<any[]> {
  if (!images || images.length === 0) return [];

  const uniqueUrls = [...new Set(images.map((img: any) => img.url).filter(Boolean))];
  if (uniqueUrls.length === 0) return [];

  const samplesToCheck = uniqueUrls.slice(0, 3);
  const results = await Promise.allSettled(
    samplesToCheck.map(url => validateSanMarImageUrl(url))
  );

  const validUrls = new Set<string>();
  const invalidUrls = new Set<string>();
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value) {
      validUrls.add(samplesToCheck[i]);
    } else {
      invalidUrls.add(samplesToCheck[i]);
    }
  });

  if (validUrls.size === 0) {
    console.log(`[SanMar] All ${samplesToCheck.length} sample URLs failed validation - discarding all images`);
    return [];
  }

  if (invalidUrls.size > 0) {
    console.log(`[SanMar] ${invalidUrls.size}/${samplesToCheck.length} sample URLs invalid, filtering out bad URLs`);
    return images.filter((img: any) => !invalidUrls.has(img.url));
  }

  return images;
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

    const cachedData = await getCachedProduct(supabaseAdmin, companyId, style, supabaseUrl);
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
          const bodyPreview = responseText.substring(0, 300);
          console.error(`[SanMar] Auth failure (${productResponse.status}): ${bodyPreview}`);
          try {
            const errJson = JSON.parse(responseText);
            errors.push(`SanMar: ${errJson.error || errJson.message || 'Authentication failed'}`);
          } catch {
            errors.push(`SanMar authentication error (${productResponse.status})`);
          }
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
        images: cachedImages.rawImages || [],
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

            const validImages = await filterValidImages(mediaData.images);
            if (validImages.length === 0) {
              console.log(`[SanMar] All ${mediaData.images.length} images for ${style} are placeholders - discarding`);
              mediaData = null;
            } else {
              mediaData.images = validImages;
            }
          }
        }
      } catch (mediaError: any) {
        console.warn(`Media fetch failed (non-critical): ${mediaError.message}`);
      }

      if (!mediaData?.images || mediaData.images.length === 0) {
        console.log(`[SanMar] No valid images available for ${style}`);
      }

      // Step 3: Write to cache only if we have validated images
      if (mediaData?.images && mediaData.images.length > 0) {
        await setSanMarImageCache(supabaseAdmin, companyId, style, mediaData);
        logImageOperation("sanmar", style, "cache_write", { imageCount: mediaData.images.length });
      }
    }

    // Fetch pricing for the entire style (queries all 7 SanMar warehouses for best price)
    try {
      const pricingUrl = `${supabaseUrl}/functions/v1/sanmar-api?action=pricing&style=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
      const pricingResponse = await fetch(pricingUrl, {
        headers: { "Authorization": `Bearer ${supabaseServiceKey}` },
      });
      if (pricingResponse.ok) {
        const pricingJson = await pricingResponse.json();
        pricingData = pricingJson.data || null;
        console.log(`Fetched pricing for style ${style}: ${pricingData?.parts?.length || 0} parts with pricing`);
      }
    } catch (pricingError: any) {
      console.warn(`Pricing fetch failed (non-critical): ${pricingError.message}`);
    }

    let cdnImages: ResolvedColorImages = {};
    const hasFreshCdn = await sanMarImagesFresh(supabaseAdmin, style);
    if (hasFreshCdn) {
      cdnImages = await resolveSanMarImages(supabaseAdmin, style);
      console.log(`[SanMar] CDN cache HIT for ${style}: ${Object.keys(cdnImages).length} colors`);
    } else {
      triggerImageIngest(supabaseUrl, supabaseServiceKey, style, companyId);
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

    const product = transformSanMarData(apiDataForTransform, supabaseUrl, cdnImages);
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
  style: string,
  supabaseUrl: string
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
        images: cachedImages.rawImages || [],
        views: cachedImages.urls,
      };
    } else {
      const { data: legacyMediaCache } = await supabaseAdmin
        .from("sanmar_media_cache")
        .select("data, expires_at")
        .eq("company_id", companyId)
        .eq("cache_key", cacheKey)
        .eq("cache_type", "style")
        .maybeSingle();

      if (legacyMediaCache && new Date(legacyMediaCache.expires_at) >= new Date()) {
        mediaData = legacyMediaCache.data || null;
      }

      if (!mediaData?.images || mediaData.images.length === 0) {
        console.log(`[SanMar] No cached images available for ${style}`);
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

    let cdnImages: ResolvedColorImages = {};
    const hasFreshCdn = await sanMarImagesFresh(supabaseAdmin, style);
    if (hasFreshCdn) {
      cdnImages = await resolveSanMarImages(supabaseAdmin, style);
    }

    const product = transformSanMarData(apiData, supabaseUrl, cdnImages);
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

    console.log(`Cached product data for ${style}`);
  } catch (error) {
    console.error("Error caching product:", error);
  }
}

function triggerImageIngest(
  supabaseUrl: string,
  supabaseServiceKey: string,
  style: string,
  companyId: string
): void {
  const ingestUrl = `${supabaseUrl}/functions/v1/sanmar-image-ingest?style=${encodeURIComponent(style)}&companyId=${encodeURIComponent(companyId)}`;
  fetch(ingestUrl, {
    headers: { Authorization: `Bearer ${supabaseServiceKey}` },
  }).then(async (resp) => {
    if (resp.ok) {
      const body = await resp.json().catch(() => null);
      console.log(`[SanMar] Background image ingest for ${style}: ${resp.status}, uploaded=${body?.uploaded || 0}, failed=${body?.failed || 0}`);
    } else {
      const text = await resp.text().catch(() => "");
      console.error(`[SanMar] Background image ingest FAILED for ${style}: ${resp.status} - ${text.substring(0, 300)}`);
    }
  }).catch((err) => {
    console.error(`[SanMar] Background image ingest fetch error for ${style}: ${err.message}`);
  });
}

function normalizeColorKey(color: string): string {
  return (color || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function colorWordsMatch(productColor: string, imageColor: string): boolean {
  const pWords = productColor.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 0);
  const iWords = imageColor.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 0);
  if (pWords.length === 0 || iWords.length === 0) return false;

  const matching = pWords.filter(w => iWords.some(iw => iw.includes(w) || w.includes(iw)));
  const score = (matching.length * 2) / (pWords.length + iWords.length);
  return score >= 0.4;
}

function findFrontImage(images: any[]): any {
  return images.find((img: any) => {
    const cls = (img.classTypeName || "").toLowerCase();
    const url = (img.url || "").toLowerCase();
    return /front|fm/.test(cls) || /_fm[._]/.test(url);
  });
}

function findRearImage(images: any[]): any {
  return images.find((img: any) => {
    const cls = (img.classTypeName || "").toLowerCase();
    const url = (img.url || "").toLowerCase();
    return /rear|back|bk/.test(cls) || /_bk[._]/.test(url);
  });
}

function findSideImage(images: any[]): any {
  return images.find((img: any) => {
    const cls = (img.classTypeName || "").toLowerCase();
    const url = (img.url || "").toLowerCase();
    return /side|sleeve|profile/.test(cls) || /_sd[._]/.test(url);
  });
}

function transformSanMarData(
  apiData: any,
  supabaseUrl: string,
  cdnImages?: ResolvedColorImages
): ProductResult {
  const style = apiData.style;
  const colors: ColorOption[] = [];

  const mediaImages = apiData.media?.images || [];
  const mediaViews = apiData.media?.views || {};
  const hasCdn = cdnImages && Object.keys(cdnImages).length > 0;
  console.log(`[SanMar] Transform: ${mediaImages.length} media images, CDN colors: ${hasCdn ? Object.keys(cdnImages!).length : 0}`);

  const imagesByPartId = new Map<string, any[]>();
  for (const img of mediaImages) {
    if (img.partId) {
      if (!imagesByPartId.has(img.partId)) imagesByPartId.set(img.partId, []);
      imagesByPartId.get(img.partId)!.push(img);
    }
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

      const colorName = color.colorName?.toLowerCase().trim() || "";
      const colorKey = normalizeColorKey(color.colorName);

      if (hasCdn) {
        const cdnEntry = cdnImages![colorKey];
        if (cdnEntry) {
          imageUrl = cdnEntry.front || cdnEntry.all?.[0] || "";
          rearImageUrl = cdnEntry.back || "";
          sideImageUrl = cdnEntry.side || "";
        }
      }

      if (!imageUrl) {
        let colorImages = mediaImages.filter((img: any) => {
          if (img.partId && partIds.includes(img.partId)) return true;
          const imgColor = (img.color || "").toLowerCase().trim();
          if (!imgColor || !colorName) return false;
          if (imgColor === colorName) return true;
          if (normalizeColorKey(img.color) === colorKey) return true;
          return false;
        });

        if (colorImages.length === 0 && colorName) {
          colorImages = mediaImages.filter((img: any) => {
            const imgColor = (img.color || "").trim();
            if (!imgColor) return false;
            return colorWordsMatch(color.colorName, imgColor);
          });
          if (colorImages.length > 0) {
            console.log(`[SanMar] Fuzzy matched "${color.colorName}" -> "${colorImages[0].color}" (${colorImages.length} images)`);
          }
        }

        if (colorImages.length === 0 && partIds.length > 0) {
          for (const pid of partIds) {
            const partImgs = imagesByPartId.get(pid);
            if (partImgs && partImgs.length > 0) {
              colorImages = partImgs;
              break;
            }
          }
        }

        const colorSpecificImages = colorImages.filter((img: any) => {
          const url = (img.url || "");
          return img.partId && url.includes(`_${img.partId}`);
        });

        const imagesToUse = colorSpecificImages.length > 0 ? colorSpecificImages : colorImages;

        if (imagesToUse.length > 0) {
          const frontImg = findFrontImage(imagesToUse);
          const rearImg = findRearImage(imagesToUse);
          const sideImg = findSideImage(imagesToUse);

          imageUrl = frontImg?.url || imagesToUse[0]?.url || "";
          rearImageUrl = rearImg?.url || "";
          sideImageUrl = sideImg?.url || "";
        }

        if (!rearImageUrl && mediaViews.rearImages?.length > 0) {
          const colorPartUrl = mediaViews.rearImages.find((u: string) =>
            partIds.some((pid: string) => u.includes(pid))
          );
          rearImageUrl = colorPartUrl || "";
        }

        if (!sideImageUrl && mediaViews.sideImages?.length > 0) {
          const colorPartUrl = mediaViews.sideImages.find((u: string) =>
            partIds.some((pid: string) => u.includes(pid))
          );
          sideImageUrl = colorPartUrl || "";
        }

        if (!imageUrl && style.styleNumber) {
          const fallbacks = buildSanMarCdnFallbackUrl(style.styleNumber);
          if (fallbacks.length > 0) {
            imageUrl = fallbacks[0];
          }
        }

        imageUrl = proxySanMarUrl(imageUrl, supabaseUrl);
        rearImageUrl = proxySanMarUrl(rearImageUrl, supabaseUrl);
        sideImageUrl = proxySanMarUrl(sideImageUrl, supabaseUrl);
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

  const withImages = colors.filter(c => !!c.image_url).length;
  const withRear = colors.filter(c => !!c.rear_image_url).length;
  const withSide = colors.filter(c => !!c.side_image_url).length;
  console.log(`[SanMar] Transform complete: ${colors.length} colors, front=${withImages}, rear=${withRear}, side=${withSide}`);

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
