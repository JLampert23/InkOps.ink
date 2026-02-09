/**
 * SanMar Product Data Service
 *
 * Fetches and normalizes product data from SanMar PromoStandards API
 * - Uses sanmarPromoClient for SOAP requests
 * - Caches results in Supabase for 12 hours
 * - Normalizes product fields for consistent data structure
 */

import { supabase } from '../lib/supabase-client';
import { callService } from './sanmar-promo-client';

interface SanMarCredentials {
  username: string;
  password: string;
}

interface NormalizedStyle {
  style: string;
  description: string;
  features: string[];
  category: string;
  subcategory: string;
  status: string;
  companionStyles: string[];
  lastModified?: string;
  rawData?: any;
}

interface NormalizedVariant {
  style: string;
  color: string;
  colorName?: string;
  size: string;
  labelSize?: string;
  partId: string;
  gtin?: string;
  status: string;
}

interface NormalizedProductMetadata {
  style: string;
  color: string;
  size: string;
  partId: string;
  description: string;
  gtin?: string;
  status: string;
  features: string[];
  category: string;
  subcategory: string;
  companionStyles: string[];
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

const CACHE_DURATION_HOURS = 12;
const CACHE_TABLE = 'sanmar_product_cache';

/**
 * Get style information (basic product details)
 */
export async function getStyle(
  styleNumber: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<NormalizedStyle | null> {
  try {
    const cacheKey = `style:${styleNumber}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarProductData] Cache hit for style ${styleNumber}`);
      return cached as NormalizedStyle;
    }

    console.log(`[SanMarProductData] Fetching style ${styleNumber}`);

    const response = await callService({
      serviceType: 'ProductData',
      operation: 'getProduct',
      payload: {
        productId: styleNumber,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarProductData] Failed to fetch style ${styleNumber}:`, response.error);
      return null;
    }

    const normalized = normalizeStyleData(response.data);

    await cacheData(cacheKey, 'style', normalized, companyId);

    return normalized;
  } catch (error) {
    console.error(`[SanMarProductData] Error fetching style ${styleNumber}:`, error);
    return null;
  }
}

/**
 * Get all variants for a style (colors and sizes)
 */
export async function getStyleVariants(
  styleNumber: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<NormalizedVariant[]> {
  try {
    const cacheKey = `variants:${styleNumber}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarProductData] Cache hit for variants ${styleNumber}`);
      return cached as NormalizedVariant[];
    }

    console.log(`[SanMarProductData] Fetching variants for ${styleNumber}`);

    const response = await callService({
      serviceType: 'ProductData',
      operation: 'getProduct',
      payload: {
        productId: styleNumber,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarProductData] Failed to fetch variants ${styleNumber}:`, response.error);
      return [];
    }

    const variants = normalizeVariants(styleNumber, response.data);

    await cacheData(cacheKey, 'variants', variants, companyId);

    return variants;
  } catch (error) {
    console.error(`[SanMarProductData] Error fetching variants ${styleNumber}:`, error);
    return [];
  }
}

/**
 * Get detailed metadata for a specific product (style + color + size)
 */
export async function getProductMetadata(
  styleNumber: string,
  color: string,
  size: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<NormalizedProductMetadata | null> {
  try {
    const cacheKey = `metadata:${styleNumber}:${color}:${size}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarProductData] Cache hit for metadata ${styleNumber}/${color}/${size}`);
      return cached as NormalizedProductMetadata;
    }

    console.log(`[SanMarProductData] Fetching metadata for ${styleNumber}/${color}/${size}`);

    const response = await callService({
      serviceType: 'ProductData',
      operation: 'getProduct',
      payload: {
        productId: styleNumber,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarProductData] Failed to fetch metadata:`, response.error);
      return null;
    }

    const metadata = normalizeProductMetadata(styleNumber, color, size, response.data);

    if (!metadata) {
      console.error(`[SanMarProductData] Could not find variant ${color}/${size} in response`);
      return null;
    }

    await cacheData(cacheKey, 'metadata', metadata, companyId);

    return metadata;
  } catch (error) {
    console.error(`[SanMarProductData] Error fetching metadata:`, error);
    return null;
  }
}

/**
 * Get product sellable status (not yet implemented in PromoStandards)
 */
export async function getProductSellable(
  styleNumber: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<{ style: string; sellable: boolean } | null> {
  console.warn(`[SanMarProductData] getProductSellable not supported by PromoStandards API`);

  const style = await getStyle(styleNumber, credentials, companyId);

  return style ? {
    style: styleNumber,
    sellable: style.status === 'active' || style.status === 'available',
  } : null;
}

/**
 * Get product date modified (not yet implemented in PromoStandards)
 */
export async function getProductDateModified(
  styleNumber: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<{ style: string; dateModified: string } | null> {
  console.warn(`[SanMarProductData] getProductDateModified not directly supported`);

  const cacheKey = `date_modified:${styleNumber}`;
  const cached = await getCachedData(cacheKey, companyId);

  if (cached) {
    return cached as { style: string; dateModified: string };
  }

  const style = await getStyle(styleNumber, credentials, companyId);

  const result = {
    style: styleNumber,
    dateModified: style?.lastModified || new Date().toISOString(),
  };

  await cacheData(cacheKey, 'date_modified', result, companyId);

  return result;
}

/**
 * Normalize style data from API response
 */
function normalizeStyleData(data: any): NormalizedStyle {
  const features: string[] = [];

  if (data.description) {
    features.push(data.description);
  }

  const productData = data.Product || data;

  return {
    style: productData.productId || productData.productName || '',
    description: productData.description || productData.productName || '',
    features,
    category: extractCategory(productData),
    subcategory: extractSubcategory(productData),
    status: normalizeStatus(productData.priceType),
    companionStyles: [],
    rawData: data,
  };
}

/**
 * Normalize variants from API response
 */
function normalizeVariants(styleNumber: string, data: any): NormalizedVariant[] {
  const parts = data.parts || data.PartArray || [];

  if (!Array.isArray(parts)) {
    return [];
  }

  return parts.map((part: any) => ({
    style: styleNumber,
    color: part.color || part.attributeColor || '',
    colorName: part.colorName || '',
    size: part.size || part.attributeSize || '',
    labelSize: part.labelSize || part.size || '',
    partId: part.partId || '',
    gtin: part.gtin || part.upc || '',
    status: normalizeStatus(part.priceType || 'active'),
  }));
}

/**
 * Normalize product metadata for a specific variant
 */
function normalizeProductMetadata(
  styleNumber: string,
  color: string,
  size: string,
  data: any
): NormalizedProductMetadata | null {
  const parts = data.parts || data.PartArray || [];

  if (!Array.isArray(parts)) {
    return null;
  }

  const matchingPart = parts.find((part: any) => {
    const partColor = (part.color || part.attributeColor || '').toLowerCase();
    const partSize = (part.size || part.attributeSize || '').toLowerCase();

    return partColor === color.toLowerCase() && partSize === size.toLowerCase();
  });

  if (!matchingPart) {
    return null;
  }

  const productData = data.Product || data;
  const features: string[] = [];

  if (productData.description) {
    features.push(productData.description);
  }

  return {
    style: styleNumber,
    color: matchingPart.color || matchingPart.attributeColor || color,
    size: matchingPart.size || matchingPart.attributeSize || size,
    partId: matchingPart.partId || '',
    description: productData.description || productData.productName || '',
    gtin: matchingPart.gtin || matchingPart.upc || '',
    status: normalizeStatus(matchingPart.priceType || productData.priceType),
    features,
    category: extractCategory(productData),
    subcategory: extractSubcategory(productData),
    companionStyles: [],
  };
}

/**
 * Extract category from product data
 */
function extractCategory(data: any): string {
  return data.category || data.productCategory || 'Apparel';
}

/**
 * Extract subcategory from product data
 */
function extractSubcategory(data: any): string {
  return data.subcategory || data.productSubcategory || '';
}

/**
 * Normalize status values
 */
function normalizeStatus(priceType?: string): string {
  if (!priceType) {
    return 'active';
  }

  const normalized = priceType.toLowerCase();

  if (normalized.includes('list') || normalized.includes('customer')) {
    return 'active';
  }

  if (normalized.includes('net') || normalized.includes('cost')) {
    return 'available';
  }

  return 'active';
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
      console.error('[SanMarProductData] Cache read error:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.log(`[SanMarProductData] Cache expired for ${cacheKey}`);
      await supabase
        .from(CACHE_TABLE)
        .delete()
        .eq('cache_key', cacheKey)
        .eq('company_id', companyId);

      return null;
    }

    return data.data;
  } catch (error) {
    console.error('[SanMarProductData] Cache read error:', error);
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
      console.error('[SanMarProductData] Cache write error:', error);
    } else {
      console.log(`[SanMarProductData] Cached ${cacheKey} until ${expiresAt.toISOString()}`);
    }
  } catch (error) {
    console.error('[SanMarProductData] Cache write error:', error);
  }
}

/**
 * Clear expired cache entries (utility function)
 */
export async function clearExpiredCache(): Promise<number> {
  try {
    const now = new Date().toISOString();

    const { error, count } = await supabase
      .from(CACHE_TABLE)
      .delete()
      .lt('expires_at', now);

    if (error) {
      console.error('[SanMarProductData] Failed to clear expired cache:', error);
      return 0;
    }

    console.log(`[SanMarProductData] Cleared ${count || 0} expired cache entries`);
    return count || 0;
  } catch (error) {
    console.error('[SanMarProductData] Error clearing cache:', error);
    return 0;
  }
}

/**
 * Clear all cache for a company (utility function)
 */
export async function clearCompanyCache(companyId: string): Promise<number> {
  try {
    const { error, count } = await supabase
      .from(CACHE_TABLE)
      .delete()
      .eq('company_id', companyId);

    if (error) {
      console.error('[SanMarProductData] Failed to clear company cache:', error);
      return 0;
    }

    console.log(`[SanMarProductData] Cleared ${count || 0} cache entries for company ${companyId}`);
    return count || 0;
  } catch (error) {
    console.error('[SanMarProductData] Error clearing company cache:', error);
    return 0;
  }
}

/**
 * Clear specific style cache (utility function)
 */
export async function clearStyleCache(styleNumber: string, companyId: string): Promise<void> {
  try {
    await supabase
      .from(CACHE_TABLE)
      .delete()
      .eq('company_id', companyId)
      .like('cache_key', `%${styleNumber}%`);

    console.log(`[SanMarProductData] Cleared cache for style ${styleNumber}`);
  } catch (error) {
    console.error('[SanMarProductData] Error clearing style cache:', error);
  }
}
