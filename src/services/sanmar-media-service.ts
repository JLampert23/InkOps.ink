/**
 * SanMar Media Service
 *
 * Fetches and normalizes media content from SanMar PromoStandards API
 * - Uses sanmarPromoClient for SOAP requests
 * - Caches results in Supabase for 24 hours
 * - Normalizes media fields for consistent structure
 */

import { supabase } from '../lib/supabase-client';
import { callService } from './sanmar-promo-client';

interface SanMarCredentials {
  username: string;
  password: string;
}

interface NormalizedMedia {
  style: string;
  color?: string;
  frontModel?: string;
  backModel?: string;
  frontFlat?: string;
  backFlat?: string;
  colorSwatch?: string;
  thumbnail?: string;
  specSheet?: string;
  measurementSheet?: string;
  additionalImages?: string[];
  lastModified?: string;
  rawData?: any;
}

interface CacheEntry {
  id?: number;
  cache_key: string;
  cache_type: string;
  data: any;
  created_at?: string;
  expires_at: string;
  company_id: string;
}

const CACHE_DURATION_HOURS = 24;
const CACHE_TABLE = 'sanmar_media_cache';

/**
 * Get all media for a style (without color-specific images)
 */
export async function getMediaForStyle(
  styleNumber: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<NormalizedMedia | null> {
  try {
    const cacheKey = `style:${styleNumber}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarMedia] Cache hit for style ${styleNumber}`);
      return cached as NormalizedMedia;
    }

    console.log(`[SanMarMedia] Fetching media for style ${styleNumber}`);

    const response = await callService({
      serviceType: 'MediaContent',
      operation: 'getMediaContent',
      payload: {
        productId: styleNumber,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarMedia] Failed to fetch media for ${styleNumber}:`, response.error);
      return null;
    }

    const normalized = normalizeMediaForStyle(styleNumber, response.data);

    await cacheData(cacheKey, 'style', normalized, companyId);

    return normalized;
  } catch (error) {
    console.error(`[SanMarMedia] Error fetching media for style ${styleNumber}:`, error);
    return null;
  }
}

/**
 * Get media for a specific style and color variant
 */
export async function getMediaForVariant(
  styleNumber: string,
  color: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<NormalizedMedia | null> {
  try {
    const cacheKey = `variant:${styleNumber}:${color}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarMedia] Cache hit for variant ${styleNumber}/${color}`);
      return cached as NormalizedMedia;
    }

    console.log(`[SanMarMedia] Fetching media for variant ${styleNumber}/${color}`);

    const response = await callService({
      serviceType: 'MediaContent',
      operation: 'getMediaContent',
      payload: {
        productId: styleNumber,
        partId: color,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarMedia] Failed to fetch media for ${styleNumber}/${color}:`, response.error);
      return null;
    }

    const normalized = normalizeMediaForVariant(styleNumber, color, response.data);

    await cacheData(cacheKey, 'variant', normalized, companyId);

    return normalized;
  } catch (error) {
    console.error(`[SanMarMedia] Error fetching media for variant ${styleNumber}/${color}:`, error);
    return null;
  }
}

/**
 * Get media date modified (when media was last updated)
 */
export async function getMediaDateModified(
  styleNumber: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<{ style: string; dateModified: string } | null> {
  try {
    const cacheKey = `date_modified:${styleNumber}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarMedia] Cache hit for date modified ${styleNumber}`);
      return cached as { style: string; dateModified: string };
    }

    console.log(`[SanMarMedia] Fetching date modified for ${styleNumber}`);

    const response = await callService({
      serviceType: 'MediaContent',
      operation: 'getMediaDateModified',
      payload: {
        productId: styleNumber,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarMedia] Failed to fetch date modified for ${styleNumber}:`, response.error);
      return null;
    }

    const result = {
      style: styleNumber,
      dateModified: response.data.dateModified || new Date().toISOString(),
    };

    await cacheData(cacheKey, 'date_modified', result, companyId);

    return result;
  } catch (error) {
    console.error(`[SanMarMedia] Error fetching date modified for ${styleNumber}:`, error);
    return null;
  }
}

/**
 * Normalize media data for a style (general images)
 */
function normalizeMediaForStyle(styleNumber: string, data: any): NormalizedMedia {
  const media = data.Media || data.MediaContentArray || data;
  const additionalImages: string[] = [];

  let frontModel: string | undefined;
  let backModel: string | undefined;
  let frontFlat: string | undefined;
  let backFlat: string | undefined;
  let colorSwatch: string | undefined;
  let thumbnail: string | undefined;
  let specSheet: string | undefined;
  let measurementSheet: string | undefined;

  if (Array.isArray(media)) {
    for (const item of media) {
      const url = item.url || item.mediaUrl || item.URL || '';
      const type = (item.type || item.mediaType || '').toLowerCase();
      const description = (item.description || '').toLowerCase();

      if (type.includes('image') || type.includes('jpg') || type.includes('png')) {
        if (description.includes('front') && description.includes('model')) {
          frontModel = url;
        } else if (description.includes('back') && description.includes('model')) {
          backModel = url;
        } else if (description.includes('front') && description.includes('flat')) {
          frontFlat = url;
        } else if (description.includes('back') && description.includes('flat')) {
          backFlat = url;
        } else if (description.includes('swatch') || description.includes('color')) {
          colorSwatch = url;
        } else if (description.includes('thumbnail') || description.includes('thumb')) {
          thumbnail = url;
        } else if (url && !additionalImages.includes(url)) {
          additionalImages.push(url);
        }
      } else if (type.includes('pdf')) {
        if (description.includes('spec') || description.includes('specification')) {
          specSheet = url;
        } else if (description.includes('measurement') || description.includes('size')) {
          measurementSheet = url;
        }
      }
    }
  } else if (typeof media === 'object') {
    frontModel = media.frontModel || media.FrontModel;
    backModel = media.backModel || media.BackModel;
    frontFlat = media.frontFlat || media.FrontFlat;
    backFlat = media.backFlat || media.BackFlat;
    colorSwatch = media.colorSwatch || media.ColorSwatch;
    thumbnail = media.thumbnail || media.Thumbnail;
    specSheet = media.specSheet || media.SpecSheet;
    measurementSheet = media.measurementSheet || media.MeasurementSheet;
  }

  if (!thumbnail && frontModel) {
    thumbnail = frontModel;
  }

  if (!thumbnail && frontFlat) {
    thumbnail = frontFlat;
  }

  return {
    style: styleNumber,
    frontModel,
    backModel,
    frontFlat,
    backFlat,
    colorSwatch,
    thumbnail,
    specSheet,
    measurementSheet,
    additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
    rawData: data,
  };
}

/**
 * Normalize media data for a variant (color-specific images)
 */
function normalizeMediaForVariant(
  styleNumber: string,
  color: string,
  data: any
): NormalizedMedia {
  const baseMedia = normalizeMediaForStyle(styleNumber, data);

  return {
    ...baseMedia,
    style: styleNumber,
    color,
  };
}

/**
 * Get cached data if not expired
 */
async function getCachedData(cacheKey: string, companyId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from(CACHE_TABLE)
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('[SanMarMedia] Cache read error:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.log(`[SanMarMedia] Cache expired for ${cacheKey}`);
      await supabase
        .from(CACHE_TABLE)
        .delete()
        .eq('cache_key', cacheKey)
        .eq('company_id', companyId);

      return null;
    }

    return data.data;
  } catch (error) {
    console.error('[SanMarMedia] Cache read error:', error);
    return null;
  }
}

/**
 * Cache data with expiration
 */
async function cacheData(
  cacheKey: string,
  cacheType: string,
  data: any,
  companyId: string
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_DURATION_HOURS * 60 * 60 * 1000);

    const cacheEntry: CacheEntry = {
      cache_key: cacheKey,
      cache_type: cacheType,
      data,
      expires_at: expiresAt.toISOString(),
      company_id: companyId,
    };

    const { error } = await supabase
      .from(CACHE_TABLE)
      .upsert(cacheEntry, {
        onConflict: 'cache_key,company_id',
      });

    if (error) {
      console.error('[SanMarMedia] Cache write error:', error);
    } else {
      console.log(`[SanMarMedia] Cached ${cacheKey} until ${expiresAt.toISOString()}`);
    }
  } catch (error) {
    console.error('[SanMarMedia] Cache write error:', error);
  }
}

/**
 * Clear expired cache entries (utility function)
 */
export async function clearExpiredMediaCache(): Promise<number> {
  try {
    const now = new Date().toISOString();

    const { error, count } = await supabase
      .from(CACHE_TABLE)
      .delete()
      .lt('expires_at', now);

    if (error) {
      console.error('[SanMarMedia] Failed to clear expired cache:', error);
      return 0;
    }

    console.log(`[SanMarMedia] Cleared ${count || 0} expired cache entries`);
    return count || 0;
  } catch (error) {
    console.error('[SanMarMedia] Error clearing cache:', error);
    return 0;
  }
}

/**
 * Clear all media cache for a company (utility function)
 */
export async function clearCompanyMediaCache(companyId: string): Promise<number> {
  try {
    const { error, count } = await supabase
      .from(CACHE_TABLE)
      .delete()
      .eq('company_id', companyId);

    if (error) {
      console.error('[SanMarMedia] Failed to clear company cache:', error);
      return 0;
    }

    console.log(`[SanMarMedia] Cleared ${count || 0} media cache entries for company ${companyId}`);
    return count || 0;
  } catch (error) {
    console.error('[SanMarMedia] Error clearing company cache:', error);
    return 0;
  }
}

/**
 * Clear specific style media cache (utility function)
 */
export async function clearStyleMediaCache(styleNumber: string, companyId: string): Promise<void> {
  try {
    await supabase
      .from(CACHE_TABLE)
      .delete()
      .eq('company_id', companyId)
      .like('cache_key', `%${styleNumber}%`);

    console.log(`[SanMarMedia] Cleared media cache for style ${styleNumber}`);
  } catch (error) {
    console.error('[SanMarMedia] Error clearing style media cache:', error);
  }
}

/**
 * Batch fetch media for multiple styles
 */
export async function batchGetMediaForStyles(
  styleNumbers: string[],
  credentials: SanMarCredentials,
  companyId: string
): Promise<Map<string, NormalizedMedia>> {
  const results = new Map<string, NormalizedMedia>();

  await Promise.all(
    styleNumbers.map(async (styleNumber) => {
      const media = await getMediaForStyle(styleNumber, credentials, companyId);
      if (media) {
        results.set(styleNumber, media);
      }
    })
  );

  return results;
}

/**
 * Batch fetch media for multiple variants
 */
export async function batchGetMediaForVariants(
  variants: Array<{ style: string; color: string }>,
  credentials: SanMarCredentials,
  companyId: string
): Promise<Map<string, NormalizedMedia>> {
  const results = new Map<string, NormalizedMedia>();

  await Promise.all(
    variants.map(async ({ style, color }) => {
      const media = await getMediaForVariant(style, color, credentials, companyId);
      if (media) {
        results.set(`${style}:${color}`, media);
      }
    })
  );

  return results;
}
