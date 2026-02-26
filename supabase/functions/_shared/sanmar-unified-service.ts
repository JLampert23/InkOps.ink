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
import { getLiveWholesalePricing, type VendorConfig } from './live-wholesale-pricing.ts';

const SANMAR_PRICING_ENDPOINT = "https://ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBindingV1?WSDL";
const SANMAR_DEFAULT_FOB_ID = "1";

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

    // Build vendor config for live wholesale pricing
    const vendorConfig: VendorConfig = {
      name: "sanmar",
      pricingEndpoint: SANMAR_PRICING_ENDPOINT,
      credentials: {
        id: credentials.id,
        password: credentials.password,
      },
    };

    // Fetch pricing (using live wholesale pricing), inventory, and media in parallel
    const [livePricingResult, inventoryResult, mediaResult] = await Promise.allSettled([
      getLiveWholesalePricing(vendorConfig, style, SANMAR_DEFAULT_FOB_ID),
      fetchSanMarInventory(credentials, partId),
      fetchSanMarMedia(credentials, style, partId),
    ]);

    // Find pricing for this specific partId from live wholesale pricing
    const livePricing = livePricingResult.status === 'fulfilled' ? livePricingResult.value : [];
    const partPricing = livePricing.filter(p => p.partId === partId);
    const pricing = partPricing.length > 0 ? {
      parts: [{
        partId,
        prices: partPricing.map(p => ({
          minQuantity: p.minQty,
          price: p.price,
          discountCode: p.discountCode || '',
        }))
      }]
    } : null;
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

    // Build vendor config for live wholesale pricing
    const vendorConfig: VendorConfig = {
      name: "sanmar",
      pricingEndpoint: SANMAR_PRICING_ENDPOINT,
      credentials: {
        id: credentials.id,
        password: credentials.password,
      },
    };

    // Fetch product data and live wholesale pricing in parallel
    const [unifiedDataResult, livePricingResult] = await Promise.allSettled([
      fetchUnifiedSanMarData(credentials, { styleNumber: style }),
      getLiveWholesalePricing(vendorConfig, style, SANMAR_DEFAULT_FOB_ID),
    ]);

    if (unifiedDataResult.status === 'rejected') {
      throw unifiedDataResult.reason;
    }

    const unifiedData = unifiedDataResult.value;
    const livePricing = livePricingResult.status === 'fulfilled' ? livePricingResult.value : [];

    // Create a map of partId to pricing for quick lookup
    const pricingByPartId = new Map<string, { piecePrice: number; priceBreaks: { quantity: number; price: number }[] }>();
    for (const priceItem of livePricing) {
      if (!pricingByPartId.has(priceItem.partId)) {
        pricingByPartId.set(priceItem.partId, {
          piecePrice: priceItem.price,
          priceBreaks: [],
        });
      }
      pricingByPartId.get(priceItem.partId)!.priceBreaks.push({
        quantity: priceItem.minQty,
        price: priceItem.price,
      });
    }

    const variants: UnifiedGarment[] = [];

    // Create variants for each part
    for (const part of unifiedData.style.parts) {
      const partPricing = pricingByPartId.get(part.partId);
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
          piecePrice: partPricing?.piecePrice || unifiedData.pricing.parts.find(p => p.partId === part.partId)?.prices[0]?.price,
          priceBreaks: partPricing?.priceBreaks || unifiedData.pricing.parts.find(p => p.partId === part.partId)?.prices.map(p => ({
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

    // Build vendor config for live wholesale pricing
    const vendorConfig: VendorConfig = {
      name: "sanmar",
      pricingEndpoint: SANMAR_PRICING_ENDPOINT,
      credentials: {
        id: credentials.id,
        password: credentials.password,
      },
    };

    // Use live wholesale pricing with FOB
    const livePricing = await getLiveWholesalePricing(vendorConfig, style, SANMAR_DEFAULT_FOB_ID);
    const partPricing = livePricing.filter(p => p.partId === matchingPart.partId);

    if (partPricing.length > 0) {
      return {
        piecePrice: partPricing[0].price,
        priceBreaks: partPricing.map(p => ({
          quantity: p.minQty,
          price: p.price
        })),
        currency: 'USD',
      };
    }

    // Fallback to old method if live pricing fails
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
