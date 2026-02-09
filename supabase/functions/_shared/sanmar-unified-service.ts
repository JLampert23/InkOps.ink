/**
 * SanMar Unified Service for Edge Functions
 *
 * Aggregates data from SanMar PromoStandards services ONLY.
 * NO Standard Web Services. NO FTP. NO customer number authentication.
 *
 * Authentication: id/password in SOAP body per PromoStandards spec.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  fetchSanMarProductData,
  fetchSanMarInventory,
  fetchSanMarPricing,
  fetchSanMarMedia,
  fetchUnifiedSanMarData,
  type SanMarCredentials,
  type SanMarUnifiedResponse,
} from './sanmar-promostandards-client.ts';

interface UnifiedGarment {
  vendor: string;
  style: string;
  color: string;
  size: string;
  product: {
    partId?: string;
    description?: string;
    status?: string;
    features?: string[];
    category?: string;
    subcategory?: string;
    labelSize?: string;
    colorName?: string;
  };
  pricing: {
    piecePrice?: number;
    priceBreaks?: Array<{ quantity: number; price: number }>;
    currency?: string;
  };
  inventory: {
    totalAvailable: number;
    inventoryLevels: Array<{
      partId: string;
      warehouse: string;
      quantityAvailable: number;
    }>;
  };
  media: {
    frontModel?: string;
    backModel?: string;
    frontFlat?: string;
    backFlat?: string;
    colorSwatch?: string;
    thumbnail?: string;
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
  variants: UnifiedGarment[];
  media: {
    frontModel?: string;
    backModel?: string;
    frontFlat?: string;
    backFlat?: string;
    thumbnail?: string;
    additionalImages?: string[];
  };
  lastUpdated: string;
}

/**
 * Get SanMar credentials from company settings
 * Uses PromoStandards authentication: id/password
 */
async function getSanMarCredentials(companyId: string): Promise<SanMarCredentials> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase
    .from('company_settings')
    .select('sanmar_promo_username, sanmar_promo_password_encrypted')
    .eq('id', companyId)
    .maybeSingle();

  if (error || !data?.sanmar_promo_username || !data?.sanmar_promo_password_encrypted) {
    throw new Error('SanMar PromoStandards credentials not configured');
  }

  // Decrypt password using crypto service
  const decryptResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/crypto-service`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      action: 'decrypt',
      token: data.sanmar_promo_password_encrypted,
    }),
  });

  if (!decryptResponse.ok) {
    throw new Error('Failed to decrypt SanMar credentials');
  }

  const { result: decryptedPassword } = await decryptResponse.json();

  return {
    id: data.sanmar_promo_username,
    password: decryptedPassword,
  };
}

/**
 * Get complete unified data for a specific garment SKU
 */
export async function getUnifiedGarment(
  style: string,
  color: string,
  size: string,
  companyId: string
): Promise<UnifiedGarment | null> {
  try {
    const credentials = await getSanMarCredentials(companyId);

    // Fetch product data first to get the correct partId
    const productData = await fetchSanMarProductData(credentials, style);

    // Find the matching part for this color/size combination
    const matchingPart = productData.parts.find(
      p => p.colorName === color && p.labelSize === size
    );

    if (!matchingPart) {
      console.warn(`No matching part found for ${style}/${color}/${size}`);
      return null;
    }

    const partId = matchingPart.partId;

    // Fetch pricing, inventory, and media in parallel
    const [pricingResult, inventoryResult, mediaResult] = await Promise.allSettled([
      fetchSanMarPricing(credentials, partId),
      fetchSanMarInventory(credentials, partId),
      fetchSanMarMedia(credentials, style, partId),
    ]);

    const pricing = pricingResult.status === 'fulfilled' ? pricingResult.value : null;
    const inventory = inventoryResult.status === 'fulfilled' ? inventoryResult.value : null;
    const media = mediaResult.status === 'fulfilled' ? mediaResult.value : null;

    return {
      vendor: 'SanMar',
      style,
      color,
      size,
      product: {
        partId,
        description: productData.productName,
        status: 'Active',
        features: [],
        category: productData.productCategory,
        subcategory: '',
        labelSize: size,
        colorName: color,
      },
      pricing: {
        piecePrice: pricing?.parts[0]?.prices[0]?.price,
        priceBreaks: pricing?.parts[0]?.prices.map(p => ({
          quantity: p.minQuantity,
          price: p.price
        })) || [],
        currency: 'USD',
      },
      inventory: {
        totalAvailable: inventory?.items.reduce((sum, item) => sum + item.quantityAvailable, 0) || 0,
        inventoryLevels: inventory?.items.map(item => ({
          partId: item.partId,
          warehouse: item.warehouseName,
          quantityAvailable: item.quantityAvailable,
        })) || [],
      },
      media: {
        frontModel: media?.views.front || undefined,
        backModel: media?.views.rear || undefined,
        frontFlat: media?.views.frontImages[0] || undefined,
        backFlat: media?.views.rearImages[0] || undefined,
        thumbnail: media?.views.front || undefined,
        additionalImages: media?.images.map(img => img.url) || [],
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching unified garment for ${style}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get complete unified data for all variants of a style
 */
export async function getUnifiedStyle(
  style: string,
  companyId: string
): Promise<UnifiedStyle | null> {
  try {
    const credentials = await getSanMarCredentials(companyId);

    const unifiedData = await fetchUnifiedSanMarData(credentials, { styleNumber: style });

    const variants: UnifiedGarment[] = [];

    // Create variants for each part
    for (const part of unifiedData.style.parts) {
      variants.push({
        vendor: 'SanMar',
        style,
        color: part.colorName,
        size: part.labelSize,
        product: {
          partId: part.partId,
          description: unifiedData.style.productName,
          status: 'Active',
          features: [],
          category: unifiedData.style.productCategory,
          subcategory: '',
          labelSize: part.labelSize,
          colorName: part.colorName,
        },
        pricing: {
          piecePrice: unifiedData.pricing.parts.find(p => p.partId === part.partId)?.prices[0]?.price,
          priceBreaks: unifiedData.pricing.parts.find(p => p.partId === part.partId)?.prices.map(p => ({
            quantity: p.minQuantity,
            price: p.price
          })) || [],
          currency: 'USD',
        },
        inventory: {
          totalAvailable: unifiedData.inventory.items
            .filter(i => i.partId === part.partId)
            .reduce((sum, item) => sum + item.quantityAvailable, 0),
          inventoryLevels: unifiedData.inventory.items
            .filter(i => i.partId === part.partId)
            .map(item => ({
              partId: item.partId,
              warehouse: item.warehouseName,
              quantityAvailable: item.quantityAvailable,
            })),
        },
        media: {
          frontModel: unifiedData.media.views.front || undefined,
          backModel: unifiedData.media.views.rear || undefined,
          frontFlat: unifiedData.media.views.frontImages[0] || undefined,
          backFlat: unifiedData.media.views.rearImages[0] || undefined,
          thumbnail: unifiedData.media.views.front || undefined,
          additionalImages: unifiedData.media.images.map(img => img.url),
        },
        lastUpdated: new Date().toISOString(),
      });
    }

    return {
      vendor: 'SanMar',
      style,
      description: unifiedData.style.productName,
      category: unifiedData.style.productCategory,
      subcategory: '',
      status: 'Active',
      features: [],
      variants,
      media: {
        frontModel: unifiedData.media.views.front || undefined,
        backModel: unifiedData.media.views.rear || undefined,
        frontFlat: unifiedData.media.views.frontImages[0] || undefined,
        backFlat: unifiedData.media.views.rearImages[0] || undefined,
        thumbnail: unifiedData.media.views.front || undefined,
        additionalImages: unifiedData.media.images.map(img => img.url),
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching unified style for ${style}:`, error);
    return null;
  }
}

/**
 * Get pricing only for a garment
 */
export async function getGarmentPricing(
  style: string,
  color: string,
  size: string,
  companyId: string
): Promise<UnifiedGarment['pricing'] | null> {
  try {
    const credentials = await getSanMarCredentials(companyId);

    // Need to get product data first to find the partId
    const productData = await fetchSanMarProductData(credentials, style);
    const matchingPart = productData.parts.find(
      p => p.colorName === color && p.labelSize === size
    );

    if (!matchingPart) {
      return null;
    }

    const pricingData = await fetchSanMarPricing(credentials, matchingPart.partId);

    return {
      piecePrice: pricingData.parts[0]?.prices[0]?.price,
      priceBreaks: pricingData.parts[0]?.prices.map(p => ({
        quantity: p.minQuantity,
        price: p.price
      })) || [],
      currency: 'USD',
    };
  } catch (error) {
    console.error(`Error fetching pricing for ${style}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get inventory only for a garment
 */
export async function getGarmentInventory(
  style: string,
  color: string,
  size: string,
  companyId: string
): Promise<UnifiedGarment['inventory'] | null> {
  try {
    const credentials = await getSanMarCredentials(companyId);

    // Need to get product data first to find the partId
    const productData = await fetchSanMarProductData(credentials, style);
    const matchingPart = productData.parts.find(
      p => p.colorName === color && p.labelSize === size
    );

    if (!matchingPart) {
      return null;
    }

    const inventoryData = await fetchSanMarInventory(credentials, matchingPart.partId);

    return {
      totalAvailable: inventoryData.items.reduce((sum, item) => sum + item.quantityAvailable, 0),
      inventoryLevels: inventoryData.items.map(item => ({
        partId: item.partId,
        warehouse: item.warehouseName,
        quantityAvailable: item.quantityAvailable,
      })),
    };
  } catch (error) {
    console.error(`Error fetching inventory for ${style}/${color}/${size}:`, error);
    return null;
  }
}

/**
 * Get available colors for a style
 */
export async function getAvailableColors(
  style: string,
  companyId: string
): Promise<string[]> {
  try {
    const credentials = await getSanMarCredentials(companyId);

    const productData = await fetchSanMarProductData(credentials, style);

    return productData.colors.map(c => c.colorName);
  } catch (error) {
    console.error(`Error fetching colors for ${style}:`, error);
    return [];
  }
}
