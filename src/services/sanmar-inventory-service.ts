/**
 * SanMar Inventory Service
 *
 * Fetches and normalizes inventory data from SanMar PromoStandards API
 * - Uses sanmarPromoClient for SOAP requests
 * - Caches results in Supabase for 1 hour (inventory changes frequently)
 * - Normalizes inventory fields for consistent structure
 */

import { supabase } from '../lib/supabase-client';
import { callService } from './sanmar-promo-client';

interface SanMarCredentials {
  username: string;
  password: string;
}

interface InventoryLevel {
  partId: string;
  warehouse: string;
  quantityAvailable: number;
  availableDate?: string;
  leadTime?: number;
}

interface NormalizedInventory {
  style: string;
  color?: string;
  size?: string;
  partId?: string;
  inventoryLevels: InventoryLevel[];
  totalAvailable: number;
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

const CACHE_DURATION_HOURS = 1;
const CACHE_TABLE = 'sanmar_inventory_cache';

/**
 * Get inventory for a specific SKU
 */
export async function getInventory(
  styleNumber: string,
  color: string,
  size: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<NormalizedInventory | null> {
  try {
    const cacheKey = `inventory:${styleNumber}:${color}:${size}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarInventory] Cache hit for ${styleNumber}/${color}/${size}`);
      return cached as NormalizedInventory;
    }

    console.log(`[SanMarInventory] Fetching inventory for ${styleNumber}/${color}/${size}`);

    const response = await callService({
      serviceType: 'Inventory',
      operation: 'getInventoryLevels',
      payload: {
        productId: styleNumber,
        partId: `${color}-${size}`,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarInventory] Failed to fetch inventory for ${styleNumber}/${color}/${size}:`, response.error);
      return null;
    }

    const normalized = normalizeInventoryData(styleNumber, color, size, response.data);

    await cacheData(cacheKey, 'inventory', normalized, companyId);

    return normalized;
  } catch (error) {
    console.error(`[SanMarInventory] Error fetching inventory for ${styleNumber}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get inventory for all variants of a style
 */
export async function getStyleInventory(
  styleNumber: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<NormalizedInventory | null> {
  try {
    const cacheKey = `inventory:${styleNumber}:all`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarInventory] Cache hit for style ${styleNumber}`);
      return cached as NormalizedInventory;
    }

    console.log(`[SanMarInventory] Fetching inventory for style ${styleNumber}`);

    const response = await callService({
      serviceType: 'Inventory',
      operation: 'getInventoryLevels',
      payload: {
        productId: styleNumber,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarInventory] Failed to fetch inventory for style ${styleNumber}:`, response.error);
      return null;
    }

    const normalized = normalizeInventoryData(styleNumber, undefined, undefined, response.data);

    await cacheData(cacheKey, 'inventory', normalized, companyId);

    return normalized;
  } catch (error) {
    console.error(`[SanMarInventory] Error fetching inventory for style ${styleNumber}:`, error);
    return null;
  }
}

/**
 * Get inventory date modified
 */
export async function getInventoryDateModified(
  styleNumber: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<{ style: string; dateModified: string } | null> {
  try {
    const cacheKey = `inventory_date_modified:${styleNumber}`;

    const cached = await getCachedData(cacheKey, companyId);
    if (cached) {
      console.log(`[SanMarInventory] Cache hit for date modified ${styleNumber}`);
      return cached as { style: string; dateModified: string };
    }

    console.log(`[SanMarInventory] Fetching inventory date modified for ${styleNumber}`);

    const response = await callService({
      serviceType: 'Inventory',
      operation: 'getInventoryDateModified',
      payload: {
        productId: styleNumber,
        localizationCountry: 'US',
        localizationLanguage: 'en',
      },
      credentials,
    });

    if (!response.success || !response.data) {
      console.error(`[SanMarInventory] Failed to fetch date modified for ${styleNumber}:`, response.error);
      return null;
    }

    const result = {
      style: styleNumber,
      dateModified: response.data.dateModified || new Date().toISOString(),
    };

    await cacheData(cacheKey, 'date_modified', result, companyId);

    return result;
  } catch (error) {
    console.error(`[SanMarInventory] Error fetching inventory date modified for ${styleNumber}:`, error);
    return null;
  }
}

/**
 * Normalize inventory data from PromoStandards response
 */
function normalizeInventoryData(
  styleNumber: string,
  color?: string,
  size?: string,
  data?: any
): NormalizedInventory {
  const inventoryLevels: InventoryLevel[] = [];

  if (data && data.Inventory) {
    const inventoryArray = Array.isArray(data.Inventory) ? data.Inventory : [data.Inventory];

    for (const inv of inventoryArray) {
      if (!inv) continue;

      const partId = inv.partId || inv.PartId || '';
      const warehouse = inv.warehouseCode || inv.WarehouseCode || 'default';
      const quantityAvailable = parseInt(inv.quantityAvailable || inv.QuantityAvailable || '0', 10);
      const availableDate = inv.availableDate || inv.AvailableDate;
      const leadTime = inv.leadTime || inv.LeadTime ? parseInt(inv.leadTime || inv.LeadTime, 10) : undefined;

      inventoryLevels.push({
        partId,
        warehouse,
        quantityAvailable,
        availableDate,
        leadTime,
      });
    }
  } else if (data && data.InventoryArray) {
    const inventoryArray = Array.isArray(data.InventoryArray) ? data.InventoryArray : [data.InventoryArray];

    for (const inv of inventoryArray) {
      if (!inv) continue;

      inventoryLevels.push({
        partId: inv.partId || inv.PartId || '',
        warehouse: inv.warehouse || inv.Warehouse || 'default',
        quantityAvailable: parseInt(inv.quantityAvailable || inv.QuantityAvailable || '0', 10),
        availableDate: inv.availableDate || inv.AvailableDate,
        leadTime: inv.leadTime || inv.LeadTime ? parseInt(inv.leadTime || inv.LeadTime, 10) : undefined,
      });
    }
  }

  const totalAvailable = inventoryLevels.reduce((sum, level) => sum + level.quantityAvailable, 0);

  return {
    style: styleNumber,
    color,
    size,
    partId: color && size ? `${color}-${size}` : undefined,
    inventoryLevels,
    totalAvailable,
    lastModified: data?.lastModified || data?.LastModified,
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
      console.error('[SanMarInventory] Cache read error:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.log(`[SanMarInventory] Cache expired for ${cacheKey}`);
      await supabase
        .from(CACHE_TABLE)
        .delete()
        .eq('cache_key', cacheKey)
        .eq('company_id', companyId);

      return null;
    }

    return data.data;
  } catch (error) {
    console.error('[SanMarInventory] Cache read error:', error);
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
      console.error('[SanMarInventory] Cache write error:', error);
    } else {
      console.log(`[SanMarInventory] Cached ${cacheKey} until ${expiresAt.toISOString()}`);
    }
  } catch (error) {
    console.error('[SanMarInventory] Cache write error:', error);
  }
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredInventoryCache(): Promise<number> {
  try {
    const now = new Date().toISOString();

    const { error, count } = await supabase
      .from(CACHE_TABLE)
      .delete()
      .lt('expires_at', now);

    if (error) {
      console.error('[SanMarInventory] Failed to clear expired cache:', error);
      return 0;
    }

    console.log(`[SanMarInventory] Cleared ${count || 0} expired cache entries`);
    return count || 0;
  } catch (error) {
    console.error('[SanMarInventory] Error clearing cache:', error);
    return 0;
  }
}

/**
 * Clear all inventory cache for a company
 */
export async function clearCompanyInventoryCache(companyId: string): Promise<number> {
  try {
    const { error, count } = await supabase
      .from(CACHE_TABLE)
      .delete()
      .eq('company_id', companyId);

    if (error) {
      console.error('[SanMarInventory] Failed to clear company cache:', error);
      return 0;
    }

    console.log(`[SanMarInventory] Cleared ${count || 0} inventory cache entries for company ${companyId}`);
    return count || 0;
  } catch (error) {
    console.error('[SanMarInventory] Error clearing company cache:', error);
    return 0;
  }
}

/**
 * Clear specific style inventory cache
 */
export async function clearStyleInventoryCache(styleNumber: string, companyId: string): Promise<void> {
  try {
    await supabase
      .from(CACHE_TABLE)
      .delete()
      .eq('company_id', companyId)
      .like('cache_key', `%${styleNumber}%`);

    console.log(`[SanMarInventory] Cleared inventory cache for style ${styleNumber}`);
  } catch (error) {
    console.error('[SanMarInventory] Error clearing style inventory cache:', error);
  }
}

/**
 * Check if a SKU is in stock
 */
export async function isInStock(
  styleNumber: string,
  color: string,
  size: string,
  minQuantity: number = 1,
  credentials: SanMarCredentials,
  companyId: string
): Promise<boolean> {
  try {
    const inventory = await getInventory(styleNumber, color, size, credentials, companyId);

    if (!inventory) {
      return false;
    }

    return inventory.totalAvailable >= minQuantity;
  } catch (error) {
    console.error(`[SanMarInventory] Error checking stock:`, error);
    return false;
  }
}

/**
 * Get available quantity for a SKU
 */
export async function getAvailableQuantity(
  styleNumber: string,
  color: string,
  size: string,
  credentials: SanMarCredentials,
  companyId: string
): Promise<number> {
  try {
    const inventory = await getInventory(styleNumber, color, size, credentials, companyId);

    if (!inventory) {
      return 0;
    }

    return inventory.totalAvailable;
  } catch (error) {
    console.error(`[SanMarInventory] Error getting available quantity:`, error);
    return 0;
  }
}

/**
 * Batch check inventory for multiple SKUs
 */
export async function batchGetInventory(
  skus: Array<{ style: string; color: string; size: string }>,
  credentials: SanMarCredentials,
  companyId: string
): Promise<Map<string, NormalizedInventory>> {
  const results = new Map<string, NormalizedInventory>();

  await Promise.all(
    skus.map(async ({ style, color, size }) => {
      const inventory = await getInventory(style, color, size, credentials, companyId);
      if (inventory) {
        results.set(`${style}:${color}:${size}`, inventory);
      }
    })
  );

  return results;
}
