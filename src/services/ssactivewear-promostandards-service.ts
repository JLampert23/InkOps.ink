import { supabase } from '../lib/supabase-client';
import {
  PromoStandardsProduct,
  PromoStandardsPricing,
  PromoStandardsInventory,
  PromoStandardsMedia,
} from '../types/promostandards';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ssactivewear-api`;

async function getAuthToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();

  console.log('Getting auth token:', {
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    error,
    expiresAt: session?.expires_at,
    isExpired: session?.expires_at ? new Date(session.expires_at * 1000) < new Date() : null
  });

  if (error) {
    console.error('Error getting session:', error);
    throw new Error('Failed to get session: ' + error.message);
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated - no access token in session');
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = session.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  const isExpiringSoon = expiresAt - now < 300; // 5 minutes

  if (isExpiringSoon) {
    console.log('Token expiring soon, refreshing session...');
    const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !newSession) {
      console.error('Failed to refresh session:', refreshError);
      throw new Error('Session expired, please log in again');
    }
    return newSession.access_token;
  }

  // Check if token is expired
  if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
    console.warn('Access token has expired, attempting to refresh...');
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshedSession?.access_token) {
      throw new Error('Session expired and refresh failed. Please log in again.');
    }

    console.log('Session refreshed successfully');
    return refreshedSession.access_token;
  }

  return session.access_token;
}

export async function lookupProductByStyle(styleNumber: string): Promise<PromoStandardsProduct | null> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${EDGE_FUNCTION_URL}?action=product&productId=${encodeURIComponent(styleNumber)}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'X-User-Token': token,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to lookup product');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Product lookup failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error looking up product:', error);
    throw error;
  }
}

export async function getCachedPricing(partNumber: string, quantity: number = 1): Promise<number | null> {
  try {
    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('id')
      .maybeSingle();

    if (!companySettings) {
      return null;
    }

    const { data: pricing } = await supabase
      .from('ss_catalog_pricing')
      .select('unit_price')
      .eq('part_number', partNumber)
      .lte('quantity_min', quantity)
      .or(`quantity_max.gte.${quantity},quantity_max.is.null`)
      .or(`price_expiry_date.gte.${new Date().toISOString().split('T')[0]},price_expiry_date.is.null`)
      .order('quantity_min', { ascending: false })
      .limit(1)
      .maybeSingle();

    return pricing?.unit_price || null;
  } catch (error) {
    console.error('Error getting cached pricing:', error);
    return null;
  }
}

export async function getSSActivewearWholesalePrice(
  style: string,
  color: string,
  _size: string
): Promise<number | null> {
  try {
    console.log(`[SSActivewear] Looking up wholesale price for: ${style}/${color}`);

    const { data: cachedPricing } = await supabase
      .from('ss_catalog_pricing')
      .select('part_number, unit_price')
      .ilike('part_number', `%${style.replace(/[^a-zA-Z0-9]/g, '')}%`)
      .or(`price_expiry_date.gte.${new Date().toISOString().split('T')[0]},price_expiry_date.is.null`)
      .order('quantity_min', { ascending: true })
      .limit(10);

    if (cachedPricing && cachedPricing.length > 0) {
      const price = cachedPricing[0].unit_price;
      console.log(`[SSActivewear] Found cached price for ${style}: $${price}`);
      return price;
    }

    console.log(`[SSActivewear] No cached price found for ${style}/${color}, fetching from API...`);
    const pricingData = await getProductPricing(style, false);

    if (pricingData?.priceArray && pricingData.priceArray.length > 0) {
      const lowestTier = pricingData.priceArray.reduce((lowest, current) => {
        if (!lowest || current.minQuantity < lowest.minQuantity) {
          return current;
        }
        return lowest;
      }, pricingData.priceArray[0]);

      console.log(`[SSActivewear] API returned price for ${style}: $${lowestTier.price}`);
      return lowestTier.price;
    }

    console.log(`[SSActivewear] No price found for ${style}/${color}`);
    return null;
  } catch (error) {
    console.error('[SSActivewear] Error getting wholesale price:', error);
    return null;
  }
}

export async function getProductPricing(partId: string, useCache: boolean = true): Promise<PromoStandardsPricing | null> {
  try {
    if (useCache) {
      const cachedPrice = await getCachedPricing(partId);
      if (cachedPrice !== null) {
        console.log(`Using cached price for ${partId}: $${cachedPrice}`);
        return {
          partId,
          priceArray: [{ minQuantity: 1, price: cachedPrice }],
          currency: 'USD'
        };
      }
      console.log(`No cached price found for ${partId}, fetching from API...`);
    }

    const token = await getAuthToken();

    const response = await fetch(
      `${EDGE_FUNCTION_URL}?action=pricing&productId=${encodeURIComponent(partId)}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'X-User-Token': token,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get pricing');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Pricing lookup failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error getting pricing:', error);
    throw error;
  }
}

export async function getProductInventory(partId: string): Promise<PromoStandardsInventory | null> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${EDGE_FUNCTION_URL}?action=inventory&partId=${encodeURIComponent(partId)}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'X-User-Token': token,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get inventory');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Inventory lookup failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error getting inventory:', error);
    throw error;
  }
}

export async function getProductMedia(partId: string): Promise<PromoStandardsMedia | null> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${EDGE_FUNCTION_URL}?action=media&partId=${encodeURIComponent(partId)}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'X-User-Token': token,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get media');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('Media lookup failed');
    }

    return result.data;
  } catch (error) {
    console.error('Error getting media:', error);
    throw error;
  }
}

export interface ColorOption {
  partId: string;
  colorName: string;
  hex?: string;
  approximatePmsColor?: string;
}

export async function getAllColorsForStyle(styleNumber: string): Promise<ColorOption[]> {
  const product = await lookupProductByStyle(styleNumber);

  if (!product || !product.colors) {
    return [];
  }

  const colorOptions: ColorOption[] = [];

  for (const colorData of product.colors) {
    if (colorData.colors && colorData.colors.length > 0) {
      for (const color of colorData.colors) {
        colorOptions.push({
          partId: colorData.partId,
          colorName: color.colorName,
          hex: color.hex || undefined,
          approximatePmsColor: color.approximatePmsColor || undefined,
        });
      }
    } else {
      colorOptions.push({
        partId: colorData.partId,
        colorName: colorData.colorName,
        hex: undefined,
        approximatePmsColor: undefined,
      });
    }
  }

  return colorOptions;
}

export async function getCompleteProductData(styleNumber: string, partId: string) {
  const [product, pricing, inventory, media] = await Promise.allSettled([
    lookupProductByStyle(styleNumber),
    getProductPricing(partId),
    getProductInventory(partId),
    getProductMedia(partId),
  ]);

  return {
    product: product.status === 'fulfilled' ? product.value : null,
    pricing: pricing.status === 'fulfilled' ? pricing.value : null,
    inventory: inventory.status === 'fulfilled' ? inventory.value : null,
    media: media.status === 'fulfilled' ? media.value : null,
  };
}

export interface UnifiedProductData {
  success: boolean;
  styleNumber: string;
  partId: string | null;
  product: {
    productName: string;
    description: string;
    productBrand: string;
    parts: Array<{
      partId: string;
      colorName: string;
      labelSize: string;
      hex?: string;
      approximatePmsColor?: string;
    }>;
    colors: Array<{
      colorName: string;
      hex?: string;
      approximatePmsColor?: string;
      partIds: Array<{
        partId: string;
        size: string;
      }>;
    }>;
  };
  inventory: {
    items: Array<{
      partId: string;
      quantityAvailable: number;
      warehouseName: string;
      postalCode: string;
    }>;
  };
  pricing: {
    parts: Array<{
      partId: string;
      prices: Array<{
        minQuantity: number;
        price: number;
        discountCode?: string;
      }>;
    }>;
  };
  media: {
    images: Array<{
      url: string;
      partId: string;
      description: string;
      fileType: string;
      classType: string;
      singlePart: boolean;
    }>;
    views: {
      front: string | null;
      rear: string | null;
      side: string | null;
      lifestyle: string | null;
    };
  };
}

export async function getUnifiedProductData(
  styleNumber: string,
  partId?: string
): Promise<UnifiedProductData> {
  try {
    const token = await getAuthToken();

    let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/promostandards-unified?styleNumber=${encodeURIComponent(styleNumber)}`;
    if (partId) {
      url += `&partId=${encodeURIComponent(partId)}`;
    }

    console.log('🔵 Fetching unified product data:', {
      styleNumber,
      partId,
      url,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 30)
    });

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'X-User-Token': token,
        'Content-Type': 'application/json',
      },
    });

    console.log('🔵 Unified API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔴 Unified API error response:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
        console.error('🔴 Parsed error:', error);
      } catch {
        error = { error: errorText };
      }
      throw new Error(error.error || error.message || `Failed to fetch unified product data: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Unified API response data:', result);

    if (!result.success) {
      throw new Error('Unified product data fetch failed: ' + JSON.stringify(result));
    }

    return result;
  } catch (error: any) {
    console.error('Error fetching unified product data:', {
      message: error.message,
      styleNumber,
      partId,
      error
    });
    throw error;
  }
}

export interface PartPricing {
  partId: string;
  price: number;
  warehouse: string;
}

export interface StylePricingResult {
  success: boolean;
  styleNumber: string;
  parts: PartPricing[];
  error?: string;
}

export async function fetchLiveSSActivewearPricing(
  styleNumber: string,
  companyId?: string
): Promise<StylePricingResult> {
  try {
    const token = await getAuthToken();

    let url = `${EDGE_FUNCTION_URL}?action=pricing&productId=${encodeURIComponent(styleNumber)}`;
    if (companyId) {
      url += `&companyId=${encodeURIComponent(companyId)}`;
    }

    console.log(`[SSA Live Pricing] Fetching pricing for style: ${styleNumber}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'X-User-Token': token,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[SSA Live Pricing] API error for ${styleNumber}:`, errorData);
      return {
        success: false,
        styleNumber,
        parts: [],
        error: errorData.error || `HTTP ${response.status}`
      };
    }

    const result = await response.json();

    if (!result.success || !result.data || result.data.length === 0) {
      console.warn(`[SSA Live Pricing] No pricing data for ${styleNumber}:`, result.error || 'No parts returned');
      return {
        success: false,
        styleNumber,
        parts: [],
        error: result.error || result.errorDetails || 'No pricing data available'
      };
    }

    const parts: PartPricing[] = result.data.map((part: any) => {
      const lowestTier = part.prices && part.prices.length > 0
        ? part.prices.reduce((lowest: any, current: any) => {
            if (!lowest || current.quantity < lowest.quantity) return current;
            return lowest;
          }, part.prices[0])
        : { price: 0 };

      return {
        partId: part.partId,
        price: lowestTier.price || 0,
        warehouse: part.warehouse || 'unknown'
      };
    });

    console.log(`[SSA Live Pricing] Found ${parts.length} parts for ${styleNumber}:`,
      parts.slice(0, 3).map(p => `${p.partId}: $${p.price}`).join(', ') + (parts.length > 3 ? '...' : '')
    );

    return {
      success: true,
      styleNumber,
      parts
    };
  } catch (error: any) {
    console.error(`[SSA Live Pricing] Exception for ${styleNumber}:`, error);
    return {
      success: false,
      styleNumber,
      parts: [],
      error: error.message || 'Network error'
    };
  }
}

export async function fetchLiveSanMarPricing(
  styleNumber: string,
  companyId?: string
): Promise<StylePricingResult> {
  const SANMAR_EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sanmar-api`;

  try {
    const token = await getAuthToken();

    let url = `${SANMAR_EDGE_URL}?action=pricing&style=${encodeURIComponent(styleNumber)}`;
    if (companyId) {
      url += `&companyId=${encodeURIComponent(companyId)}`;
    }

    console.log(`[SanMar Live Pricing] Fetching pricing for style: ${styleNumber}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'X-User-Token': token,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[SanMar Live Pricing] API error for ${styleNumber}:`, errorData);
      return {
        success: false,
        styleNumber,
        parts: [],
        error: errorData.error || `HTTP ${response.status}`
      };
    }

    const result = await response.json();

    const pricingParts: any[] = result.data?.parts || result.parts || [];

    if (!result.success || pricingParts.length === 0) {
      console.warn(`[SanMar Live Pricing] No pricing data for ${styleNumber}:`, result.error || 'No parts returned');
      return {
        success: false,
        styleNumber,
        parts: [],
        error: result.error || 'No pricing data available'
      };
    }

    const parts: PartPricing[] = pricingParts.map((part: any) => {
      const lowestTier = part.prices && part.prices.length > 0
        ? part.prices.reduce((lowest: any, current: any) => {
            const lq = current.minQuantity ?? current.quantity ?? 999999;
            const ll = lowest.minQuantity ?? lowest.quantity ?? 999999;
            return lq < ll ? current : lowest;
          }, part.prices[0])
        : { price: part.price || 0 };

      return {
        partId: part.partId || part.part_id || '',
        price: lowestTier.price || part.price || 0,
        warehouse: part.warehouse || 'sanmar'
      };
    });

    console.log(`[SanMar Live Pricing] Found ${parts.length} parts for ${styleNumber}:`,
      parts.slice(0, 3).map(p => `${p.partId}: $${p.price}`).join(', ') + (parts.length > 3 ? '...' : '')
    );

    return {
      success: true,
      styleNumber,
      parts
    };
  } catch (error: any) {
    console.error(`[SanMar Live Pricing] Exception for ${styleNumber}:`, error);
    return {
      success: false,
      styleNumber,
      parts: [],
      error: error.message || 'Network error'
    };
  }
}

export async function getSanMarWholesalePrice(
  style: string,
  color: string,
  _size?: string
): Promise<number | null> {
  try {
    console.log(`[SanMar] Looking up wholesale price for: ${style}/${color}`);

    const { data: cacheData } = await supabase
      .from('sanmar_pricing_cache')
      .select('data')
      .eq('cache_key', style)
      .eq('cache_type', 'pricing')
      .maybeSingle();

    if (cacheData?.data) {
      const pricingData = cacheData.data as any;

      if (pricingData.parts && Array.isArray(pricingData.parts)) {
        for (const part of pricingData.parts) {
          if (part.colorName?.toLowerCase() === color.toLowerCase() && part.prices?.length > 0) {
            const lowestTier = part.prices.reduce((lowest: any, current: any) => {
              if (!lowest || current.minQuantity < lowest.minQuantity) return current;
              return lowest;
            }, part.prices[0]);
            console.log(`[SanMar] Found cached price for ${style}/${color}: $${lowestTier.price}`);
            return lowestTier.price;
          }
        }
      }

      if (pricingData.price) {
        console.log(`[SanMar] Found cached base price for ${style}: $${pricingData.price}`);
        return pricingData.price;
      }
    }

    const { data: productCache } = await supabase
      .from('sanmar_product_cache')
      .select('data')
      .eq('cache_key', style)
      .eq('cache_type', 'product')
      .maybeSingle();

    if (productCache?.data) {
      const productData = productCache.data as any;
      if (productData.pricing?.piecePrice) {
        console.log(`[SanMar] Found price in product cache: $${productData.pricing.piecePrice}`);
        return productData.pricing.piecePrice;
      }
    }

    console.log(`[SanMar] No cached price found for ${style}/${color}`);
    return null;
  } catch (error) {
    console.error('[SanMar] Error getting wholesale price:', error);
    return null;
  }
}
