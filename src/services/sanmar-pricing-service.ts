/**
 * SanMar Pricing Service
 *
 * Fetches and normalizes pricing data from SanMar PromoStandards API
 * - Uses sanmarPromoClient for SOAP requests
 * - Caches results in Supabase for 24 hours
 * - Normalizes pricing fields for consistent structure
 */

import { supabase } from '../lib/supabase-client';
import { callService } from './sanmar-promo-client';

interface SanMarCredentials {
  username: string;
  password: string;
}

interface PriceBreak {
  quantity: number;
  price: number;
}

interface NormalizedPricing {
  style: string;
  color: string;
  size: string;
  piecePrice?: number;
  casePrice?: number;
  msrp?: number;
  mapPrice?: number;
  priceBreaks?: PriceBreak[];
  configuration?: any;
  currency?: string;
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
const CACHE_TABLE = 'sanmar_pricing_cache';

/**
 * Get complete pricing information for a specific SKU
 */
export async function getPricing(
  styleNumber: string,
  color: string,
  size: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<NormalizedPricing | null> {
  try {
    const cacheKey = `pricing:${styleNumber}:${color}:${size}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarPricing] Cache hit for ${styleNumber}/${color}/${size}`);
      return cached as NormalizedPricing;
    }

    console.log(`[SanMarPricing] Fetching pricing for ${styleNumber}/${color}/${size}`);

    const response = await callService({
      serviceType: 'PricingAndConfiguration',
      operation: 'getConfigurationAndPricing',
      payload: {
        productId: styleNumber,
        partId: color,
        localizationCountry: 'US',
        localizationLanguage: 'en',
        configurationType: 'Blank',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarPricing] Failed to fetch pricing for ${styleNumber}/${color}/${size}:`, response.error);
      return null;
    }

    const normalized = normalizePricing(styleNumber, color, size, response.data);

    await cacheData(cacheKey, 'pricing', normalized, companyId);

    return normalized;
  } catch (error) {
    console.error(`[SanMarPricing] Error fetching pricing for ${styleNumber}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get price breaks (quantity discounts) for a specific SKU
 */
export async function getPriceBreaks(
  styleNumber: string,
  color: string,
  size: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<PriceBreak[] | null> {
  try {
    const pricing = await getPricing(styleNumber, color, size, credentials, companyId);

    if (!pricing || !pricing.priceBreaks) {
      return null;
    }

    return pricing.priceBreaks;
  } catch (error) {
    console.error(`[SanMarPricing] Error fetching price breaks for ${styleNumber}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get MAP (Minimum Advertised Price) compliant pricing
 */
export async function getMapCompliantPrice(
  styleNumber: string,
  color: string,
  size: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<{ mapPrice?: number; msrp?: number; canAdvertise: boolean } | null> {
  try {
    const pricing = await getPricing(styleNumber, color, size, credentials, companyId);

    if (!pricing) {
      return null;
    }

    const mapPrice = pricing.mapPrice;
    const msrp = pricing.msrp;
    const canAdvertise = mapPrice !== undefined && mapPrice > 0;

    return {
      mapPrice,
      msrp,
      canAdvertise,
    };
  } catch (error) {
    console.error(`[SanMarPricing] Error fetching MAP price for ${styleNumber}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get pricing date modified (when pricing was last updated)
 */
export async function getPricingDateModified(
  styleNumber: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<{ style: string; dateModified: string } | null> {
  try {
    const cacheKey = `date_modified:${styleNumber}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarPricing] Cache hit for date modified ${styleNumber}`);
      return cached as { style: string; dateModified: string };
    }

    console.log(`[SanMarPricing] Fetching pricing date modified for ${styleNumber}`);

    const response = await callService({
      serviceType: 'PricingAndConfiguration',
      operation: 'getConfigurationAndPricingDateModified',
      payload: {
        productId: styleNumber,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarPricing] Failed to fetch date modified for ${styleNumber}:`, response.error);
      return null;
    }

    const result = {
      style: styleNumber,
      dateModified: response.data.dateModified || new Date().toISOString(),
    };

    await cacheData(cacheKey, 'date_modified', result, companyId);

    return result;
  } catch (error) {
    console.error(`[SanMarPricing] Error fetching pricing date modified for ${styleNumber}:`, error);
    return null;
  }
}

/**
 * Normalize pricing data from PromoStandards response
 */
function normalizePricing(
  styleNumber: string,
  color: string,
  size: string,
  data: any
): NormalizedPricing {
  let piecePrice: number | undefined;
  let casePrice: number | undefined;
  let msrp: number | undefined;
  let mapPrice: number | undefined;
  let priceBreaks: PriceBreak[] | undefined;
  let configuration: any;
  let currency = 'USD';

  if (data.Configuration || data.ConfigurationArray) {
    const configs = Array.isArray(data.Configuration)
      ? data.Configuration
      : data.ConfigurationArray || [data.Configuration];

    for (const config of configs) {
      if (!config) continue;

      const partArray = config.Part || config.PartArray || [];
      const parts = Array.isArray(partArray) ? partArray : [partArray];

      for (const part of parts) {
        if (!part) continue;

        const partId = part.partId || part.PartId || '';
        const colorMatch = !color || partId.toLowerCase().includes(color.toLowerCase());

        if (colorMatch) {
          const priceArray = part.Price || part.PriceArray || part.Prices || [];
          const prices = Array.isArray(priceArray) ? priceArray : [priceArray];

          const breaks: PriceBreak[] = [];

          for (const price of prices) {
            if (!price) continue;

            const quantity = parseInt(price.minQuantity || price.MinQuantity || '1', 10);
            const priceValue = parseFloat(price.price || price.Price || '0');
            const priceType = (price.priceType || price.PriceType || '').toLowerCase();

            if (priceType.includes('list') || priceType.includes('customer')) {
              if (quantity === 1 && !piecePrice) {
                piecePrice = priceValue;
              }
              breaks.push({ quantity, price: priceValue });
            } else if (priceType.includes('case')) {
              casePrice = priceValue;
            } else if (priceType.includes('msrp') || priceType.includes('retail')) {
              msrp = priceValue;
            } else if (priceType.includes('map')) {
              mapPrice = priceValue;
            } else {
              if (quantity === 1 && !piecePrice) {
                piecePrice = priceValue;
              }
              breaks.push({ quantity, price: priceValue });
            }
          }

          if (breaks.length > 0) {
            breaks.sort((a, b) => a.quantity - b.quantity);
            priceBreaks = breaks;
          }

          if (part.currency || part.Currency) {
            currency = part.currency || part.Currency;
          }

          configuration = {
            partId: part.partId || part.PartId,
            description: part.description || part.Description,
            approximateSize: part.approximateSize || part.ApproximateSize,
            dimensions: part.dimensions || part.Dimensions,
            unspscCommodityCode: part.unspscCommodityCode || part.UnspscCommodityCode,
          };

          break;
        }
      }
    }
  } else if (data.PartArray || data.Parts) {
    const partArray = data.PartArray || data.Parts || [];
    const parts = Array.isArray(partArray) ? partArray : [partArray];

    for (const part of parts) {
      if (!part) continue;

      const priceArray = part.Price || part.PriceArray || part.Prices || [];
      const prices = Array.isArray(priceArray) ? priceArray : [priceArray];

      const breaks: PriceBreak[] = [];

      for (const price of prices) {
        if (!price) continue;

        const quantity = parseInt(price.minQuantity || price.MinQuantity || '1', 10);
        const priceValue = parseFloat(price.price || price.Price || '0');

        if (quantity === 1 && !piecePrice) {
          piecePrice = priceValue;
        }
        breaks.push({ quantity, price: priceValue });
      }

      if (breaks.length > 0) {
        breaks.sort((a, b) => a.quantity - b.quantity);
        priceBreaks = breaks;
      }

      break;
    }
  }

  if (!piecePrice && data.price) {
    piecePrice = parseFloat(data.price);
  }

  if (!piecePrice && data.Price) {
    piecePrice = parseFloat(data.Price);
  }

  if (!piecePrice && priceBreaks && priceBreaks.length > 0) {
    piecePrice = priceBreaks[0].price;
  }

  return {
    style: styleNumber,
    color,
    size,
    piecePrice,
    casePrice,
    msrp,
    mapPrice,
    priceBreaks,
    configuration,
    currency,
    rawData: data,
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
      console.error('[SanMarPricing] Cache read error:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.log(`[SanMarPricing] Cache expired for ${cacheKey}`);
      await supabase
        .from(CACHE_TABLE)
        .delete()
        .eq('cache_key', cacheKey)
        .eq('company_id', companyId);

      return null;
    }

    return data.data;
  } catch (error) {
    console.error('[SanMarPricing] Cache read error:', error);
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
      console.error('[SanMarPricing] Cache write error:', error);
    } else {
      console.log(`[SanMarPricing] Cached ${cacheKey} until ${expiresAt.toISOString()}`);
    }
  } catch (error) {
    console.error('[SanMarPricing] Cache write error:', error);
  }
}

/**
 * Clear expired cache entries (utility function)
 */
export async function clearExpiredPricingCache(): Promise<number> {
  try {
    const now = new Date().toISOString();

    const { error, count } = await supabase
      .from(CACHE_TABLE)
      .delete()
      .lt('expires_at', now);

    if (error) {
      console.error('[SanMarPricing] Failed to clear expired cache:', error);
      return 0;
    }

    console.log(`[SanMarPricing] Cleared ${count || 0} expired cache entries`);
    return count || 0;
  } catch (error) {
    console.error('[SanMarPricing] Error clearing cache:', error);
    return 0;
  }
}

/**
 * Clear all pricing cache for a company (utility function)
 */
export async function clearCompanyPricingCache(companyId: string): Promise<number> {
  try {
    const { error, count } = await supabase
      .from(CACHE_TABLE)
      .delete()
      .eq('company_id', companyId);

    if (error) {
      console.error('[SanMarPricing] Failed to clear company cache:', error);
      return 0;
    }

    console.log(`[SanMarPricing] Cleared ${count || 0} pricing cache entries for company ${companyId}`);
    return count || 0;
  } catch (error) {
    console.error('[SanMarPricing] Error clearing company cache:', error);
    return 0;
  }
}

/**
 * Clear specific style pricing cache (utility function)
 */
export async function clearStylePricingCache(styleNumber: string, companyId: string): Promise<void> {
  try {
    await supabase
      .from(CACHE_TABLE)
      .delete()
      .eq('company_id', companyId)
      .like('cache_key', `%${styleNumber}%`);

    console.log(`[SanMarPricing] Cleared pricing cache for style ${styleNumber}`);
  } catch (error) {
    console.error('[SanMarPricing] Error clearing style pricing cache:', error);
  }
}

/**
 * Batch fetch pricing for multiple SKUs
 */
export async function batchGetPricing(
  skus: Array<{ style: string; color: string; size: string }>,
  credentials: SanMarCredentials,
  companyId: string
): Promise<Map<string, NormalizedPricing>> {
  const results = new Map<string, NormalizedPricing>();

  await Promise.all(
    skus.map(async ({ style, color, size }) => {
      const pricing = await getPricing(style, color, size, credentials, companyId);
      if (pricing) {
        results.set(`${style}:${color}:${size}`, pricing);
      }
    })
  );

  return results;
}

/**
 * Get lowest price for a SKU based on quantity
 */
export async function getLowestPriceForQuantity(
  styleNumber: string,
  color: string,
  size: string,
  quantity: number,
  credentials: SanMarCredentials,
  companyId: string
): Promise<{ price: number; break: PriceBreak } | null> {
  try {
    const priceBreaks = await getPriceBreaks(styleNumber, color, size, credentials, companyId);

    if (!priceBreaks || priceBreaks.length === 0) {
      return null;
    }

    let applicableBreak = priceBreaks[0];

    for (const priceBreak of priceBreaks) {
      if (quantity >= priceBreak.quantity) {
        applicableBreak = priceBreak;
      } else {
        break;
      }
    }

    return {
      price: applicableBreak.price,
      break: applicableBreak,
    };
  } catch (error) {
    console.error(`[SanMarPricing] Error getting lowest price for quantity:`, error);
    return null;
  }
}

/**
 * Calculate total cost for a quantity with price breaks
 */
export async function calculateTotalCost(
  styleNumber: string,
  color: string,
  size: string,
  quantity: number,
  credentials: SanMarCredentials,
  companyId: string
): Promise<{ total: number; unitPrice: number; priceBreak: PriceBreak } | null> {
  try {
    const lowestPrice = await getLowestPriceForQuantity(
      styleNumber,
      color,
      size,
      quantity,
      credentials,
      companyId
    );

    if (!lowestPrice) {
      return null;
    }

    const total = lowestPrice.price * quantity;

    return {
      total,
      unitPrice: lowestPrice.price,
      priceBreak: lowestPrice.break,
    };
  } catch (error) {
    console.error(`[SanMarPricing] Error calculating total cost:`, error);
    return null;
  }
}
