/**
 * Image Cache Utility
 *
 * Provides unified image caching for both S&S Activewear and SanMar suppliers.
 *
 * SCOPE: Image fetching and caching ONLY.
 * DO NOT modify product lookup, prefix normalization, pricing, or any other system.
 *
 * Cache Tables:
 * - sanmar_media_cache: For SanMar images (cache_key = style:{STYLE}, cache_type = style)
 * - images: For S&S Activewear images (linked to parts table)
 *
 * Cache Key Format: {supplier}:{styleId}:{colorId}
 * TTL: 24 hours (existing behavior preserved)
 */

export interface ImageUrls {
  front: string | null;
  rear: string | null;
  side: string | null;
  lifestyle: string | null;
  frontImages: string[];
  rearImages: string[];
  sideImages: string[];
  lifestyleImages: string[];
  otherImages: string[];
}

export interface CachedImageData {
  supplier: "sanmar" | "ssactivewear";
  styleId: string;
  colorId: string | null;
  urls: ImageUrls;
  timestamp: string;
  expiresAt: string;
}

export interface ImageFetchResult {
  images: ImageUrls;
  cached: boolean;
  fallbackUsed: boolean;
  source: "cache" | "api" | "cdn_fallback";
}

const CACHE_TTL_HOURS = 24;

const SS_CDN_BASE = "https://www.ssactivewear.com/images";
const SANMAR_CDN_BASE = "https://cdnm.sanmar.com/imglib";

export function buildSanMarCdnFallbackUrl(style: string, colorCode?: string): string[] {
  const urls: string[] = [];
  const normalizedStyle = style.toUpperCase().trim();

  urls.push(`${SANMAR_CDN_BASE}/${normalizedStyle}/${normalizedStyle}_fm.jpg`);

  if (colorCode) {
    const normalizedColor = colorCode.toUpperCase().trim();
    urls.push(`${SANMAR_CDN_BASE}/${normalizedStyle}/${normalizedStyle}_${normalizedColor}_fm.jpg`);
    urls.push(`${SANMAR_CDN_BASE}/${normalizedStyle}/${normalizedStyle}_${normalizedColor}_bm.jpg`);
  }

  return urls;
}

export function buildSSActivewearCdnFallbackUrl(styleId: string, colorCode?: string): string[] {
  const urls: string[] = [];
  const normalizedStyle = styleId.toUpperCase().trim();

  urls.push(`${SS_CDN_BASE}/style/${normalizedStyle}.jpg`);

  if (colorCode) {
    const normalizedColor = colorCode.toUpperCase().trim();
    urls.push(`${SS_CDN_BASE}/color/${normalizedColor}_f_fl.jpg`);
  }

  return urls;
}

export async function getSanMarImageCache(
  supabaseAdmin: any,
  companyId: string,
  styleId: string
): Promise<CachedImageData | null> {
  const cacheKey = `style:${styleId.toUpperCase()}`;

  console.log(`[Image Cache] SanMar cache lookup: company=${companyId}, style=${styleId}, key=${cacheKey}`);

  try {
    const { data: mediaCache } = await supabaseAdmin
      .from("sanmar_media_cache")
      .select("data, expires_at, created_at")
      .eq("company_id", companyId)
      .eq("cache_key", cacheKey)
      .eq("cache_type", "style")
      .maybeSingle();

    if (!mediaCache) {
      console.log(`[Image Cache] SanMar cache MISS for ${styleId}`);
      return null;
    }

    if (new Date(mediaCache.expires_at) < new Date()) {
      console.log(`[Image Cache] SanMar cache EXPIRED for ${styleId}`);
      return null;
    }

    const mediaData = mediaCache.data;
    if (!mediaData || !mediaData.images || mediaData.images.length === 0) {
      console.log(`[Image Cache] SanMar cache HIT but no images stored for ${styleId}`);
      return null;
    }

    console.log(`[Image Cache] SanMar cache HIT for ${styleId}: ${mediaData.images.length} images`);

    return {
      supplier: "sanmar",
      styleId: styleId.toUpperCase(),
      colorId: null,
      urls: mediaData.views || {
        front: null,
        rear: null,
        side: null,
        lifestyle: null,
        frontImages: [],
        rearImages: [],
        sideImages: [],
        lifestyleImages: [],
        otherImages: [],
      },
      timestamp: mediaCache.created_at,
      expiresAt: mediaCache.expires_at,
    };
  } catch (error) {
    console.error(`[Image Cache] Error reading SanMar cache:`, error);
    return null;
  }
}

export async function setSanMarImageCache(
  supabaseAdmin: any,
  companyId: string,
  styleId: string,
  mediaData: any
): Promise<boolean> {
  if (!mediaData?.images || mediaData.images.length === 0) {
    console.log(`[Image Cache] Skipping SanMar cache write - no images to cache for ${styleId}`);
    return false;
  }

  const cacheKey = `style:${styleId.toUpperCase()}`;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

  console.log(`[Image Cache] Writing SanMar cache: style=${styleId}, images=${mediaData.images.length}`);

  try {
    await supabaseAdmin
      .from("sanmar_media_cache")
      .upsert({
        company_id: companyId,
        cache_key: cacheKey,
        cache_type: "style",
        data: mediaData,
        expires_at: expiresAt.toISOString(),
      }, { onConflict: "company_id,cache_key" });

    console.log(`[Image Cache] SanMar cache written successfully for ${styleId}`);
    return true;
  } catch (error) {
    console.error(`[Image Cache] Error writing SanMar cache:`, error);
    return false;
  }
}

export async function getSSActivewearImageCache(
  supabaseAdmin: any,
  companyId: string,
  styleId: string,
  partId?: string
): Promise<CachedImageData | null> {
  console.log(`[Image Cache] SSActivewear cache lookup: company=${companyId}, style=${styleId}, partId=${partId || 'none'}`);

  try {
    const { data: styleData } = await supabaseAdmin
      .from("styles")
      .select("id, style_number, last_synced")
      .eq("company_id", companyId)
      .or(`style_number.ilike.${styleId},style_number.ilike.B${styleId.replace(/^B/i, '')}`)
      .maybeSingle();

    if (!styleData) {
      console.log(`[Image Cache] SSActivewear cache MISS - style not found: ${styleId}`);
      return null;
    }

    let partsQuery = supabaseAdmin
      .from("parts")
      .select("id, part_id, color_name")
      .eq("style_id", styleData.id);

    if (partId) {
      partsQuery = partsQuery.eq("part_id", partId);
    }

    const { data: partsData } = await partsQuery.limit(10);

    if (!partsData || partsData.length === 0) {
      console.log(`[Image Cache] SSActivewear cache MISS - no parts found for style: ${styleId}`);
      return null;
    }

    const partIds = partsData.map((p: any) => p.id);
    const { data: imagesData } = await supabaseAdmin
      .from("images")
      .select("url, class_type, color")
      .in("part_id", partIds);

    if (!imagesData || imagesData.length === 0) {
      console.log(`[Image Cache] SSActivewear cache MISS - no images found for style: ${styleId}`);
      return null;
    }

    console.log(`[Image Cache] SSActivewear cache HIT for ${styleId}: ${imagesData.length} images`);

    const urls = organizeImagesByType(imagesData);

    return {
      supplier: "ssactivewear",
      styleId: styleData.style_number,
      colorId: partId || null,
      urls,
      timestamp: styleData.last_synced || new Date().toISOString(),
      expiresAt: new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    };
  } catch (error) {
    console.error(`[Image Cache] Error reading SSActivewear cache:`, error);
    return null;
  }
}

export async function setSSActivewearImageCache(
  supabaseAdmin: any,
  companyId: string,
  styleId: string,
  partInternalId: string,
  images: Array<{ url: string; classTypeName: string; color?: string }>
): Promise<boolean> {
  if (!images || images.length === 0) {
    console.log(`[Image Cache] Skipping SSActivewear cache write - no images to cache for ${styleId}`);
    return false;
  }

  console.log(`[Image Cache] Writing SSActivewear cache: style=${styleId}, part=${partInternalId}, images=${images.length}`);

  let successCount = 0;
  try {
    for (const img of images) {
      if (!img.url) continue;

      const { data: existing } = await supabaseAdmin
        .from("images")
        .select("id")
        .eq("company_id", companyId)
        .eq("part_id", partInternalId)
        .eq("url", img.url)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("images")
          .update({
            class_type: img.classTypeName || null,
            color: img.color || null,
          })
          .eq("id", existing.id);
        successCount++;
      } else {
        const { error } = await supabaseAdmin
          .from("images")
          .insert({
            company_id: companyId,
            part_id: partInternalId,
            class_type: img.classTypeName || null,
            url: img.url,
            color: img.color || null,
          });

        if (!error) {
          successCount++;
        } else {
          console.warn(`[Image Cache] Insert failed for ${img.url}: ${error.message}`);
        }
      }
    }

    console.log(`[Image Cache] SSActivewear cache written: ${successCount}/${images.length} images for ${styleId}`);
    return successCount > 0;
  } catch (error) {
    console.error(`[Image Cache] Error writing SSActivewear cache:`, error);
    return false;
  }
}

function organizeImagesByType(imagesData: Array<{ url: string; class_type: string; color?: string }>): ImageUrls {
  const frontImages: string[] = [];
  const rearImages: string[] = [];
  const sideImages: string[] = [];
  const lifestyleImages: string[] = [];
  const otherImages: string[] = [];

  for (const img of imagesData) {
    if (!img.url) continue;

    const classType = (img.class_type || "").toLowerCase();

    if (classType.includes("front")) {
      frontImages.push(img.url);
    } else if (classType.includes("rear") || classType.includes("back")) {
      rearImages.push(img.url);
    } else if (classType.includes("side") || classType.includes("sleeve")) {
      sideImages.push(img.url);
    } else if (classType.includes("lifestyle") || classType.includes("casual")) {
      lifestyleImages.push(img.url);
    } else if (!classType.includes("swatch")) {
      otherImages.push(img.url);
    }
  }

  return {
    front: frontImages.length > 0 ? frontImages[0] : null,
    rear: rearImages.length > 0 ? rearImages[0] : null,
    side: sideImages.length > 0 ? sideImages[0] : null,
    lifestyle: lifestyleImages.length > 0 ? lifestyleImages[0] : null,
    frontImages,
    rearImages,
    sideImages,
    lifestyleImages,
    otherImages,
  };
}

export function logImageOperation(
  supplier: "sanmar" | "ssactivewear",
  styleId: string,
  operation: "cache_hit" | "cache_miss" | "api_fetch" | "cache_write" | "cdn_fallback",
  details: {
    imageCount?: number;
    fallbackUsed?: boolean;
    endpoint?: string;
    error?: string;
  }
): void {
  const logPrefix = `[Image ${supplier.toUpperCase()}]`;
  const timestamp = new Date().toISOString();

  switch (operation) {
    case "cache_hit":
      console.log(`${logPrefix} ${timestamp} CACHE HIT: style=${styleId}, images=${details.imageCount || 0}`);
      break;
    case "cache_miss":
      console.log(`${logPrefix} ${timestamp} CACHE MISS: style=${styleId}`);
      break;
    case "api_fetch":
      console.log(`${logPrefix} ${timestamp} API FETCH: style=${styleId}, endpoint=${details.endpoint || 'unknown'}, images=${details.imageCount || 0}`);
      break;
    case "cache_write":
      console.log(`${logPrefix} ${timestamp} CACHE WRITE: style=${styleId}, images=${details.imageCount || 0}`);
      break;
    case "cdn_fallback":
      console.log(`${logPrefix} ${timestamp} CDN FALLBACK: style=${styleId}, fallbackUsed=${details.fallbackUsed}`);
      break;
  }

  if (details.error) {
    console.error(`${logPrefix} ${timestamp} ERROR: ${details.error}`);
  }
}
