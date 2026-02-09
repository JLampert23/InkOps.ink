/**
 * SanMar Unified Service
 *
 * Aggregates data from all SanMar PromoStandards services:
 * - Product Data Service (style info, variants, metadata)
 * - Media Service (images, spec sheets, color swatches)
 * - Pricing Service (prices, price breaks, MAP compliance)
 * - Inventory Service (stock levels, availability)
 *
 * Provides unified access to complete garment information
 */

import { getStyle, getStyleVariants, getProductMetadata } from './sanmar-product-data-service';
import { getMediaForStyle, getMediaForVariant } from './sanmar-media-service';
import { getPricing } from './sanmar-pricing-service';
import { getInventory, getStyleInventory } from './sanmar-inventory-service';
import { getSanMarCredentials } from './sanmar-promo-client';

interface UnifiedGarment {
  vendor: string;
  style: string;
  color: string;
  size: string;
  product: {
    partId?: string;
    description?: string;
    gtin?: string;
    status?: string;
    features?: string[];
    category?: string;
    subcategory?: string;
    labelSize?: string;
    colorName?: string;
  };
  pricing: {
    piecePrice?: number;
    casePrice?: number;
    msrp?: number;
    mapPrice?: number;
    priceBreaks?: Array<{ quantity: number; price: number }>;
    currency?: string;
  };
  inventory: {
    totalAvailable: number;
    inventoryLevels: Array<{
      partId: string;
      warehouse: string;
      quantityAvailable: number;
      availableDate?: string;
      leadTime?: number;
    }>;
  };
  media: {
    frontModel?: string;
    backModel?: string;
    frontFlat?: string;
    backFlat?: string;
    colorSwatch?: string;
    thumbnail?: string;
    specSheet?: string;
    measurementSheet?: string;
    additionalImages?: string[];
  };
  lastUpdated: string;
}

interface UnifiedStyle {
  vendor: string;
  style: string;
  description: string;
  category: string;
  subcategory: string;
  status: string;
  features: string[];
  companionStyles: string[];
  variants: UnifiedGarment[];
  media: {
    frontModel?: string;
    backModel?: string;
    frontFlat?: string;
    backFlat?: string;
    thumbnail?: string;
    specSheet?: string;
    measurementSheet?: string;
    additionalImages?: string[];
  };
  lastUpdated: string;
}

/**
 * Get complete unified data for a specific garment SKU
 */
export async function getUnifiedGarment(
  style: string,
  color: string,
  size: string
): Promise<UnifiedGarment | null> {
  try {
    console.log(`[SanMarUnified] Fetching unified garment data for ${style}/${color}/${size}`);

    const credentials = await getSanMarCredentials();
    const { data: profile } = await import('../lib/supabase-client').then(m =>
      m.supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) throw new Error('Not authenticated');
        return m.supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', session.user.id)
          .maybeSingle();
      })
    );

    if (!profile?.company_id) {
      throw new Error('Company not found');
    }

    const companyId = profile.company_id;

    const [productData, pricingData, inventoryData, mediaData] = await Promise.allSettled([
      getProductMetadata(style, color, size, credentials, companyId),
      getPricing(style, color, size, credentials, companyId),
      getInventory(style, color, size, credentials, companyId),
      getMediaForVariant(style, color, credentials, companyId),
    ]);

    const product = productData.status === 'fulfilled' ? productData.value : null;
    const pricing = pricingData.status === 'fulfilled' ? pricingData.value : null;
    const inventory = inventoryData.status === 'fulfilled' ? inventoryData.value : null;
    const media = mediaData.status === 'fulfilled' ? mediaData.value : null;

    const unified: UnifiedGarment = {
      vendor: 'SanMar',
      style,
      color,
      size,
      product: {
        partId: product?.partId,
        description: product?.description,
        gtin: product?.gtin,
        status: product?.status || 'Unknown',
        features: product?.features || [],
        category: product?.category,
        subcategory: product?.subcategory,
        labelSize: product?.labelSize,
        colorName: product?.colorName,
      },
      pricing: {
        piecePrice: pricing?.piecePrice,
        casePrice: pricing?.casePrice,
        msrp: pricing?.msrp,
        mapPrice: pricing?.mapPrice,
        priceBreaks: pricing?.priceBreaks,
        currency: pricing?.currency || 'USD',
      },
      inventory: {
        totalAvailable: inventory?.totalAvailable || 0,
        inventoryLevels: inventory?.inventoryLevels || [],
      },
      media: {
        frontModel: media?.frontModel,
        backModel: media?.backModel,
        frontFlat: media?.frontFlat,
        backFlat: media?.backFlat,
        colorSwatch: media?.colorSwatch,
        thumbnail: media?.thumbnail,
        specSheet: media?.specSheet,
        measurementSheet: media?.measurementSheet,
        additionalImages: media?.additionalImages,
      },
      lastUpdated: new Date().toISOString(),
    };

    console.log(`[SanMarUnified] Successfully fetched unified garment data for ${style}/${color}/${size}`);

    return unified;
  } catch (error) {
    console.error(`[SanMarUnified] Error fetching unified garment for ${style}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get complete unified data for all variants of a style
 */
export async function getUnifiedStyle(style: string): Promise<UnifiedStyle | null> {
  try {
    console.log(`[SanMarUnified] Fetching unified style data for ${style}`);

    const credentials = await getSanMarCredentials();
    const { data: profile } = await import('../lib/supabase-client').then(m =>
      m.supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) throw new Error('Not authenticated');
        return m.supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', session.user.id)
          .maybeSingle();
      })
    );

    if (!profile?.company_id) {
      throw new Error('Company not found');
    }

    const companyId = profile.company_id;

    const [styleData, variantsData, mediaData, inventoryData] = await Promise.allSettled([
      getStyle(style, credentials, companyId),
      getStyleVariants(style, credentials, companyId),
      getMediaForStyle(style, credentials, companyId),
      getStyleInventory(style, credentials, companyId),
    ]);

    const styleInfo = styleData.status === 'fulfilled' ? styleData.value : null;
    const variants = variantsData.status === 'fulfilled' ? variantsData.value : [];
    const styleMedia = mediaData.status === 'fulfilled' ? mediaData.value : null;
    const styleInventory = inventoryData.status === 'fulfilled' ? inventoryData.value : null;

    if (!styleInfo) {
      console.error(`[SanMarUnified] Failed to fetch style info for ${style}`);
      return null;
    }

    const unifiedVariants: UnifiedGarment[] = [];

    for (const variant of variants) {
      const [variantPricing, variantMedia] = await Promise.allSettled([
        getPricing(variant.style, variant.color, variant.size, credentials, companyId),
        getMediaForVariant(variant.style, variant.color, credentials, companyId),
      ]);

      const pricing = variantPricing.status === 'fulfilled' ? variantPricing.value : null;
      const media = variantMedia.status === 'fulfilled' ? variantMedia.value : null;

      const inventoryForVariant = styleInventory?.inventoryLevels.filter(
        level => level.partId === variant.partId
      ) || [];

      const totalAvailable = inventoryForVariant.reduce(
        (sum, level) => sum + level.quantityAvailable,
        0
      );

      unifiedVariants.push({
        vendor: 'SanMar',
        style: variant.style,
        color: variant.color,
        size: variant.size,
        product: {
          partId: variant.partId,
          description: styleInfo.description,
          gtin: variant.gtin,
          status: variant.status,
          features: styleInfo.features,
          category: styleInfo.category,
          subcategory: styleInfo.subcategory,
          labelSize: variant.labelSize,
          colorName: variant.colorName,
        },
        pricing: {
          piecePrice: pricing?.piecePrice,
          casePrice: pricing?.casePrice,
          msrp: pricing?.msrp,
          mapPrice: pricing?.mapPrice,
          priceBreaks: pricing?.priceBreaks,
          currency: pricing?.currency || 'USD',
        },
        inventory: {
          totalAvailable,
          inventoryLevels: inventoryForVariant,
        },
        media: {
          frontModel: media?.frontModel || styleMedia?.frontModel,
          backModel: media?.backModel || styleMedia?.backModel,
          frontFlat: media?.frontFlat || styleMedia?.frontFlat,
          backFlat: media?.backFlat || styleMedia?.backFlat,
          colorSwatch: media?.colorSwatch,
          thumbnail: media?.thumbnail || styleMedia?.thumbnail,
          specSheet: styleMedia?.specSheet,
          measurementSheet: styleMedia?.measurementSheet,
          additionalImages: media?.additionalImages || styleMedia?.additionalImages,
        },
        lastUpdated: new Date().toISOString(),
      });
    }

    const unified: UnifiedStyle = {
      vendor: 'SanMar',
      style,
      description: styleInfo.description,
      category: styleInfo.category,
      subcategory: styleInfo.subcategory,
      status: styleInfo.status,
      features: styleInfo.features,
      companionStyles: styleInfo.companionStyles,
      variants: unifiedVariants,
      media: {
        frontModel: styleMedia?.frontModel,
        backModel: styleMedia?.backModel,
        frontFlat: styleMedia?.frontFlat,
        backFlat: styleMedia?.backFlat,
        thumbnail: styleMedia?.thumbnail,
        specSheet: styleMedia?.specSheet,
        measurementSheet: styleMedia?.measurementSheet,
        additionalImages: styleMedia?.additionalImages,
      },
      lastUpdated: new Date().toISOString(),
    };

    console.log(`[SanMarUnified] Successfully fetched unified style data for ${style} with ${unifiedVariants.length} variants`);

    return unified;
  } catch (error) {
    console.error(`[SanMarUnified] Error fetching unified style for ${style}:`, error);
    return null;
  }
}

/**
 * Get quick summary for a garment (without full media and variant details)
 */
export async function getQuickGarmentSummary(
  style: string,
  color: string,
  size: string
): Promise<{
  style: string;
  color: string;
  size: string;
  price: number | null;
  available: number;
  status: string;
} | null> {
  try {
    const credentials = await getSanMarCredentials();
    const { data: profile } = await import('../lib/supabase-client').then(m =>
      m.supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) throw new Error('Not authenticated');
        return m.supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', session.user.id)
          .maybeSingle();
      })
    );

    if (!profile?.company_id) {
      throw new Error('Company not found');
    }

    const companyId = profile.company_id;

    const [pricingData, inventoryData, productData] = await Promise.allSettled([
      getPricing(style, color, size, credentials, companyId),
      getInventory(style, color, size, credentials, companyId),
      getProductMetadata(style, color, size, credentials, companyId),
    ]);

    const pricing = pricingData.status === 'fulfilled' ? pricingData.value : null;
    const inventory = inventoryData.status === 'fulfilled' ? inventoryData.value : null;
    const product = productData.status === 'fulfilled' ? productData.value : null;

    return {
      style,
      color,
      size,
      price: pricing?.piecePrice || null,
      available: inventory?.totalAvailable || 0,
      status: product?.status || 'Unknown',
    };
  } catch (error) {
    console.error(`[SanMarUnified] Error fetching quick summary for ${style}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Batch fetch unified garments for multiple SKUs
 */
export async function batchGetUnifiedGarments(
  skus: Array<{ style: string; color: string; size: string }>
): Promise<Map<string, UnifiedGarment>> {
  const results = new Map<string, UnifiedGarment>();

  await Promise.all(
    skus.map(async ({ style, color, size }) => {
      const unified = await getUnifiedGarment(style, color, size);
      if (unified) {
        results.set(`${style}:${color}:${size}`, unified);
      }
    })
  );

  return results;
}

/**
 * Check if garment is available and in stock
 */
export async function isGarmentAvailable(
  style: string,
  color: string,
  size: string,
  minQuantity: number = 1
): Promise<{ available: boolean; quantity: number; price: number | null }> {
  try {
    const credentials = await getSanMarCredentials();
    const { data: profile } = await import('../lib/supabase-client').then(m =>
      m.supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) throw new Error('Not authenticated');
        return m.supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', session.user.id)
          .maybeSingle();
      })
    );

    if (!profile?.company_id) {
      throw new Error('Company not found');
    }

    const companyId = profile.company_id;

    const [inventoryData, pricingData] = await Promise.allSettled([
      getInventory(style, color, size, credentials, companyId),
      getPricing(style, color, size, credentials, companyId),
    ]);

    const inventory = inventoryData.status === 'fulfilled' ? inventoryData.value : null;
    const pricing = pricingData.status === 'fulfilled' ? pricingData.value : null;

    const quantity = inventory?.totalAvailable || 0;
    const available = quantity >= minQuantity;

    return {
      available,
      quantity,
      price: pricing?.piecePrice || null,
    };
  } catch (error) {
    console.error(`[SanMarUnified] Error checking availability for ${style}/${color}/${size}:`, error);
    return {
      available: false,
      quantity: 0,
      price: null,
    };
  }
}

/**
 * Get all available colors for a style
 */
export async function getAvailableColors(style: string): Promise<string[]> {
  try {
    const credentials = await getSanMarCredentials();
    const { data: profile } = await import('../lib/supabase-client').then(m =>
      m.supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) throw new Error('Not authenticated');
        return m.supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', session.user.id)
          .maybeSingle();
      })
    );

    if (!profile?.company_id) {
      throw new Error('Company not found');
    }

    const companyId = profile.company_id;

    const variants = await getStyleVariants(style, credentials, companyId);

    const uniqueColors = Array.from(new Set(variants.map(v => v.color)));

    return uniqueColors;
  } catch (error) {
    console.error(`[SanMarUnified] Error getting available colors for ${style}:`, error);
    return [];
  }
}

/**
 * Get all available sizes for a style and color
 */
export async function getAvailableSizes(style: string, color: string): Promise<string[]> {
  try {
    const credentials = await getSanMarCredentials();
    const { data: profile } = await import('../lib/supabase-client').then(m =>
      m.supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) throw new Error('Not authenticated');
        return m.supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', session.user.id)
          .maybeSingle();
      })
    );

    if (!profile?.company_id) {
      throw new Error('Company not found');
    }

    const companyId = profile.company_id;

    const variants = await getStyleVariants(style, credentials, companyId);

    const sizes = variants
      .filter(v => v.color === color)
      .map(v => v.size);

    return sizes;
  } catch (error) {
    console.error(`[SanMarUnified] Error getting available sizes for ${style}/${color}:`, error);
    return [];
  }
}
